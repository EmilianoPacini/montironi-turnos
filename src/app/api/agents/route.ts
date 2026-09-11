import { NextRequest, NextResponse } from "next/server";
import { validateAgentApiKey, withIdempotency, getEmpresaBySlug } from "@/lib/modules/agents-api/idempotency";
import { listServicios } from "@/lib/modules/catalog/service";
import { getAvailabilityForDate } from "@/lib/modules/availability/service";
import {
  createTurno,
  getTurnoById,
  cancelTurno,
  rescheduleTurno,
  AppointmentError,
} from "@/lib/modules/appointments/service";
import { upsertCliente, upsertVehiculo } from "@/lib/modules/customers/service";
import { OrigenTurno } from "@prisma/client";

function unauthorized() {
  return NextResponse.json({ error: "No autorizado" }, { status: 401 });
}

function errorResponse(e: unknown) {
  if (e instanceof AppointmentError) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: 409 });
  }
  if (e instanceof Error && e.message === "IDEMPOTENCY_KEY_REUSED") {
    return NextResponse.json({ error: "Clave idempotente reutilizada con distinta solicitud" }, { status: 422 });
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

    return NextResponse.json({
      endpoints: [
        "GET ?resource=servicios",
        "GET ?resource=disponibilidad&tallerId=&fecha=&servicioId=",
        "GET ?resource=turno&id=",
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
    const handler = async () => {
      switch (action) {
        case "crear_turno": {
          const turno = await createTurno({
            empresaId: empresa.id,
            tallerId: body.tallerId,
            bahiaId: body.bahiaId,
            clienteId: body.clienteId,
            vehiculoId: body.vehiculoId,
            servicioIds: body.servicioIds,
            inicio: new Date(body.inicio),
            origen: (body.origen as OrigenTurno) ?? OrigenTurno.api,
            notas: body.notas,
            confirmar: body.confirmar ?? true,
            agenteIaId: body.agenteIaId,
          });
          return { turno };
        }
        case "cancelar_turno": {
          const turno = await cancelTurno({
            turnoId: body.turnoId,
            empresaId: empresa.id,
            version: body.version,
            agenteIaId: body.agenteIaId,
            motivo: body.motivo,
          });
          return { turno };
        }
        case "reprogramar_turno": {
          const turno = await rescheduleTurno({
            turnoId: body.turnoId,
            empresaId: empresa.id,
            bahiaId: body.bahiaId,
            inicio: new Date(body.inicio),
            version: body.version,
            agenteIaId: body.agenteIaId,
          });
          return { turno };
        }
        case "upsert_cliente": {
          const cliente = await upsertCliente({
            empresaId: empresa.id,
            id: body.id,
            nombre: body.nombre,
            apellido: body.apellido,
            email: body.email,
            telefono: body.telefono,
            documento: body.documento,
          });
          return { cliente };
        }
        case "upsert_vehiculo": {
          const vehiculo = await upsertVehiculo({
            empresaId: empresa.id,
            patente: body.patente,
            marca: body.marca,
            modelo: body.modelo,
            anio: body.anio,
            color: body.color,
            clienteId: body.clienteId,
          });
          return { vehiculo };
        }
        default:
          throw new Error("Acción no soportada");
      }
    };

    if (idempotencyKey) {
      const result = await withIdempotency({
        empresaId: empresa.id,
        idempotencyKey,
        operation: action,
        requestBody: body,
        handler,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json(await handler());
  } catch (e) {
    return errorResponse(e);
  }
}
