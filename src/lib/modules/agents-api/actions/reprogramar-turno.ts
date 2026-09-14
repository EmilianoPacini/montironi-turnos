import { rescheduleTurno } from "@/lib/modules/appointments/service";

export async function handleReprogramarTurno(empresaId: string, body: Record<string, unknown>) {
  const turno = await rescheduleTurno({
    turnoId: String(body.turnoId),
    empresaId,
    inicio: new Date(String(body.inicio)),
    version: Number(body.version),
  });
  return { turno };
}
