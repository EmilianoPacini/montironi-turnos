import { NextRequest } from "next/server";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EstadoTurno } from "@prisma/client";
import { GET as agentsContextGet } from "@/app/api/agents/context/route";
import { POST as clasificarPost } from "@/app/api/v1/clientes/[id]/clasificaciones/route";
import { POST as agentsPost } from "@/app/api/agents/route";
import {
  transitionTurnoState,
  crearTurnoPendiente,
} from "@/lib/modules/appointments/service";
import { backfillHistorialFromFinalizados, upsertHistorialDesdeTurnoFinalizado } from "@/lib/modules/historial/service";
import { clasificarCliente } from "@/lib/modules/buyer/service";
import { getClienteContext } from "@/lib/modules/customers/service";
import {
  createTestFixture,
  destroyTestFixture,
  prisma,
  slotAt,
  type TestFixture,
} from "../helpers/fixture";

const AGENT_KEY = "test-agent-api-key-historial";

async function finalizarTurno(fx: TestFixture, kilometraje = 42000) {
  const inicio = slotAt(fx.slotInicio, 180);
  let turno = await crearTurnoPendiente({
    empresaId: fx.empresaId,
    tallerId: fx.tallerId,
    bahiaId: fx.bahiaId,
    clienteId: fx.clienteId,
    vehiculoId: fx.vehiculoId,
    servicioIds: [fx.servicioId],
    inicio,
    kilometraje,
  });

  for (const estado of [
    EstadoTurno.confirmado,
    EstadoTurno.recibido,
    EstadoTurno.en_servicio,
  ] as const) {
    turno = await transitionTurnoState({
      turnoId: turno.id,
      empresaId: fx.empresaId,
      nuevoEstado: estado,
      version: turno.version,
    });
  }

  await transitionTurnoState({
    turnoId: turno.id,
    empresaId: fx.empresaId,
    nuevoEstado: EstadoTurno.finalizado,
    version: turno.version,
  });

  return turno;
}

describe("Historial + Buyer · DDL 007", () => {
  let fx: TestFixture;

  beforeAll(async () => {
    process.env.AGENT_API_KEY = AGENT_KEY;
    fx = await createTestFixture(`hist-buyer-${Date.now()}`);
  });

  afterAll(async () => {
    await destroyTestFixture(fx.empresaId);
    await prisma.$disconnect();
  });

  it("finalizar turno → historial_servicio por detalle (upsert)", async () => {
    const turno = await finalizarTurno(fx, 55000);
    const detalles = await prisma.detalleTurno.findMany({ where: { turnoId: turno.id } });
    expect(detalles.length).toBeGreaterThan(0);

    const historial = await prisma.historialServicio.findMany({ where: { turnoId: turno.id } });
    expect(historial).toHaveLength(detalles.length);
    expect(historial[0]?.kilometrajeKm).toBe(55000);
    expect(historial[0]?.servicioNombre).toBeTruthy();

    await upsertHistorialDesdeTurnoFinalizado(turno.id);
    const countAfter = await prisma.historialServicio.count({ where: { turnoId: turno.id } });
    expect(countAfter).toBe(detalles.length);
  });

  it("GET /api/agents/context incluye historial + buyer cuando existen", async () => {
    await finalizarTurno(fx, 56000);
    await clasificarCliente({
      empresaId: fx.empresaId,
      clienteId: fx.clienteId,
      clasificacion: "vip",
      intencion: "service",
      tagsDelta: ["fiel"],
      fuente: "bot",
    });

    const res = await agentsContextGet(
      new NextRequest(
        `http://localhost/api/agents/context?cliente_id=${fx.clienteId}`,
        { headers: { "x-api-key": AGENT_KEY, "x-empresa": fx.empresaSlug } }
      )
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.historial_services?.length).toBeGreaterThan(0);
    expect(json.ultimosServices?.length).toBeGreaterThan(0);
    expect(json.buyer_profile?.ultimaClasificacion).toBe("vip");
    expect(json.perfilBuyer?.tags).toContain("fiel");
    expect(json.turnos.programados).toBeDefined();
    expect(json.meta.partial).toBe(false);
  });

  it("clasificar actualiza cliente_perfil_buyer (v1 + agents action)", async () => {
    const v1Res = await clasificarPost(
      new NextRequest(`http://localhost/api/v1/clientes/${fx.clienteId}/clasificaciones`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": AGENT_KEY,
          "x-empresa": fx.empresaSlug,
        },
        body: JSON.stringify({
          clasificacion: "reclamo",
          tagsDelta: ["urgente"],
          scoreReclamosDelta: 2,
        }),
      }),
      { params: Promise.resolve({ id: fx.clienteId }) }
    );
    expect(v1Res.status).toBe(200);
    const v1Json = await v1Res.json();
    expect(v1Json.perfil.scoreReclamos).toBeGreaterThanOrEqual(2);
    expect(v1Json.perfil.tags).toContain("urgente");

    const agentsRes = await agentsPost(
      new NextRequest("http://localhost/api/agents", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": AGENT_KEY,
          "x-empresa": fx.empresaSlug,
        },
        body: JSON.stringify({
          action: "clasificar_cliente",
          clienteId: fx.clienteId,
          clasificacion: "neutral",
          tagsDelta: ["n8n"],
        }),
      })
    );
    expect(agentsRes.status).toBe(200);
    const agentsJson = await agentsRes.json();
    expect(agentsJson.perfil.tags).toContain("n8n");
  });

  it("backfill historial es idempotente", async () => {
    await finalizarTurno(fx, 57000);
    const first = await backfillHistorialFromFinalizados({ empresaId: fx.empresaId });
    const second = await backfillHistorialFromFinalizados({ empresaId: fx.empresaId });
    expect(first.processed).toBeGreaterThan(0);
    expect(second.skipped).toBeGreaterThanOrEqual(first.inserted);
    expect(second.inserted).toBe(0);
  });

  it("getClienteContext expone _context con historial", async () => {
    const ctx = await getClienteContext({ empresaId: fx.empresaId, id: fx.clienteId });
    expect(ctx?._context?.historial_services?.length).toBeGreaterThan(0);
  });
});
