import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { assertAdminRole } from "@/lib/auth/guards";
import { expirePendingTurnos } from "@/lib/modules/agenda/application";
import { domainErrorResponse } from "@/lib/modules/agenda/api/http";

/**
 * VencerPendientes — invocar desde cron (DevOps).
 * Auth: header `x-api-key` = AGENT_API_KEY, o sesión admin.
 * Ejemplo cron: curl -X POST -H "x-api-key: $AGENT_API_KEY" https://host/api/v1/jobs/vencer-pendientes
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key");
    const expectedKey = process.env.AGENT_API_KEY;

    if (apiKey && expectedKey && apiKey === expectedKey) {
      const empresaSlug = request.headers.get("x-empresa") ?? "montironi";
      const { getEmpresaBySlug } = await import("@/lib/modules/agents-api/idempotency");
      const empresa = await getEmpresaBySlug(empresaSlug);
      const count = await expirePendingTurnos(empresa.id);
      return Response.json({ vencidos: count, empresa: empresaSlug });
    }

    const session = await requireSession();
    assertAdminRole(session.rol);
    const count = await expirePendingTurnos(session.empresaId);
    return Response.json({ vencidos: count, empresaId: session.empresaId });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "No autorizado", code: "RecursoNoEncontrado" }, { status: 403 });
    }
    return domainErrorResponse(e);
  }
}
