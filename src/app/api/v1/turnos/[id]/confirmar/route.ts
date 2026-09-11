import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { confirmTurno } from "@/lib/modules/agenda/application";
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
    const body = await parseJsonBody<{ version?: number }>(request).catch(() => ({}));
    const version = parseVersion(request, body);
    const key = idempotencyKey(request);

    const handler = async () => {
      const turno = await confirmTurno({
        turnoId: id,
        empresaId: session.empresaId,
        usuarioId: session.userId,
        version,
      });
      return { turno };
    };

    if (key) {
      const { value, replay } = await withIdempotency({
        empresaId: session.empresaId,
        idempotencyKey: key,
        operation: "confirmar_turno",
        requestBody: { turnoId: id, version },
        handler,
      });
      return Response.json({ ...value, ...(replay ? { idempotencyReplay: true } : {}) });
    }

    return Response.json(await handler());
  } catch (e) {
    return domainErrorResponse(e);
  }
}
