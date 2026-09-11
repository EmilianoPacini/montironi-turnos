import { describe, it, expect } from "vitest";
import { CanalTurno, EstadoTurno } from "@prisma/client";
import { formatTurnoOrigen } from "@/lib/modules/appointments/format-origen";

describe("formatTurnoOrigen", () => {
  const inicio = new Date("2026-09-11T10:30:00");

  it("muestra creador para turnos del panel", () => {
    expect(
      formatTurnoOrigen({
        canal: CanalTurno.interno,
        estado: EstadoTurno.confirmado,
        inicio,
        creador: { nombre: "María" },
      })
    ).toBe("Panel · María");
  });

  it("muestra vencimiento para WhatsApp pendiente", () => {
    expect(
      formatTurnoOrigen({
        canal: CanalTurno.whatsapp,
        estado: EstadoTurno.pendiente,
        inicio,
      })
    ).toBe("WhatsApp · Vence a las 10:30");
  });

  it("muestra solo canal para otros orígenes", () => {
    expect(
      formatTurnoOrigen({
        canal: CanalTurno.web,
        estado: EstadoTurno.pendiente,
        inicio,
      })
    ).toBe("Web");
  });
});
