import type { Prisma, PrismaClient } from "@prisma/client";
import prisma from "@/lib/db";

type CatalogDb = Prisma.TransactionClient | PrismaClient;

/**
 * V1: un servicio de la empresa se ofrece en todos los talleres y bahías activos.
 * Idempotente (skipDuplicates).
 */
export async function offerServicioInEmpresa(
  db: CatalogDb,
  empresaId: string,
  servicioId: string
) {
  const talleres = await db.taller.findMany({
    where: { empresaId, activo: true },
    select: {
      id: true,
      bahias: { where: { activa: true }, select: { id: true } },
    },
  });
  if (talleres.length === 0) return;

  await db.tallerServicio.createMany({
    data: talleres.map((taller) => ({ tallerId: taller.id, servicioId })),
    skipDuplicates: true,
  });

  const bahiaIds = talleres.flatMap((taller) => taller.bahias.map((bahia) => bahia.id));
  if (bahiaIds.length === 0) return;

  await db.bahiaServicio.createMany({
    data: bahiaIds.map((bahiaId) => ({ bahiaId, servicioId })),
    skipDuplicates: true,
  });
}

export async function offerEmpresaServiciosInBahia(
  db: CatalogDb,
  empresaId: string,
  bahiaId: string,
  servicioIds?: string[]
) {
  const ids =
    servicioIds && servicioIds.length > 0
      ? servicioIds
      : (
          await db.servicio.findMany({
            where: { empresaId, activo: true },
            select: { id: true },
          })
        ).map((servicio) => servicio.id);

  if (ids.length === 0) return;

  await db.bahiaServicio.createMany({
    data: ids.map((servicioId) => ({ bahiaId, servicioId })),
    skipDuplicates: true,
  });
}

/** Repara servicios ya persistidos sin oferta en un taller (altas previas al vínculo). */
export async function ensureTallerOfreceCatalogoEmpresa(
  tallerId: string,
  empresaId: string
) {
  const taller = await prisma.taller.findFirst({
    where: { id: tallerId, empresaId, activo: true },
    select: {
      id: true,
      bahias: { where: { activa: true }, select: { id: true } },
    },
  });
  if (!taller) return;

  const huérfanos = await prisma.servicio.findMany({
    where: {
      empresaId,
      activo: true,
      tallerServicios: { none: { tallerId } },
    },
    select: { id: true },
  });
  if (huérfanos.length === 0) return;

  await prisma.tallerServicio.createMany({
    data: huérfanos.map((servicio) => ({ tallerId, servicioId: servicio.id })),
    skipDuplicates: true,
  });

  if (taller.bahias.length === 0) return;

  await prisma.bahiaServicio.createMany({
    data: huérfanos.flatMap((servicio) =>
      taller.bahias.map((bahia) => ({ bahiaId: bahia.id, servicioId: servicio.id }))
    ),
    skipDuplicates: true,
  });
}
