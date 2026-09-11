import { EstadoTurno } from "@prisma/client";

export const TURNO_STATE_COLORS: Record<
  EstadoTurno,
  { text: string; bg: string; label: string }
> = {
  pendiente: { text: "#805609", bg: "#FFF5DF", label: "Pendiente" },
  confirmado: { text: "#275AA1", bg: "#EAF2FD", label: "Confirmado" },
  recibido: { text: "#176477", bg: "#E7F5F7", label: "Recibido" },
  en_servicio: { text: "#6543A0", bg: "#F0EBFA", label: "En servicio" },
  finalizado: { text: "#25683D", bg: "#EAF5EE", label: "Finalizado" },
  cancelado: { text: "#A33631", bg: "#FCECEA", label: "Cancelado" },
  ausente: { text: "#665170", bg: "#F1EDF4", label: "Ausente" },
  vencido: { text: "#5C6872", bg: "#F0F2F4", label: "Vencido" },
};

export const CANAL_LABELS: Record<string, string> = {
  web: "Web",
  telefono: "Teléfono",
  whatsapp: "WhatsApp",
  interno: "Panel",
  agente_ia: "Agente IA",
};

export const MODO_PRECIO_LABELS: Record<string, string> = {
  fijo: "Precio fijo",
  desde: "Desde",
  a_presupuestar: "A presupuestar",
};

/** Manual transitions only. The only automatic transition is pendiente → vencido (see expirePendingTurnos). ausente/recibido/en_servicio/finalizado are never automatic. */
export const VALID_TRANSITIONS: Record<EstadoTurno, EstadoTurno[]> = {
  pendiente: [EstadoTurno.confirmado, EstadoTurno.cancelado],
  confirmado: [EstadoTurno.recibido, EstadoTurno.cancelado, EstadoTurno.ausente],
  recibido: [EstadoTurno.en_servicio, EstadoTurno.cancelado, EstadoTurno.ausente],
  en_servicio: [EstadoTurno.finalizado, EstadoTurno.cancelado],
  finalizado: [],
  cancelado: [],
  ausente: [],
  vencido: [],
};

export function canTransition(from: EstadoTurno, to: EstadoTurno): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isActiveEstado(estado: EstadoTurno): boolean {
  const terminal: EstadoTurno[] = [
    EstadoTurno.cancelado,
    EstadoTurno.ausente,
    EstadoTurno.vencido,
    EstadoTurno.finalizado,
  ];
  return !terminal.includes(estado);
}

export function formatPrecioSnapshot(precio: number | string, modo: string): string {
  const value = Number(precio).toLocaleString("es-AR");
  if (modo === "desde") return `Desde $${value}`;
  if (modo === "a_presupuestar") return "A presupuestar";
  return `$${value}`;
}
