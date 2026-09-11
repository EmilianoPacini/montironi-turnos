import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { CanalTurno } from "@prisma/client";
import {
  crearTurnoPendiente,
  createTurno,
  assertNotPastInicio,
} from "@/lib/modules/agenda/application";
import { withIdempotency } from "@/lib/modules/agenda/infrastructure/operacion-api.repository";
import {
  domainErrorResponse,
  idempotencyKey,
  parseJsonBody,
} from "@/lib/modules/agenda/api/http";

interface CreateTurnoBody {
  tallerId: string;
  bahiaId?: string;
  clienteId: string;
  vehiculoId: string;
  servicioIds: string[];
  inicio: string;
  canal?: CanalTurno;
  kilometraje?: number;
  notas?: string;
  confirmar?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await parseJsonBody<CreateTurnoBody>(request);
    const key = idempotencyKey(request);

    const handler = async () => {
      const inicio = new Date(body.inicio);
      assertNotPastInicio(inicio);
      const input = {
        empresaId: session.empresaId,
        tallerId: body.tallerId,
        bahiaId: body.bahiaId,
        clienteId: body.clienteId,
        vehiculoId: body.vehiculoId,
        servicioIds: body.servicioIds,
        inicio,
        canal: body.canal ?? CanalTurno.interno,
        kilometraje: body.kilometraje,
        notas: body.notas,
        creadorId: session.userId,
      };

      const turno = body.confirmar
        ? await createTurno({ ...input, confirmar: true })
        : await crearTurnoPendiente(input);

      return { turno };
    };

    if (key) {
      const { value, replay } = await withIdempotency({
        empresaId: session.empresaId,
        idempotencyKey: key,
        operation: "crear_turno",
        requestBody: body,
        handler,
      });
      return Response.json({ ...value, ...(replay ? { idempotencyReplay: true } : {}) });
    }

    return Response.json(await handler());
  } catch (e) {
    return domainErrorResponse(e);
  }
}
