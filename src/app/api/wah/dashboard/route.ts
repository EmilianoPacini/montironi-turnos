import { NextRequest } from "next/server";
import { requireWahSession, wahErrorResponse } from "@/lib/modules/wah/scope";
import { getWahDashboard } from "@/lib/modules/wah/conversation.service";
import { jsonOk } from "@/lib/modules/wah/http";

export async function GET(request: NextRequest) {
  try {
    const session = await requireWahSession();
    const accountId = request.nextUrl.searchParams.get("accountId") ?? undefined;
    const kpis = await getWahDashboard(session.empresaId, accountId);
    return jsonOk({ kpis });
  } catch (e) {
    return wahErrorResponse(e);
  }
}
