import { describe, expect, it } from "vitest";
import {
  CLOCK_R_INNER,
  CLOCK_R_OUTER,
  formatClockValue,
  hourFromClockPointer,
  joinDateTimeLocal,
  minuteFromClockPointer,
  parseClockValue,
  splitDateTimeLocal,
} from "@/lib/time/clock-picker";

describe("reloj analogico", () => {
  it("normaliza HH:mm", () => {
    expect(parseClockValue("8:05")).toEqual({ hour: 8, minute: 5 });
    expect(formatClockValue(8, 5)).toBe("08:05");
  });

  it("el anillo interno de las 12 es 00:00 y el externo 12:00", () => {
    expect(hourFromClockPointer(0, -CLOCK_R_INNER)).toBe(0);
    expect(hourFromClockPointer(0, -CLOCK_R_OUTER)).toBe(12);
  });

  it("las 3 en punto son 03 interno y 15 externo", () => {
    expect(hourFromClockPointer(CLOCK_R_INNER, 0)).toBe(3);
    expect(hourFromClockPointer(CLOCK_R_OUTER, 0)).toBe(15);
  });

  it("los minutos van de a 5", () => {
    expect(minuteFromClockPointer(0, -CLOCK_R_OUTER)).toBe(0);
    expect(minuteFromClockPointer(CLOCK_R_OUTER, 0)).toBe(15);
    expect(minuteFromClockPointer(0, CLOCK_R_OUTER)).toBe(30);
  });

  it("arma datetime-local sin segundos", () => {
    expect(splitDateTimeLocal("2026-09-21T08:30:00")).toEqual({
      date: "2026-09-21",
      time: "08:30",
    });
    expect(joinDateTimeLocal("2026-09-21", "8:30")).toBe("2026-09-21T08:30");
  });
});
