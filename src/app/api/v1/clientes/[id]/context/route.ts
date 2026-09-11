import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getClienteContext } from "@/lib/modules/customers/service";
import { domainErrorResponse } from "@/lib/modules/agenda/api/http";

/** GET contexto cliente para agentes/panel — expone cliente.id + vehículos + turnos + km. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const context = await getClienteContext({ empresaId: session.empresaId, id });
    if (!context) {
      return Response.json({ error: "Cliente no encontrado", code: "RecursoNoEncontrado" }, { status: 404 });
    }
    return Response.json({ cliente: context });
  } catch (e) {
    return domainErrorResponse(e);
  }
}
