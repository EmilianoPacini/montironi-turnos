import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { assertAdminRole } from "@/lib/auth/guards";
import { updateBahia } from "@/lib/modules/catalog/bahia.service";
import { domainErrorResponse } from "@/lib/modules/agenda/api/http";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bahiaId: string }> }
) {
  try {
    const session = await requireSession();
    assertAdminRole(session.rol);
    const { bahiaId } = await params;
    const body = await request.json();
    const bahia = await updateBahia({
      bahiaId,
      empresaId: session.empresaId,
      nombre: body.nombre,
      activa: body.activa,
      servicioIds: body.servicioIds,
      usuarioId: session.userId,
    });
    return Response.json({ bahia });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
    return domainErrorResponse(e);
  }
}
