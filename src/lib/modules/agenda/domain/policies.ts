export {
  VALID_TRANSITIONS,
  canTransition,
  isActiveEstado,
} from "@/lib/modules/appointments/constants";

export { LIBERATE_ON_TERMINAL } from "./invariants";

import { EstadoTurno } from "@prisma/client";
import { canTransition } from "@/lib/modules/appointments/constants";
import { LIBERATE_ON_TERMINAL } from "./invariants";

export function shouldLiberateOcupacion(estado: EstadoTurno): boolean {
  return (LIBERATE_ON_TERMINAL as readonly string[]).includes(estado);
}

export function canTransitionTo(from: EstadoTurno, to: EstadoTurno): boolean {
  return canTransition(from, to);
}
