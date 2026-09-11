import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { rescheduleTurno } from "@/lib/modules/agenda/application";
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
    const body = await parseJsonBody<{
      inicio: string;
      bahiaId?: string;
      version?: number;
    }>(request);
    const version = parseVersion(request, body);
    if (version === undefined) {
      return Response.json({ error: "version requerida", code: "VALIDATION" }, { status: 400 });
    }

    const key = idempotencyKey(request);
    const handler = async () => {
      const turno = await rescheduleTurno({
        turnoId: id,
        empresaId: session.empresaId,
        bahiaId: body.bahiaId,
        inicio: new Date(body.inicio),
        version,
        usuarioId: session.userId,
      });
      return { turno };
    };

    if (key) {
      const { value, replay } = await withIdempotency({
        empresaId: session.empresaId,
        idempotencyKey: key,
        operation: "reprogramar_turno",
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
