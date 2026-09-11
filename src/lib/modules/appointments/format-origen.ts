import { format } from "date-fns";
import { CanalTurno, EstadoTurno } from "@prisma/client";
import { CANAL_LABELS } from "./constants";

export function formatTurnoOrigen(turno: {
  canal: CanalTurno;
  estado: EstadoTurno;
  inicio: Date;
  creador?: { nombre: string } | null;
}): string {
  if (turno.canal === CanalTurno.interno) {
    return `Panel · ${turno.creador?.nombre ?? "—"}`;
  }

  if (turno.canal === CanalTurno.whatsapp && turno.estado === EstadoTurno.pendiente) {
    return `WhatsApp · Vence a las ${format(turno.inicio, "HH:mm")}`;
  }

  return CANAL_LABELS[turno.canal];
}
