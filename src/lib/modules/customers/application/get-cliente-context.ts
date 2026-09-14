import prisma from "@/lib/db";
import { calcularProximoServicioKm } from "@/lib/modules/catalog/intervalo.service";
import { normalizeTelefonoE164 } from "@/lib/modules/customers/validation";
import { getCliente, getClienteByTelefono } from "@/lib/modules/customers/service";
import { waIdToE164 } from "@/lib/modules/wah/phone";
import { listHistorialForCliente } from "@/lib/modules/historial/service";
import { getPerfilBuyerForCliente, serializePerfilBuyer } from "@/lib/modules/buyer/service";

/** Contexto completo para agentes IA — id, teléfono, vehículos, turnos, km, próximos servicios. */
export async function getClienteContext(params: {
  empresaId: string;
  id?: string;
  telefono?: string;
  waId?: string;
}) {
  let cliente;
  let lookup: "cliente_id" | "telefono" | "wa_id" = "telefono";
  if (params.id) {
    lookup = "cliente_id";
    cliente = await getCliente(params.id, params.empresaId);
  } else {
    const telefono = params.telefono
      ? normalizeTelefonoE164(params.telefono)
      : params.waId
        ? waIdToE164(params.waId)
        : null;
    if (!telefono) return null;
    lookup = params.waId && !params.telefono ? "wa_id" : "telefono";
    const row = await getClienteByTelefono(telefono, params.empresaId);
    if (row) cliente = await getCliente(row.id, params.empresaId);
  }

  if (!cliente) return null;

  const vehiculos = await Promise.all(
    cliente.vehiculos.map(async (cv) => {
      const v = cv.vehiculo;
      const ultimoTurno = await prisma.turno.findFirst({
        where: { vehiculoId: v.id, empresaId: params.empresaId },
        orderBy: { inicio: "desc" },
        include: { detalles: { include: { servicio: true } } },
      });

      const proximosServicios = [];
      if (v.kilometrajeActual != null && ultimoTurno) {
        for (const d of ultimoTurno.detalles) {
          const proximoKm = await calcularProximoServicioKm({
            servicioId: d.servicioId,
            tipoVehiculo: v.tipoVehiculo,
            condicion: v.condicion,
            kilometrajeActual: v.kilometrajeActual,
          });
          if (proximoKm != null) {
            proximosServicios.push({
              servicioId: d.servicioId,
              servicioNombre: d.nombreSnapshot,
              proximoKm,
            });
          }
        }
      }

      return {
        id: v.id,
        patente: v.patente,
        marca: v.marca,
        modelo: v.modelo,
        anio: v.anio,
        tipoVehiculo: v.tipoVehiculo,
        condicion: v.condicion,
        kilometrajeActual: v.kilometrajeActual,
        proximosServicios,
      };
    })
  );

  const turnos = await prisma.turno.findMany({
    where: { clienteId: cliente.id, empresaId: params.empresaId },
    orderBy: { inicio: "desc" },
    take: 20,
    include: {
      vehiculo: true,
      detalles: true,
      bahia: true,
    },
  });

  const mappedTurnos = turnos.map((t) => ({
    id: t.id,
    estado: t.estado,
    inicio: t.inicio,
    finalizaEn: t.finalizaEn,
    kilometraje: t.kilometraje,
    patente: t.vehiculo.patente,
    servicios: t.detalles.map((d) => d.nombreSnapshot),
    bahia: t.bahia?.nombre ?? null,
  }));

  const programados = mappedTurnos.filter(
    (t) => !["finalizado", "cancelado", "vencido", "ausente"].includes(t.estado)
  );
  const realizados = mappedTurnos.filter((t) => t.estado === "finalizado");

  const [historialRows, perfilBuyer] = await Promise.all([
    listHistorialForCliente({
      empresaId: params.empresaId,
      clienteId: cliente.id,
      limit: 10,
    }),
    getPerfilBuyerForCliente(params.empresaId, cliente.id),
  ]);

  const buyerProfile = perfilBuyer ? serializePerfilBuyer(perfilBuyer) : null;
  const missing: string[] = [];
  if (!buyerProfile) missing.push("buyer_profile");
  if (historialRows.length === 0) missing.push("historial_services");

  return {
    id: cliente.id,
    nombre: cliente.nombre,
    apellido: cliente.apellido,
    telefono: cliente.telefono,
    email: cliente.email,
    documento: cliente.documento,
    vehiculos,
    turnos: mappedTurnos,
    _context: {
      cliente: {
        id: cliente.id,
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        telefono: cliente.telefono,
        email: cliente.email,
        documento: cliente.documento,
      },
      vehiculos,
      turnos: { programados, realizados },
      buyer_profile: buyerProfile,
      perfilBuyer: buyerProfile,
      historial_services: historialRows,
      ultimosServices: historialRows,
      meta: {
        partial: false,
        missing,
        lookup,
      },
    },
  };
}
