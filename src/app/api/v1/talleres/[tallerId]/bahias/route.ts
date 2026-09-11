import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { assertAdminRole } from "@/lib/auth/guards";
import { listBahiasTaller, createBahia } from "@/lib/modules/catalog/bahia.service";
import { domainErrorResponse } from "@/lib/modules/agenda/api/http";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tallerId: string }> }
) {
  try {
    const session = await requireSession();
    const { tallerId } = await params;
    const bahias = await listBahiasTaller(tallerId, session.empresaId);
    return Response.json({ bahias });
  } catch (e) {
    return domainErrorResponse(e);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tallerId: string }> }
) {
  try {
    const session = await requireSession();
    assertAdminRole(session.rol);
    const { tallerId } = await params;
    const body = await request.json();
    const bahia = await createBahia({
      tallerId,
      empresaId: session.empresaId,
      nombre: String(body.nombre),
      orden: body.orden ? Number(body.orden) : undefined,
      servicioIds: body.servicioIds as string[] | undefined,
      usuarioId: session.userId,
    });
    return Response.json({ bahia }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
    return domainErrorResponse(e);
  }
}
