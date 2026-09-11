import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { EstadoTurno } from "@prisma/client";
import { transitionTurnoState } from "@/lib/modules/agenda/application";
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
    const body = await parseJsonBody<{ estado: EstadoTurno; version?: number; detalle?: string }>(
      request
    );
    const version = parseVersion(request, body);
    if (version === undefined) {
      return Response.json({ error: "version requerida", code: "VALIDATION" }, { status: 400 });
    }

    const key = idempotencyKey(request);
    const handler = async () => {
      const turno = await transitionTurnoState({
        turnoId: id,
        empresaId: session.empresaId,
        nuevoEstado: body.estado,
        version,
        usuarioId: session.userId,
        detalle: body.detalle,
      });
      return { turno };
    };

    if (key) {
      const { value, replay } = await withIdempotency({
        empresaId: session.empresaId,
        idempotencyKey: key,
        operation: "transicion_turno",
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
