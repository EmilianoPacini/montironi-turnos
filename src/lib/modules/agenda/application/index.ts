/** Casos de uso — delegación a implementación de dominio (migración incremental). */
export {
  crearTurnoPendiente,
  createTurno,
  confirmTurno,
  cancelTurno,
  rescheduleTurno,
  transitionTurnoState,
  expirePendingTurnos,
  crearBloqueoBahia,
  blockBahia,
  removeBlock as liberarBloqueoBahia,
  getTurnoById,
  listTurnos,
} from "@/lib/modules/appointments/service";

export { getAgendaForDate } from "@/lib/modules/availability/service";
export { getAvailabilityForDate } from "@/lib/modules/availability/service";
