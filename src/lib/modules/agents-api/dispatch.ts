import { handleCrearTurno } from "@/lib/modules/agents-api/actions/crear-turno";
import { handleCancelarTurno } from "@/lib/modules/agents-api/actions/cancelar-turno";
import { handleReprogramarTurno } from "@/lib/modules/agents-api/actions/reprogramar-turno";
import { handleUpsertCliente } from "@/lib/modules/agents-api/actions/upsert-cliente";
import { handleUpsertVehiculo } from "@/lib/modules/agents-api/actions/upsert-vehiculo";
import { handleClasificarCliente } from "@/lib/modules/agents-api/actions/clasificar-cliente";

export async function dispatchAgentAction(
  action: string,
  empresaId: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  switch (action) {
    case "crear_turno":
      return handleCrearTurno(empresaId, body);
    case "cancelar_turno":
      return handleCancelarTurno(empresaId, body);
    case "reprogramar_turno":
      return handleReprogramarTurno(empresaId, body);
    case "upsert_cliente":
      return handleUpsertCliente(empresaId, body);
    case "upsert_vehiculo":
      return handleUpsertVehiculo(empresaId, body);
    case "clasificar_cliente":
      return handleClasificarCliente(empresaId, body);
    default:
      throw new Error("Acción no soportada");
  }
}
