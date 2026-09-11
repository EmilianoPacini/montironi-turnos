import prisma from "@/lib/db";
import { CondicionVehiculo, TipoVehiculo } from "@prisma/client";
import { calcularProximoServicioKm } from "@/lib/modules/catalog/intervalo.service";
import {
  assertClienteRequiredFields,
  ClienteValidationError,
  normalizeTelefonoE164,
} from "@/lib/modules/customers/validation";
import { waIdToE164 } from "@/lib/modules/wah/phone";
import { DomainError } from "@/lib/modules/appointments/errors";

export { ClienteValidationError };

export async function listClientes(empresaId: string, search?: string) {
  return prisma.cliente.findMany({
    where: {
      empresaId,
      activo: true,
      ...(search
        ? {
            OR: [
              { nombre: { contains: search, mode: "insensitive" } },
              { apellido: { contains: search, mode: "insensitive" } },
              { telefono: { contains: search } },
              { email: { contains: search, mode: "insensitive" } },
              { documento: { contains: search, mode: "insensitive" } },
              {
                vehiculos: {
                  some: {
                    vehiculo: {
                      patente: { contains: search, mode: "insensitive" },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      vehiculos: { include: { vehiculo: true } },
    },
    orderBy: { nombre: "asc" },
  });
}

export async function getCliente(id: string, empresaId: string) {
  return prisma.cliente.findFirst({
    where: { id, empresaId },
    include: {
      vehiculos: { include: { vehiculo: true } },
      documentos: true,
      turnos: {
        orderBy: { inicio: "desc" },
        take: 10,
        include: { detalles: true, bahia: true },
      },
    },
  });
}

export async function getClienteByTelefono(telefono: string, empresaId: string) {
  const normalized = normalizeTelefonoE164(telefono);
  return prisma.cliente.findFirst({
    where: { empresaId, telefono: normalized, activo: true },
  });
}

/** Contexto completo para agentes IA — id, teléfono, vehículos, turnos, km, próximos servicios. */
export async function getClienteContext(params: { empresaId: string; id?: string; telefono?: string; waId?: string }) {
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
      buyer_profile: null,
      historial_services: null,
      meta: {
        partial: true,
        missing: ["buyer_profile", "historial_services"],
        lookup,
      },
    },
  };
}

export async function upsertCliente(params: {
  empresaId: string;
  id?: string;
  nombre: string;
  apellido?: string;
  email?: string;
  telefono?: string;
  documento?: string;
  notas?: string;
}) {
  const { nombre, apellido, telefono } = assertClienteRequiredFields(params);

  if (params.id) {
    const updated = await prisma.cliente.updateMany({
      where: { id: params.id, empresaId: params.empresaId },
      data: {
        nombre,
        apellido,
        email: params.email?.trim() || null,
        telefono,
        documento: params.documento?.trim() || null,
        notas: params.notas,
      },
    });
    if (updated.count === 0) {
      throw new DomainError("Cliente no encontrado", "RecursoNoEncontrado");
    }
    return prisma.cliente.findFirstOrThrow({
      where: { id: params.id, empresaId: params.empresaId },
    });
  }

  return prisma.cliente.create({
    data: {
      empresaId: params.empresaId,
      nombre,
      apellido,
      email: params.email?.trim() || null,
      telefono,
      documento: params.documento?.trim() || null,
      notas: params.notas,
    },
  });
}

export async function upsertVehiculo(params: {
  empresaId: string;
  patente: string;
  marca?: string;
  modelo?: string;
  anio?: number;
  color?: string;
  tipoVehiculo?: TipoVehiculo;
  condicion?: CondicionVehiculo;
  kilometrajeActual?: number;
  clienteId?: string;
}) {
  const vehiculo = await prisma.vehiculo.upsert({
    where: {
      empresaId_patente: {
        empresaId: params.empresaId,
        patente: params.patente.toUpperCase(),
      },
    },
    create: {
      empresaId: params.empresaId,
      patente: params.patente.toUpperCase(),
      marca: params.marca,
      modelo: params.modelo,
      anio: params.anio,
      color: params.color,
      tipoVehiculo: params.tipoVehiculo ?? TipoVehiculo.auto,
      condicion: params.condicion ?? CondicionVehiculo.normal,
      kilometrajeActual: params.kilometrajeActual,
    },
    update: {
      marca: params.marca,
      modelo: params.modelo,
      anio: params.anio,
      color: params.color,
      ...(params.tipoVehiculo ? { tipoVehiculo: params.tipoVehiculo } : {}),
      ...(params.condicion ? { condicion: params.condicion } : {}),
      ...(params.kilometrajeActual !== undefined
        ? { kilometrajeActual: params.kilometrajeActual }
        : {}),
    },
  });

  if (params.clienteId) {
    await prisma.clienteVehiculo.upsert({
      where: {
        clienteId_vehiculoId: {
          clienteId: params.clienteId,
          vehiculoId: vehiculo.id,
        },
      },
      create: {
        clienteId: params.clienteId,
        vehiculoId: vehiculo.id,
        esPrincipal: true,
      },
      update: {},
    });
  }

  return vehiculo;
}

export async function getVehiculoForCliente(
  vehiculoId: string,
  clienteId: string,
  empresaId: string
) {
  const link = await prisma.clienteVehiculo.findFirst({
    where: {
      vehiculoId,
      clienteId,
      cliente: { empresaId },
      vehiculo: { empresaId },
    },
    include: { vehiculo: true },
  });
  return link?.vehiculo ?? null;
}

export async function linkVehiculoToCliente(
  clienteId: string,
  vehiculoId: string,
  empresaId: string
) {
  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, empresaId },
  });
  const vehiculo = await prisma.vehiculo.findFirst({
    where: { id: vehiculoId, empresaId },
  });

  if (!cliente || !vehiculo) throw new DomainError("No encontrado", "RecursoNoEncontrado");

  return prisma.clienteVehiculo.upsert({
    where: { clienteId_vehiculoId: { clienteId, vehiculoId } },
    create: { clienteId, vehiculoId },
    update: {},
  });
}
