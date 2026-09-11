import { CanalTurno, EstadoTurno } from "@prisma/client";

export function buildAgendaQuery(params: {
  tallerId: string;
  dateStr: string;
  estado?: EstadoTurno;
  canal?: CanalTurno;
  pendientes?: boolean;
  vista?: string;
}): URLSearchParams {
  const q = new URLSearchParams();
  q.set("taller", params.tallerId);
  q.set("fecha", params.dateStr);
  if (params.estado) q.set("estado", params.estado);
  if (params.canal) q.set("canal", params.canal);
  if (params.pendientes) q.set("pendientes", "1");
  if (params.vista) q.set("vista", params.vista);
  return q;
}
