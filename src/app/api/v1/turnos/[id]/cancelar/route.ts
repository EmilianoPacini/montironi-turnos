import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { cancelTurno } from "@/lib/modules/agenda/application";
import { withIdempotency } from "@/lib/modules/agenda/infrastructure/operacion-api.repository";
import {
  domainErrorResponse,
  idempotencyKey,
  parseJsonBody,
  parseVersion,
} from "@/lib/modules/agenda/api/http";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await parseJsonBody<{ version?: number; motivo?: string }>(request);
    const version = parseVersion(request, body);
    const key = idempotencyKey(request);

    const handler = async () => {
      const turno = await cancelTurno({
        turnoId: id,
        empresaId: session.empresaId,
        version,
        usuarioId: session.userId,
        motivo: body.motivo,
      });
      return { turno };
    };

    if (key) {
      const { value, replay } = await withIdempotency({
        empresaId: session.empresaId,
        idempotencyKey: key,
        operation: "cancelar_turno",
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
