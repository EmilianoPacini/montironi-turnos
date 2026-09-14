import { DomainError } from "@/lib/modules/appointments/errors";

export const PAST_SLOT_MESSAGE = "No se permiten asignar turnos para horarios vencidos";

export function assertNotPastInicio(inicio: Date, now: Date = new Date()) {
  if (inicio < now) {
    throw new DomainError(PAST_SLOT_MESSAGE, "HorarioVencido");
  }
}
