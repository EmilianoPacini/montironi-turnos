import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { liberarBloqueoBahia } from "@/lib/modules/agenda/application";
import { domainErrorResponse } from "@/lib/modules/agenda/api/http";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ ocupacionId: string }> }
) {
  try {
    const session = await requireSession();
    const { ocupacionId } = await params;
    const bloqueo = await liberarBloqueoBahia(ocupacionId, session.empresaId);
    return Response.json({ bloqueo });
  } catch (e) {
    return domainErrorResponse(e);
  }
}
