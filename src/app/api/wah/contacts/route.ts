import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { domainErrorResponse } from "@/lib/modules/agenda/api/http";
import { listWahContacts } from "@/lib/modules/wah/service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const search = request.nextUrl.searchParams.get("search") ?? undefined;
    const contacts = await listWahContacts(session.empresaId, search);
    return Response.json({ contacts });
  } catch (e) {
    return domainErrorResponse(e);
  }
}
