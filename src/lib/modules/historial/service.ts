import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";

export async function upsertHistorialDesdeTurnoFinalizado(
  turnoId: string,
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;

  const turno = await db.turno.findUniqueOrThrow({
    where: { id: turnoId },
    include: {
      detalles: {
        include: {
          servicio: { include: { tipoServicio: true } },
        },
      },
      taller: true,
      bahia: true,
    },
  });

  const realizadoEn = new Date();
  const kilometrajeKm = turno.kilometraje ?? null;

  for (const detalle of turno.detalles) {
    await db.historialServicio.upsert({
      where: { detalleTurnoId: detalle.id },
      create: {
        empresaId: turno.empresaId,
        clienteId: turno.clienteId,
        vehiculoId: turno.vehiculoId,
        turnoId: turno.id,
        detalleTurnoId: detalle.id,
        tallerId: turno.tallerId,
        servicioId: detalle.servicioId,
        tipoServicioId: detalle.servicio.tipoServicioId,
        servicioNombre: detalle.nombreSnapshot,
        tipoServicioNombre: detalle.servicio.tipoServicio?.nombre ?? null,
        tallerNombre: turno.taller.nombre,
        bahiaId: turno.bahiaId,
        bahiaNombre: turno.bahia?.nombre ?? null,
        realizadoEn,
        kilometrajeKm,
        duracionMinutos: detalle.duracionMin,
        precio: detalle.precioSnapshot,
        moneda: "ARS",
        resultado: "realizado",
      },
      update: {
        servicioNombre: detalle.nombreSnapshot,
        tipoServicioNombre: detalle.servicio.tipoServicio?.nombre ?? null,
        tallerNombre: turno.taller.nombre,
        bahiaId: turno.bahiaId,
        bahiaNombre: turno.bahia?.nombre ?? null,
        realizadoEn,
        kilometrajeKm,
        duracionMinutos: detalle.duracionMin,
        precio: detalle.precioSnapshot,
      },
    });
  }
}

export async function backfillHistorialFromFinalizados(params?: { empresaId?: string }) {
  const turnos = await prisma.turno.findMany({
    where: {
      estado: "finalizado",
      ...(params?.empresaId ? { empresaId: params.empresaId } : {}),
    },
    select: { id: true },
    orderBy: { inicio: "asc" },
  });

  let inserted = 0;
  let skipped = 0;

  for (const { id } of turnos) {
    const before = await prisma.historialServicio.count({ where: { turnoId: id } });
    if (before > 0) {
      skipped += 1;
      continue;
    }

    try {
      await upsertHistorialDesdeTurnoFinalizado(id);
      inserted += 1;
    } catch {
      skipped += 1;
    }
  }

  return { processed: turnos.length, inserted, skipped };
}

export function serializeHistorialRow(row: {
  id: string;
  servicioNombre: string;
  tipoServicioNombre: string | null;
  tallerNombre: string | null;
  bahiaNombre?: string | null;
  realizadoEn: Date;
  kilometrajeKm: number | null;
  duracionMinutos: number | null;
  precio: Prisma.Decimal | null;
  moneda: string;
  resultado: string;
  turnoId: string;
  vehiculoId: string;
}) {
  return {
    id: row.id,
    servicioNombre: row.servicioNombre,
    tipoServicioNombre: row.tipoServicioNombre,
    tallerNombre: row.tallerNombre,
    bahiaNombre: row.bahiaNombre ?? null,
    realizadoEn: row.realizadoEn.toISOString(),
    kilometrajeKm: row.kilometrajeKm,
    duracionMinutos: row.duracionMinutos,
    precio: row.precio != null ? Number(row.precio) : null,
    moneda: row.moneda,
    resultado: row.resultado,
    turnoId: row.turnoId,
    vehiculoId: row.vehiculoId,
  };
}

export async function listHistorialForCliente(params: {
  empresaId: string;
  clienteId: string;
  limit?: number;
}) {
  const rows = await prisma.historialServicio.findMany({
    where: { empresaId: params.empresaId, clienteId: params.clienteId },
    orderBy: { realizadoEn: "desc" },
    take: params.limit ?? 10,
  });

  return rows.map(serializeHistorialRow);
}
