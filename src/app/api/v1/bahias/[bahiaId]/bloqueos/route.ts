import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { crearBloqueoBahia } from "@/lib/modules/agenda/application";
import { withIdempotency } from "@/lib/modules/agenda/infrastructure/operacion-api.repository";
import {
  domainErrorResponse,
  idempotencyKey,
  parseJsonBody,
} from "@/lib/modules/agenda/api/http";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bahiaId: string }> }
) {
  try {
    const session = await requireSession();
    const { bahiaId } = await params;
    const body = await parseJsonBody<{ inicio: string; fin: string; motivo: string }>(request);
    const key = idempotencyKey(request);

    const handler = async () => {
      const bloqueo = await crearBloqueoBahia({
        empresaId: session.empresaId,
        bahiaId,
        inicio: new Date(body.inicio),
        fin: new Date(body.fin),
        motivo: body.motivo,
        usuarioId: session.userId,
      });
      return { bloqueo };
    };

    if (key) {
      const { value, replay } = await withIdempotency({
        empresaId: session.empresaId,
        idempotencyKey: key,
        operation: "crear_bloqueo",
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
