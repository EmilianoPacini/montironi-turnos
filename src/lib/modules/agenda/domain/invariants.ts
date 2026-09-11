/**
 * Invariantes de dominio — Montironi Turnos V1
 * @see docs/DOMAIN_SERVICES.md
 */

/** CrearTurnoPendiente SIEMPRE inserta ocupacion_bahia activa tipo=turno (hold de capacidad). */
export const HOLD_ON_PENDIENTE = true as const;

/** ConsultarAgenda / ConsultarDisponibilidad nunca escriben ocupacion_bahia. */
export const READ_ONLY_AVAILABILITY = true as const;

/** ConfirmarTurno mantiene el hold; solo swap si cambia bahía o periodo. No libera. */
export const CONFIRM_KEEPS_HOLD = true as const;

/** Cancelar, ausente y vencido liberan capacidad (activo=false). */
export const LIBERATE_ON_TERMINAL = ["cancelado", "ausente", "vencido"] as const;

/** Única transición automática de estado. */
export const AUTO_TRANSITION = "pendiente→vencido" as const;
