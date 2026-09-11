import { describe, it, expect } from "vitest";
import {
  E164_REGEX,
  normalizeTelefonoE164,
  assertClienteRequiredFields,
  ClienteValidationError,
} from "@/lib/modules/customers/validation";
import {
  assertNotPastInicio,
  PAST_SLOT_MESSAGE,
} from "@/lib/modules/appointments/service";
import {
  canTransition,
  isTerminalEstado,
} from "@/lib/modules/appointments/constants";
import { EstadoTurno } from "@prisma/client";
import { DomainError } from "@/lib/modules/appointments/errors";
import { calcularProximoServicioKm } from "@/lib/modules/catalog/intervalo.service";

describe("V1.1 · E.164", () => {
  it("acepta teléfono E.164 válido", () => {
    expect(E164_REGEX.test("+5491112345678")).toBe(true);
    expect(normalizeTelefonoE164("+5491112345678")).toBe("+5491112345678");
  });

  it("rechaza teléfono sin + o formato inválido", () => {
    expect(() => normalizeTelefonoE164("5491112345678")).toThrow(ClienteValidationError);
    expect(() => normalizeTelefonoE164("+5411")).toThrow(ClienteValidationError);
  });

  it("requiere nombre, apellido y teléfono", () => {
    expect(() => assertClienteRequiredFields({ nombre: "A", apellido: "", telefono: "+5491112345678" })).toThrow();
  });
});

describe("V1.1 · Horario vencido", () => {
  it("rechaza inicio en el pasado con mensaje exacto", () => {
    const past = new Date(Date.now() - 60_000);
    try {
      assertNotPastInicio(past);
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).message).toBe(PAST_SLOT_MESSAGE);
      expect((e as DomainError).code).toBe("HorarioVencido");
    }
  });
});

describe("V1.1 · FSM terminales", () => {
  it("estados terminales no transicionan a activos", () => {
    for (const terminal of [
      EstadoTurno.cancelado,
      EstadoTurno.finalizado,
      EstadoTurno.vencido,
    ]) {
      expect(isTerminalEstado(terminal)).toBe(true);
      expect(canTransition(terminal, EstadoTurno.en_servicio)).toBe(false);
      expect(canTransition(terminal, EstadoTurno.pendiente)).toBe(false);
    }
  });

  it("finalizado no va a pendiente", () => {
    expect(canTransition(EstadoTurno.finalizado, EstadoTurno.pendiente)).toBe(false);
  });
});

describe("V1.1 · Intervalos km", () => {
  it("calcularProximoServicioKm retorna null sin intervalo en DB", async () => {
    const result = await calcularProximoServicioKm({
      servicioId: "00000000-0000-0000-0000-000000000001",
      tipoVehiculo: "auto",
      condicion: "normal",
      kilometrajeActual: 50000,
    });
    expect(result).toBeNull();
  });
});
