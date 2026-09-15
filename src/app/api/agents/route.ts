import { NextRequest, NextResponse } from "next/server";
import {
  validateAgentApiKey,
  withIdempotency,
  resolveAgentEmpresa,
} from "@/lib/modules/agents-api/idempotency";
import { dispatchAgentAction } from "@/lib/modules/agents-api/dispatch";
import {
  getServicioForAgents,
  listServiciosForAgents,
} from "@/lib/modules/catalog/servicio-agents";
import { listTalleresForAgents } from "@/lib/modules/catalog/taller-agents";
import {
  aggregateVentanas,
  getAvailabilityForDate,
  getTallerScheduleForDate,
  proximosSlots,
} from "@/lib/modules/availability/service";
import { format } from "date-fns";
import { getTurnoById, isDomainError, httpStatusForDomainError } from "@/lib/modules/appointments/service";
import { resolverAtencionVehiculo } from "@/lib/modules/appointments/atencion";
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

async function requireEmpresa(request: NextRequest) {
  if (!validateAgentApiKey(request)) return { response: unauthorized() };
  const resolved = await resolveAgentEmpresa(request);
  if (!resolved.ok) {
    return {
      response: NextResponse.json(
        { error: resolved.error, code: resolved.status === 403 ? "FORBIDDEN" : "NOT_FOUND" },
        { status: resolved.status }
      ),
    };
  }
  return { empresa: resolved.empresa };
}

export async function GET(request: NextRequest) {
  const auth = await requireEmpresa(request);
  if ("response" in auth) return auth.response;
  const { empresa } = auth;

  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource");

  try {
    if (resource === "servicios") {
      const servicios = await listServiciosForAgents(empresa.id);
      return NextResponse.json({ servicios });
    }

    if (resource === "servicio") {
      const id = searchParams.get("id");
      if (!id) {
        return NextResponse.json({ error: "id requerido" }, { status: 400 });
      }
      const servicio = await getServicioForAgents({ empresaId: empresa.id, id });
      if (!servicio) {
        return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      }
      return NextResponse.json({ servicio });
    }

    if (resource === "talleres") {
      const servicioId = searchParams.get("servicioId") ?? undefined;
      const talleres = await listTalleresForAgents({
        empresaId: empresa.id,
        servicioId,
      });
      return NextResponse.json({ talleres });
    }

    if (resource === "proximos_slots") {
      const servicioId = searchParams.get("servicioId");
      if (!servicioId) {
        return NextResponse.json({ error: "servicioId requerido" }, { status: 400 });
      }
      const limite = Number(searchParams.get("limite") ?? 5);
      const desdeRaw = searchParams.get("desde");
      const slots = await proximosSlots({
        empresaId: empresa.id,
        servicioId,
        tallerId: searchParams.get("tallerId") ?? undefined,
        desde: desdeRaw ? new Date(desdeRaw) : undefined,
        limite: Number.isFinite(limite) ? limite : 5,
      });
      return NextResponse.json({ slots });
    }

    if (resource === "estado_vehiculo") {
      const atencion = await resolverAtencionVehiculo({
        empresaId: empresa.id,
        telefono: searchParams.get("telefono") ?? undefined,
        waId: searchParams.get("wa_id") ?? undefined,
        clienteId: searchParams.get("cliente_id") ?? undefined,
        patente: searchParams.get("patente") ?? undefined,
      });
      if (!atencion) {
        return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      }
      return NextResponse.json(atencion);
    }

    if (resource === "disponibilidad") {
      const tallerId = searchParams.get("tallerId");
      const fecha = searchParams.get("fecha");
      const servicioIds = searchParams.getAll("servicioId");
      if (!tallerId || !fecha || servicioIds.length === 0) {
        return NextResponse.json({ error: "Parámetros requeridos: tallerId, fecha, servicioId" }, { status: 400 });
      }
      const date = new Date(fecha);
      const availability = await getAvailabilityForDate({
        empresaId: empresa.id,
        tallerId,
        date,
        servicioIds,
        bahiaId: searchParams.get("bahiaId") ?? undefined,
      });
      const schedule = await getTallerScheduleForDate(tallerId, date);
      return NextResponse.json({
        availability,
        horario_del_dia: schedule.map((w) => ({
          abre: format(w.inicio, "HH:mm"),
          cierra: format(w.fin, "HH:mm"),
        })),
        ventanas_disponibles: aggregateVentanas(availability),
      });
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
        "GET ?resource=servicio&id=",
        "GET ?resource=talleres&servicioId=",
        "GET ?resource=proximos_slots&servicioId=&tallerId=&desde=&limite=",
        "GET ?resource=disponibilidad&tallerId=&fecha=&servicioId=",
        "GET ?resource=estado_vehiculo&telefono=|&patente=",
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
  const auth = await requireEmpresa(request);
  if ("response" in auth) return auth.response;
  const { empresa } = auth;

  const idempotencyKey = request.headers.get("idempotency-key");
  const body = await request.json();
  const action = body.action as string;

  try {
    if (action === "crear_turno" && !idempotencyKey) {
      return NextResponse.json(
        { error: "idempotency-key requerido para crear_turno", code: "VALIDATION" },
        { status: 400 }
      );
    }

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
