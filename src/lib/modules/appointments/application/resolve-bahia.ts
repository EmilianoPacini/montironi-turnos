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

  const availableBahias = [];
  for (const bahia of compatible) {
    if (
      await checkSlotAvailable(bahia.id, params.inicio, params.fin, params.excludeTurnoId)
    ) {
      availableBahias.push(bahia);
    }
  }

  if (availableBahias.length === 0) {
    throw new DomainError("Horario no disponible", "CapacidadConflicto");
  }

  if (availableBahias.length === 1) {
    return { bahiaId: availableBahias[0].id, autoAssigned: true };
  }

  throw new DomainError(
    "Seleccioná una bahía — hay varias compatibles disponibles",
    "BahiaIncompatible"
  );
}
