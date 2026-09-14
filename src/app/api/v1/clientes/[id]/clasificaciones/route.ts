import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { validateAgentApiKey, getEmpresaBySlug } from "@/lib/modules/agents-api/idempotency";
import { clasificarCliente, serializePerfilBuyer } from "@/lib/modules/buyer/service";
import { isDomainError, httpStatusForDomainError } from "@/lib/modules/appointments/service";

async function resolveEmpresaId(request: NextRequest, fallbackEmpresaId?: string) {
  if (fallbackEmpresaId) return fallbackEmpresaId;
  const slug = request.headers.get("x-empresa") ?? "montironi";
  const empresa = await getEmpresaBySlug(slug);
  return empresa?.id ?? null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const agentAuth = validateAgentApiKey(request);
  let empresaId: string | null = null;
  let actorUsuarioId: string | undefined;

  if (agentAuth) {
    empresaId = await resolveEmpresaId(request);
  } else {
    try {
      const session = await requireSession();
      empresaId = session.empresaId;
      actorUsuarioId = session.userId;
    } catch {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  if (!empresaId) {
    return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
  }

  const { id: clienteId } = await params;
  const body = await request.json();

  try {
    const { perfil, evento } = await clasificarCliente({
      empresaId,
      clienteId,
      clasificacion: body.clasificacion,
      intencion: body.intencion,
      tagsDelta: body.tagsDelta,
      scoreReclamosDelta: body.scoreReclamosDelta,
      wahConversationId: body.wahConversationId,
      wahMessageId: body.wahMessageId,
      fuente: body.fuente,
      actorUsuarioId,
      payload: body.payload,
    });

    return NextResponse.json({
      perfil: serializePerfilBuyer(perfil),
      evento: {
        id: evento.id,
        clasificacion: evento.clasificacion,
        intencion: evento.intencion,
        createdAt: evento.createdAt.toISOString(),
      },
    });
  } catch (e) {
    if (isDomainError(e)) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: httpStatusForDomainError(e.code) }
      );
    }
    console.error(e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
