import { EstadoTurno } from "@prisma/client";
import prisma from "@/lib/db";
import { DomainError } from "@/lib/modules/appointments/errors";
import {
  ACTIVE_OPERATIONAL,
  TURNO_STATE_COLORS,
} from "@/lib/modules/appointments/constants";
import { getCliente, getClienteByTelefono } from "@/lib/modules/customers/service";
import { normalizeTelefonoE164 } from "@/lib/modules/customers/validation";
import { waIdToE164 } from "@/lib/modules/wah/phone";
import { listHistorialForCliente, serializeHistorialRow } from "@/lib/modules/historial/service";

const ESTADO_PRIORITY: Record<string, number> = {
  en_servicio: 0,
  recibido: 1,
  confirmado: 2,
  pendiente: 3,
};

export function etiquetaEstado(estado: EstadoTurno): string {
  return TURNO_STATE_COLORS[estado]?.label ?? estado;
}

export async function resolverAtencionVehiculo(params: {
  empresaId: string;
  telefono?: string;
  waId?: string;
  clienteId?: string;
  patente?: string;
}) {
  let clienteId = params.clienteId;
  let vehiculoId: string | undefined;

  if (params.patente) {
    const vehiculo = await prisma.vehiculo.findFirst({
      where: {
        empresaId: params.empresaId,
        patente: params.patente.trim().toUpperCase(),
      },
      include: {
        clientes: { include: { cliente: true } },
      },
    });
    if (!vehiculo) return null;
    vehiculoId = vehiculo.id;
    if (clienteId && !vehiculo.clientes.some((c) => c.clienteId === clienteId)) {
      throw new DomainError("Vehículo no pertenece al cliente", "RecursoNoEncontrado");
    }
    if (!clienteId) {
      clienteId = vehiculo.clientes[0]?.clienteId;
    }
  }

  if (!clienteId) {
    if (params.clienteId) {
      const row = await getCliente(params.clienteId, params.empresaId);
      clienteId = row?.id;
    } else {
      const telefono = params.telefono
        ? normalizeTelefonoE164(params.telefono)
        : params.waId
          ? waIdToE164(params.waId)
          : null;
      if (!telefono) return null;
      const row = await getClienteByTelefono(telefono, params.empresaId);
      clienteId = row?.id;
    }
  }

  if (!clienteId) return null;

  const turnosActivos = await prisma.turno.findMany({
    where: {
      empresaId: params.empresaId,
      clienteId,
      ...(vehiculoId ? { vehiculoId } : {}),
      estado: { in: ACTIVE_OPERATIONAL },
    },
    include: {
      taller: true,
      bahia: true,
      vehiculo: true,
      detalles: true,
      eventos: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  const vehiculosActivos = new Set(turnosActivos.map((t) => t.vehiculoId));
  if (!params.patente && vehiculosActivos.size > 1) {
    return {
      multiple: true as const,
      vehiculos: [...vehiculosActivos].map((id) => {
        const t = turnosActivos.find((row) => row.vehiculoId === id)!;
        return {
          vehiculoId: id,
          patente: t.vehiculo.patente,
          estado: t.estado,
        };
      }),
    };
  }

  turnosActivos.sort((a, b) => {
    const pa = ESTADO_PRIORITY[a.estado] ?? 9;
    const pb = ESTADO_PRIORITY[b.estado] ?? 9;
    if (pa !== pb) return pa - pb;
    return a.inicio.getTime() - b.inicio.getTime();
  });

  const actual = turnosActivos[0] ?? null;
  const historial = await listHistorialForCliente({
    empresaId: params.empresaId,
    clienteId,
    limit: 10,
  });

  let ultimoHistorial: ReturnType<typeof serializeHistorialRow> | null =
    historial[0] ?? null;
  if (vehiculoId) {
    const rows = await prisma.historialServicio.findMany({
      where: { empresaId: params.empresaId, clienteId, vehiculoId },
      orderBy: { realizadoEn: "desc" },
      take: 1,
    });
    ultimoHistorial = rows[0] ? serializeHistorialRow(rows[0]) : null;
  }

  return {
    multiple: false as const,
    clienteId,
    atencion_actual: actual
      ? {
          turnoId: actual.id,
          estado: actual.estado,
          etiqueta: etiquetaEstado(actual.estado),
          inicio: actual.inicio.toISOString(),
          finalizaEn: actual.finalizaEn.toISOString(),
          tallerId: actual.tallerId,
          tallerNombre: actual.taller.nombre,
          localidad: actual.taller.localidad,
          bahiaId: actual.bahiaId,
          bahiaNombre: actual.bahia.nombre,
          patente: actual.vehiculo.patente,
          servicios: actual.detalles.map((d) => d.nombreSnapshot),
          eventos: actual.eventos.map((e) => ({
            estadoPrev: e.estadoPrev,
            estadoNuevo: e.estadoNuevo,
            detalle: e.detalle,
            createdAt: e.createdAt.toISOString(),
          })),
        }
      : null,
    ultimo_historial: actual ? null : ultimoHistorial,
    historial,
  };
}
