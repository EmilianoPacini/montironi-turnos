import {
  createTurno,
  assertNotPastInicio,
} from "@/lib/modules/appointments/service";
import { resolveCanal } from "@/lib/modules/agents-api/resolve-canal";

export async function handleCrearTurno(empresaId: string, body: Record<string, unknown>) {
  const inicio = new Date(String(body.inicio));
  assertNotPastInicio(inicio);
  const turno = await createTurno({
    empresaId,
    tallerId: String(body.tallerId),
    bahiaId: body.bahiaId ? String(body.bahiaId) : undefined,
    clienteId: String(body.clienteId),
    vehiculoId: String(body.vehiculoId),
    servicioIds: body.servicioIds as string[],
    inicio,
    canal: resolveCanal(body as { canal?: string; origen?: string }),
    notas: body.notas ? String(body.notas) : undefined,
    confirmar: body.confirmar !== undefined ? Boolean(body.confirmar) : true,
  });
  return { turno };
}
