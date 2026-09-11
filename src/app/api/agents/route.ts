import { NextRequest, NextResponse } from "next/server";
import { validateAgentApiKey, withIdempotency, getEmpresaBySlug } from "@/lib/modules/agents-api/idempotency";
import { listServicios } from "@/lib/modules/catalog/service";
import { getAvailabilityForDate } from "@/lib/modules/availability/service";
import {
  createTurno,
  getTurnoById,
  cancelTurno,
  rescheduleTurno,
  assertNotPastInicio,
  isDomainError,
  httpStatusForDomainError,
} from "@/lib/modules/appointments/service";
import { upsertCliente, upsertVehiculo, getClienteContext } from "@/lib/modules/customers/service";
import { clasificarCliente, serializePerfilBuyer } from "@/lib/modules/buyer/service";
import { ClienteValidationError } from "@/lib/modules/customers/validation";
import { CanalTurno } from "@prisma/client";

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

function resolveCanal(body: { canal?: string; origen?: string }): CanalTurno {
  const raw = body.canal ?? body.origen;
  if (raw && Object.values(CanalTurno).includes(raw as CanalTurno)) {
    return raw as CanalTurno;
  }
  const legacyMap: Record<string, CanalTurno> = {
    panel: CanalTurno.interno,
    voz: CanalTurno.telefono,
    api: CanalTurno.agente_ia,
  };
  if (raw && legacyMap[raw]) {
    return legacyMap[raw];
  }
  return CanalTurno.agente_ia;
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
    const handler = async () => {
      switch (action) {
        case "crear_turno": {
          const inicio = new Date(body.inicio);
          assertNotPastInicio(inicio);
          const turno = await createTurno({
            empresaId: empresa.id,
            tallerId: body.tallerId,
            bahiaId: body.bahiaId,
            clienteId: body.clienteId,
            vehiculoId: body.vehiculoId,
            servicioIds: body.servicioIds,
            inicio,
            canal: resolveCanal(body),
            notas: body.notas,
            confirmar: body.confirmar ?? true,
          });
          return { turno };
        }
        case "cancelar_turno": {
          const turno = await cancelTurno({
            turnoId: body.turnoId,
            empresaId: empresa.id,
            version: body.version,
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
          return { cliente: { id: cliente.id, nombre: cliente.nombre, apellido: cliente.apellido, telefono: cliente.telefono } };
        }
        case "upsert_vehiculo": {
          const vehiculo = await upsertVehiculo({
            empresaId: empresa.id,
            patente: body.patente,
            marca: body.marca,
            modelo: body.modelo,
            anio: body.anio,
            color: body.color,
            tipoVehiculo: body.tipoVehiculo,
            condicion: body.condicion,
            kilometrajeActual: body.kilometrajeActual,
            clienteId: body.clienteId,
          });
          return { vehiculo };
        }
        case "clasificar_cliente": {
          if (!body.clienteId || !body.clasificacion) {
            throw new Error("clienteId y clasificacion requeridos");
          }
          const { perfil, evento } = await clasificarCliente({
            empresaId: empresa.id,
            clienteId: body.clienteId,
            clasificacion: body.clasificacion,
            intencion: body.intencion,
            tagsDelta: body.tagsDelta,
            scoreReclamosDelta: body.scoreReclamosDelta,
            wahConversationId: body.wahConversationId,
            wahMessageId: body.wahMessageId,
            fuente: body.fuente ?? "integracion",
            payload: body.payload,
          });
          return {
            perfil: serializePerfilBuyer(perfil),
            evento: {
              id: evento.id,
              clasificacion: evento.clasificacion,
              intencion: evento.intencion,
              createdAt: evento.createdAt.toISOString(),
            },
          };
        }
        default:
          throw new Error("Acción no soportada");
      }
    };

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
