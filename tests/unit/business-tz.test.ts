import { describe, it, expect } from "vitest";
import {
  addDaysUtcDateOnly,
  parseYmdToDateOnly,
  ymdFromDateOnly,
} from "@/lib/time/business-tz";

describe("fechas de negocio (date-only UTC)", () => {
  it("el día siguiente de un turno a las 16:00 local no vuelve al mismo YMD", () => {
    const inicio = new Date("2026-10-05T19:00:00.000Z");
    const aplicaDesde = addDaysUtcDateOnly(inicio, 1);
    expect(ymdFromDateOnly(aplicaDesde)).toBe("2026-10-06");
    expect(parseYmdToDateOnly("2026-10-06").getTime()).toBe(aplicaDesde.getTime());
  });
});
