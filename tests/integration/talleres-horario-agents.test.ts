import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DiaSemana, EstadoTurno, TipoExcepcion } from "@prisma/client";
import { addMinutes, setHours, setMinutes } from "date-fns";
import { NextRequest } from "next/server";
import {
  createTestFixture,
  destroyTestFixture,
  prisma,
  slotAt,
  type TestFixture,
} from "../helpers/fixture";
import { createTurno } from "@/lib/modules/appointments/service";
import { transitionTurnoState } from "@/lib/modules/appointments/service";
import {
  confirmarCambioHorario,
  createTaller,
  previewCambioHorario,
  upsertExcepcion,
} from "@/lib/modules/catalog/taller.service";
import { canonicalWeeklySnapshot } from "@/lib/modules/catalog/franjas";
import { getTallerScheduleForDate, proximosSlots } from "@/lib/modules/availability/service";
import { resolverAtencionVehiculo } from "@/lib/modules/appointments/atencion";
import { GET as agentsGet, POST as agentsPost } from "@/app/api/agents/route";
import { listTalleresForAgents } from "@/lib/modules/catalog/taller-agents";

const apiKey = process.env.AGENT_API_KEY ?? "montironi-agent-api-key-dev";

function weekdaySnapshot(horaFin: string) {
  const weekdays = [
    DiaSemana.lunes,
    DiaSemana.martes,
    DiaSemana.miercoles,
    DiaSemana.jueves,
    DiaSemana.viernes,
  ];
  return canonicalWeeklySnapshot(
    Object.values(DiaSemana).map((dia) => ({
      dia,
      activo: weekdays.includes(dia),
      franjas: weekdays.includes(dia)
        ? [{ horaInicio: "08:00", horaFin }]
        : [],
    }))
  );
}

describe("Talleres · horario · agentes", () => {
  let fx: TestFixture;

  beforeAll(async () => {
    fx = await createTestFixture(`taller-plan-${Date.now()}`);
  });

  afterAll(async () => {
    await destroyTestFixture(fx.empresaId);
    await prisma.$disconnect();
  });

  it("lunes vacío + martes 17:00 + cierre 16:00 → aplicaDesde no es el lunes", async () => {
    const monday = fx.slotInicio;
    const tuesday1730 = setMinutes(setHours(addMinutes(monday, 24 * 60), 17), 0);

    await createTurno({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahiaId,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio: tuesday1730,
      confirmar: true,
    });

    const preview = await previewCambioHorario({
      tallerId: fx.tallerId,
      empresaId: fx.empresaId,
      snapshot: weekdaySnapshot("16:00"),
    });

    const mondayYmd = monday.toISOString().slice(0, 10);
    expect(preview.conflictos.length).toBeGreaterThan(0);
    expect(preview.aplicaDesde).not.toBe(mondayYmd);
    expect(preview.aplicaDesde > mondayYmd).toBe(true);
  });

  it("11:30–13:30 con almuerzo es conflicto", async () => {
    const inicio = setMinutes(setHours(addMinutes(fx.slotInicio, 7 * 24 * 60), 11), 30);
    const turno = await createTurno({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahia2Id,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio,
      confirmar: true,
    });
    await prisma.turno.update({
      where: { id: turno.id },
      data: { finalizaEn: addMinutes(inicio, 120) },
    });

    const snapshot = canonicalWeeklySnapshot(
      Object.values(DiaSemana).map((dia) => ({
        dia,
        activo: dia !== DiaSemana.sabado && dia !== DiaSemana.domingo,
        franjas: [
          { horaInicio: "08:00", horaFin: "12:00" },
          { horaInicio: "13:00", horaFin: "18:00" },
        ],
      }))
    );

    const preview = await previewCambioHorario({
      tallerId: fx.tallerId,
      empresaId: fx.empresaId,
      snapshot,
    });
    expect(preview.conflictos.some((c) => c.id === turno.id)).toBe(true);
  });

  it("snapshot: fecha anterior a aplicaDesde usa el patrón viejo", async () => {
    const taller = await createTaller({
      empresaId: fx.empresaId,
      nombre: "Snapshot Taller",
      bahias: [{ nombre: "B1" }],
    });
    const preview = await previewCambioHorario({
      tallerId: taller.id,
      empresaId: fx.empresaId,
      snapshot: weekdaySnapshot("12:00"),
    });
    expect(preview.conflictos).toHaveLength(0);
    await confirmarCambioHorario({
      tallerId: taller.id,
      empresaId: fx.empresaId,
      snapshot: weekdaySnapshot("12:00"),
      aplicaDesde: preview.aplicaDesde,
      previewHash: preview.previewHash,
    });

    const aplica = new Date(`${preview.aplicaDesde}T12:00:00.000Z`);
    const past = new Date(aplica);
    do {
      past.setUTCDate(past.getUTCDate() - 1);
    } while (past.getUTCDay() === 0 || past.getUTCDay() === 6);
    const before = await getTallerScheduleForDate(taller.id, past);
    const after = await getTallerScheduleForDate(taller.id, aplica);
    const endBefore = Math.max(...before.map((w) => w.fin.getHours() * 60 + w.fin.getMinutes()), 0);
    const endAfter = Math.max(...after.map((w) => w.fin.getHours() * 60 + w.fin.getMinutes()), 0);
    expect(endBefore).toBeGreaterThan(endAfter);
  });

  it("segundo confirmado futuro sin reemplazo falla", async () => {
    const taller = await createTaller({
      empresaId: fx.empresaId,
      nombre: "Un futuro",
      bahias: [{ nombre: "B1" }],
    });
    const late = setMinutes(setHours(addMinutes(fx.slotInicio, 14 * 24 * 60), 16), 0);
    await createTurno({
      empresaId: fx.empresaId,
      tallerId: taller.id,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio: late,
      confirmar: true,
    });
    const snap = weekdaySnapshot("15:00");
    const preview = await previewCambioHorario({
      tallerId: taller.id,
      empresaId: fx.empresaId,
      snapshot: snap,
    });
    expect(preview.aplicaDesde > new Date().toISOString().slice(0, 10)).toBe(true);
    await confirmarCambioHorario({
      tallerId: taller.id,
      empresaId: fx.empresaId,
      snapshot: snap,
      aplicaDesde: preview.aplicaDesde,
      previewHash: preview.previewHash,
    });
    const preview2 = await previewCambioHorario({
      tallerId: taller.id,
      empresaId: fx.empresaId,
      snapshot: weekdaySnapshot("14:00"),
    });
    await expect(
      confirmarCambioHorario({
        tallerId: taller.id,
        empresaId: fx.empresaId,
        snapshot: weekdaySnapshot("14:00"),
        aplicaDesde: preview2.aplicaDesde,
        previewHash: preview2.previewHash,
      })
    ).rejects.toMatchObject({ code: "VersionConflicto" });
  });

  it("taller sin bahía compatible no sale en listado ni slots", async () => {
    const tipo = await prisma.tipoServicio.create({
      data: { empresaId: fx.empresaId, nombre: "Alineación X" },
    });
    const alineacion = await prisma.servicio.create({
      data: {
        empresaId: fx.empresaId,
        tipoServicioId: tipo.id,
        nombre: "Alineación test",
        duracionMin: 60,
        precio: 1,
      },
    });
    const otro = await createTaller({
      empresaId: fx.empresaId,
      nombre: "Sin oferta",
      bahias: [{ nombre: "B-sola" }],
    });
    await prisma.bahiaServicio.deleteMany({
      where: { bahia: { tallerId: otro.id }, servicioId: alineacion.id },
    });
    await prisma.tallerServicio.deleteMany({
      where: { tallerId: otro.id, servicioId: alineacion.id },
    });

    const listed = await listTalleresForAgents({
      empresaId: fx.empresaId,
      servicioId: alineacion.id,
    });
    expect(listed.some((t) => t.id === otro.id)).toBe(false);

    const slots = await proximosSlots({
      empresaId: fx.empresaId,
      servicioId: alineacion.id,
      tallerId: otro.id,
      limite: 5,
    });
    expect(slots).toHaveLength(0);
  });

  it("crear_turno sin bahiaId con 2 bahías libres asigna una", async () => {
    const inicio = slotAt(fx.slotInicio, 90);
    const turno = await createTurno({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio,
      confirmar: true,
    });
    expect(turno.bahiaId).toBeTruthy();
  });

  it("carrera última bahía sin bahiaId: una ok y otra CapacidadConflicto", async () => {
    const inicio = slotAt(fx.slotInicio, 180);
    await createTurno({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahiaId,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio,
      confirmar: true,
    });
    await createTurno({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahia2Id,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio,
      confirmar: true,
    });

    const base = {
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio,
      confirmar: true as const,
    };
    const results = await Promise.allSettled([createTurno(base), createTurno(base)]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const fail = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(fail).toHaveLength(1);
    expect(fail[0].reason.code).toBe("CapacidadConflicto");
  });

  it("estado_vehiculo en_servicio gana sobre historial", async () => {
    const inicio = slotAt(fx.slotInicio, 270);
    const vivo = await createTurno({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahia3Id,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio,
      confirmar: true,
    });
    const recibido = await transitionTurnoState({
      turnoId: vivo.id,
      empresaId: fx.empresaId,
      nuevoEstado: EstadoTurno.recibido,
      version: vivo.version,
    });
    await transitionTurnoState({
      turnoId: vivo.id,
      empresaId: fx.empresaId,
      nuevoEstado: EstadoTurno.en_servicio,
      version: recibido.version,
    });

    const atencion = await resolverAtencionVehiculo({
      empresaId: fx.empresaId,
      clienteId: fx.clienteId,
      patente: (await prisma.vehiculo.findUniqueOrThrow({ where: { id: fx.vehiculoId } }))
        .patente,
    });
    expect(atencion?.multiple).toBe(false);
    if (atencion && atencion.multiple === false) {
      expect(atencion.atencion_actual?.estado).toBe(EstadoTurno.en_servicio);
      expect(atencion.atencion_actual?.tallerId).toBe(fx.tallerId);
      expect(atencion.atencion_actual?.bahiaId).toBe(fx.bahia3Id);
    }
  });

  it("GET agentes talleres y 403 de x-empresa ajeno", async () => {
    const okReq = new NextRequest(
      `http://localhost/api/agents?resource=talleres&servicioId=${fx.servicioId}`,
      { headers: { "x-api-key": apiKey, "x-empresa": fx.empresaSlug } }
    );
    const okRes = await agentsGet(okReq);
    expect(okRes.status).toBe(200);
    const body = (await okRes.json()) as { talleres: { id: string }[] };
    expect(body.talleres.some((t) => t.id === fx.tallerId)).toBe(true);

    const prev = process.env.AGENT_API_EMPRESA;
    process.env.AGENT_API_EMPRESA = "montironi";
    try {
      const forbidden = await agentsGet(
        new NextRequest("http://localhost/api/agents?resource=talleres", {
          headers: { "x-api-key": apiKey, "x-empresa": fx.empresaSlug },
        })
      );
      expect(forbidden.status).toBe(403);
    } finally {
      process.env.AGENT_API_EMPRESA = prev;
    }
  });

  it("crear_turno exige idempotency-key y replaya la misma clave", async () => {
    const inicio = slotAt(fx.slotInicio, 360).toISOString();
    const payload = {
      action: "crear_turno",
      tallerId: fx.tallerId,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio,
      confirmar: true,
    };
    const missing = await agentsPost(
      new NextRequest("http://localhost/api/agents", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "x-empresa": fx.empresaSlug,
        },
        body: JSON.stringify(payload),
      })
    );
    expect(missing.status).toBe(400);

    const headers = {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "x-empresa": fx.empresaSlug,
      "idempotency-key": `k-${fx.empresaId}-turno`,
    };
    const first = await agentsPost(
      new NextRequest("http://localhost/api/agents", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      })
    );
    expect(first.status).toBe(200);
    const replay = await agentsPost(
      new NextRequest("http://localhost/api/agents", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      })
    );
    expect(replay.status).toBe(200);
    const replayBody = (await replay.json()) as { idempotencyReplay?: boolean };
    expect(replayBody.idempotencyReplay).toBe(true);

    const conflict = await agentsPost(
      new NextRequest("http://localhost/api/agents", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...payload, notas: "otra" }),
      })
    );
    expect(conflict.status).toBe(409);
    const conflictBody = (await conflict.json()) as { code?: string };
    expect(conflictBody.code).toBe("IdempotencyConflict");
  });

  it("excepción salva o condena un turno en el preview", async () => {
    const inicio = setMinutes(setHours(addMinutes(fx.slotInicio, 21 * 24 * 60), 17), 0);
    const turno = await createTurno({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahia2Id,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio,
      confirmar: true,
    });

    const corto = weekdaySnapshot("16:00");
    const conflictivo = await previewCambioHorario({
      tallerId: fx.tallerId,
      empresaId: fx.empresaId,
      snapshot: corto,
    });
    expect(conflictivo.conflictos.some((c) => c.id === turno.id)).toBe(true);

    await upsertExcepcion({
      tallerId: fx.tallerId,
      empresaId: fx.empresaId,
      fecha: inicio,
      tipo: TipoExcepcion.horario_especial,
      franjas: [{ horaInicio: "08:00", horaFin: "20:00" }],
    });
    const salvado = await previewCambioHorario({
      tallerId: fx.tallerId,
      empresaId: fx.empresaId,
      snapshot: corto,
    });
    expect(salvado.conflictos.some((c) => c.id === turno.id)).toBe(false);

    await upsertExcepcion({
      tallerId: fx.tallerId,
      empresaId: fx.empresaId,
      fecha: inicio,
      tipo: TipoExcepcion.cerrado,
    });
    const condenado = await previewCambioHorario({
      tallerId: fx.tallerId,
      empresaId: fx.empresaId,
      snapshot: weekdaySnapshot("20:00"),
    });
    expect(condenado.conflictos.some((c) => c.id === turno.id)).toBe(true);
  });

  it("sin turnos activos devuelve el último historial con taller y bahía", async () => {
    const vehiculo = await prisma.vehiculo.create({
      data: {
        empresaId: fx.empresaId,
        patente: `HIS${fx.empresaId.slice(0, 4).toUpperCase()}`,
        kilometrajeActual: 20000,
      },
    });
    await prisma.clienteVehiculo.create({
      data: { clienteId: fx.clienteId, vehiculoId: vehiculo.id, esPrincipal: false },
    });
    const inicio = slotAt(fx.slotInicio, 450);
    const turno = await createTurno({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahia2Id,
      clienteId: fx.clienteId,
      vehiculoId: vehiculo.id,
      servicioIds: [fx.servicioId],
      inicio,
      confirmar: true,
      kilometraje: 20000,
    });
    const recibido = await transitionTurnoState({
      turnoId: turno.id,
      empresaId: fx.empresaId,
      nuevoEstado: EstadoTurno.recibido,
      version: turno.version,
    });
    const enServicio = await transitionTurnoState({
      turnoId: turno.id,
      empresaId: fx.empresaId,
      nuevoEstado: EstadoTurno.en_servicio,
      version: recibido.version,
    });
    await transitionTurnoState({
      turnoId: turno.id,
      empresaId: fx.empresaId,
      nuevoEstado: EstadoTurno.finalizado,
      version: enServicio.version,
    });

    const atencion = await resolverAtencionVehiculo({
      empresaId: fx.empresaId,
      clienteId: fx.clienteId,
      patente: vehiculo.patente,
    });
    expect(atencion?.multiple).toBe(false);
    if (atencion && atencion.multiple === false) {
      expect(atencion.atencion_actual).toBeNull();
      expect(atencion.ultimo_historial?.tallerNombre).toBeTruthy();
      expect(atencion.ultimo_historial?.bahiaNombre).toBeTruthy();
    }
  });

  it("patente de otra empresa no aparece (404)", async () => {
    const other = await createTestFixture(`other-pat-${Date.now()}`);
    try {
      const patente = (
        await prisma.vehiculo.findUniqueOrThrow({ where: { id: fx.vehiculoId } })
      ).patente;
      const atencion = await resolverAtencionVehiculo({
        empresaId: other.empresaId,
        patente,
      });
      expect(atencion).toBeNull();

      const res = await agentsGet(
        new NextRequest(
          `http://localhost/api/agents?resource=estado_vehiculo&patente=${encodeURIComponent(patente)}`,
          { headers: { "x-api-key": apiKey, "x-empresa": other.empresaSlug } }
        )
      );
      expect(res.status).toBe(404);
    } finally {
      await destroyTestFixture(other.empresaId);
    }
  });
});
