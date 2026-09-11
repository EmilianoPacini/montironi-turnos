import { requireSession } from "@/lib/auth/session";
import { domainErrorResponse } from "@/lib/modules/agenda/api/http";
import { getWahKpis } from "@/lib/modules/wah/service";

export async function GET() {
  try {
    const session = await requireSession();
    const kpis = await getWahKpis(session.empresaId);
    return Response.json({ kpis });
  } catch (e) {
    return domainErrorResponse(e);
  }
}
