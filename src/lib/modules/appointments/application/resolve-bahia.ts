import { Prisma } from "@prisma/client";
import { getCompatibleBahias, checkSlotAvailable } from "@/lib/modules/availability/service";
import { DomainError } from "@/lib/modules/appointments/errors";

export async function resolveBahiaAssignment(params: {
  tallerId: string;
  servicioIds: string[];
  inicio: Date;
  fin: Date;
  bahiaId?: string;
  excludeTurnoId?: string;
}): Promise<{ bahiaId: string; autoAssigned: boolean }> {
  const compatible = await getCompatibleBahias(params.tallerId, params.servicioIds);

  if (compatible.length === 0) {
    throw new DomainError("Ninguna bahía compatible con los servicios", "BahiaIncompatible");
  }

  if (params.bahiaId) {
    if (!compatible.some((b) => b.id === params.bahiaId)) {
      throw new DomainError("Bahía incompatible con los servicios", "BahiaIncompatible");
    }
    const available = await checkSlotAvailable(
      params.bahiaId,
      params.inicio,
      params.fin,
      params.excludeTurnoId
    );
    if (!available) {
      throw new DomainError("Horario no disponible", "CapacidadConflicto");
    }
    return { bahiaId: params.bahiaId, autoAssigned: false };
  }

  for (const bahia of compatible) {
    if (await checkSlotAvailable(bahia.id, params.inicio, params.fin, params.excludeTurnoId)) {
      return { bahiaId: bahia.id, autoAssigned: true };
    }
  }

  throw new DomainError("Horario no disponible", "CapacidadConflicto");
}

export async function assignBahiaInTransaction(
  tx: Prisma.TransactionClient,
  params: {
    tallerId: string;
    servicioIds: string[];
    inicio: Date;
    fin: Date;
    bahiaId?: string;
    excludeTurnoId?: string;
  }
): Promise<{ bahiaId: string; autoAssigned: boolean }> {
  const compatible = await getCompatibleBahias(params.tallerId, params.servicioIds);
  if (compatible.length === 0) {
    throw new DomainError("Ninguna bahía compatible con los servicios", "BahiaIncompatible");
  }

  const pool = params.bahiaId
    ? compatible.filter((b) => b.id === params.bahiaId)
    : compatible;

  if (params.bahiaId && pool.length === 0) {
    throw new DomainError("Bahía incompatible con los servicios", "BahiaIncompatible");
  }

  const ids = pool.map((b) => b.id);
  const locked = await tx.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id
     FROM bahia
     WHERE id = ANY($1::uuid[])
       AND activa = true
     ORDER BY orden ASC, id ASC
     FOR UPDATE SKIP LOCKED`,
    ids
  );

  for (const row of locked) {
    const conflict = await tx.ocupacionBahia.findFirst({
      where: {
        bahiaId: row.id,
        activo: true,
        inicio: { lt: params.fin },
        fin: { gt: params.inicio },
        ...(params.excludeTurnoId
          ? { OR: [{ turnoId: null }, { turnoId: { not: params.excludeTurnoId } }] }
          : {}),
      },
    });
    if (!conflict) {
      return { bahiaId: row.id, autoAssigned: !params.bahiaId };
    }
  }

  throw new DomainError("Horario no disponible", "CapacidadConflicto");
}
