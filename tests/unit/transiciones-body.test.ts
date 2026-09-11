import { describe, it, expect } from "vitest";
import { EstadoTurno } from "@prisma/client";
import { parseTransicionEstado } from "@/lib/modules/agenda/api/http";

describe("POST /transiciones body — estado vs nuevoEstado", () => {
  it("acepta estado (canónico)", () => {
    expect(parseTransicionEstado({ estado: EstadoTurno.recibido })).toBe(
      EstadoTurno.recibido
    );
  });

  it("acepta nuevoEstado como alias", () => {
    expect(parseTransicionEstado({ nuevoEstado: EstadoTurno.finalizado })).toBe(
      EstadoTurno.finalizado
    );
  });

  it("prioriza estado si vienen ambos", () => {
    expect(
      parseTransicionEstado({
        estado: EstadoTurno.recibido,
        nuevoEstado: EstadoTurno.cancelado,
      })
    ).toBe(EstadoTurno.recibido);
  });
});
