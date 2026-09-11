import { NextRequest, NextResponse } from "next/server";
import { validateAgentApiKey, withIdempotency, getEmpresaBySlug } from "@/lib/modules/agents-api/idempotency";
import { dispatchAgentAction } from "@/lib/modules/agents-api/dispatch";
import { listServicios } from "@/lib/modules/catalog/service";
import { getAvailabilityForDate } from "@/lib/modules/availability/service";
import { getTurnoById, isDomainError, httpStatusForDomainError } from "@/lib/modules/appointments/service";
import { getClienteContext } from "@/lib/modules/customers/service";
import { ClienteValidationError } from "@/lib/modules/customers/validation";

function unauthorized() {
  return NextResponse.json({ error: "No autorizado" }, { status: 401 });
}

function errorResponse(e: unknown) {
  if (e instanceof ClienteValidationError) {
    return NextResponse.json(
      { error: e.message, code: "ValidacionCliente" },
      { status: 422 }
    );
  }
  if (isDomainError(e)) {
    return NextResponse.json(
      { error: e.message, code: e.code },
      { status: httpStatusForDomainError(e.code) }
    );
  }
  console.error(e);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}

async function resolveEmpresa(request: NextRequest) {
  const slug = request.headers.get("x-empresa") ?? "montironi";
  return getEmpresaBySlug(slug);
}

export async function GET(request: NextRequest) {
  if (!validateAgentApiKey(request)) return unauthorized();
  const empresa = await resolveEmpresa(request);
  if (!empresa) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource");

  try {
    if (resource === "servicios") {
      const servicios = await listServicios(empresa.id);
      return NextResponse.json({ servicios });
    }

    if (resource === "disponibilidad") {
      const tallerId = searchParams.get("tallerId");
      const fecha = searchParams.get("fecha");
      const servicioIds = searchParams.getAll("servicioId");
      if (!tallerId || !fecha || servicioIds.length === 0) {
        return NextResponse.json({ error: "Parámetros requeridos: tallerId, fecha, servicioId" }, { status: 400 });
      }
      const availability = await getAvailabilityForDate({
        empresaId: empresa.id,
        tallerId,
        date: new Date(fecha),
        servicioIds,
        bahiaId: searchParams.get("bahiaId") ?? undefined,
      });
      return NextResponse.json({ availability });
    }

    if (resource === "turno") {
      const id = searchParams.get("id");
      if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
      const turno = await getTurnoById(id, empresa.id);
      if (!turno) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      return NextResponse.json({ turno });
    }

    if (resource === "cliente") {
      const id = searchParams.get("id");
      const telefono = searchParams.get("telefono");
      if (!id && !telefono) {
        return NextResponse.json({ error: "id o telefono requerido" }, { status: 400 });
      }
      try {
        const cliente = await getClienteContext({
          empresaId: empresa.id,
          id: id ?? undefined,
          telefono: telefono ?? undefined,
        });
        if (!cliente) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
        return NextResponse.json({ cliente });
      } catch (e) {
        if (e instanceof ClienteValidationError) {
          return NextResponse.json({ error: e.message, code: "ValidacionCliente" }, { status: 422 });
        }
        throw e;
      }
    }

    return NextResponse.json({
      endpoints: [
        "GET ?resource=servicios",
        "GET ?resource=disponibilidad&tallerId=&fecha=&servicioId=",
        "GET ?resource=turno&id=",
        "GET ?resource=cliente&id= | telefono=",
        "POST turnos, clientes, vehiculos",
      ],
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: NextRequest) {
  if (!validateAgentApiKey(request)) return unauthorized();
  const empresa = await resolveEmpresa(request);
  if (!empresa) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });

  const idempotencyKey = request.headers.get("idempotency-key");
  const body = await request.json();
  const action = body.action as string;

  try {
    const handler = () => dispatchAgentAction(action, empresa.id, body);

    if (idempotencyKey) {
      const { value, replay } = await withIdempotency({
        empresaId: empresa.id,
        idempotencyKey,
        operation: action,
        requestBody: body,
        handler,
      });
      return NextResponse.json({
        ...value,
        ...(replay ? { idempotencyReplay: true, code: "IdempotencyReplay" } : {}),
      });
    }

    return NextResponse.json(await handler());
  } catch (e) {
    return errorResponse(e);
  }
}
