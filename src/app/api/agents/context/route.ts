import { NextRequest, NextResponse } from "next/server";
import {
  validateAgentApiKey,
  getEmpresaBySlug,
} from "@/lib/modules/agents-api/idempotency";
import {
  getClienteContext,
  ClienteValidationError,
} from "@/lib/modules/customers/service";

function unauthorized() {
  return NextResponse.json({ error: "No autorizado" }, { status: 401 });
}

async function resolveEmpresa(request: NextRequest) {
  const slug =
    request.nextUrl.searchParams.get("empresa") ??
    request.headers.get("x-empresa") ??
    "montironi";
  return getEmpresaBySlug(slug);
}

/**
 * GET /api/agents/context?telefono=+549… | wa_id=549… | cliente_id=
 * Auth: x-api-key (AGENT_API_KEY)
 * One-shot context for WSP / n8n — does not wait on Datos historial/buyer.
 */
export async function GET(request: NextRequest) {
  if (!validateAgentApiKey(request)) return unauthorized();

  const empresa = await resolveEmpresa(request);
  if (!empresa) {
    return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
  }

  const telefono = request.nextUrl.searchParams.get("telefono") ?? undefined;
  const waId = request.nextUrl.searchParams.get("wa_id") ?? undefined;
  const clienteId = request.nextUrl.searchParams.get("cliente_id") ?? undefined;

  if (!telefono && !waId && !clienteId) {
    return NextResponse.json(
      { error: "telefono, wa_id o cliente_id requerido", code: "VALIDATION" },
      { status: 400 }
    );
  }

  try {
    const raw = await getClienteContext({
      empresaId: empresa.id,
      id: clienteId,
      telefono,
      waId,
    });
    if (!raw) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    if (raw._context) {
      return NextResponse.json(raw._context);
    }

    return NextResponse.json({
      cliente: {
        id: raw.id,
        nombre: raw.nombre,
        apellido: raw.apellido,
        telefono: raw.telefono,
        email: raw.email,
        documento: raw.documento,
      },
      vehiculos: raw.vehiculos,
      turnos: { programados: raw.turnos, realizados: [] },
      buyer_profile: null,
      historial_services: null,
      meta: {
        partial: true,
        missing: ["buyer_profile", "historial_services"],
        lookup: "telefono",
      },
    });
  } catch (e) {
    if (e instanceof ClienteValidationError) {
      return NextResponse.json(
        { error: e.message, code: "ValidacionCliente" },
        { status: 422 }
      );
    }
    console.error(e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
