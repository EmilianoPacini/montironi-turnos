import { cancelTurno } from "@/lib/modules/appointments/service";

export async function handleCancelarTurno(empresaId: string, body: Record<string, unknown>) {
  const turno = await cancelTurno({
    turnoId: String(body.turnoId),
    empresaId,
    version: body.version !== undefined ? Number(body.version) : undefined,
    motivo: body.motivo ? String(body.motivo) : undefined,
  });
  return { turno };
}
