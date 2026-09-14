import { describe, it, expect } from "vitest";
import { slotsFromFreeWindows, parseTimeOnDate, slotFitsSchedule } from "@/lib/modules/availability/service";
import { startOfDay } from "date-fns";
import { normalizeFranjas } from "@/lib/modules/catalog/franjas";

describe("franjas JSON", () => {
  it("ordena y rechaza solapes", () => {
    const ordered = normalizeFranjas([
      { horaInicio: "13:00", horaFin: "18:00" },
      { horaInicio: "08:00", horaFin: "12:00" },
    ]);
    expect(ordered[0].horaInicio).toBe("08:00");
    expect(normalizeFranjas([{ horaInicio: "08:00:00", horaFin: "12:00:00" }])[0]).toEqual({
      horaInicio: "08:00",
      horaFin: "12:00",
    });
    expect(() =>
      normalizeFranjas([
        { horaInicio: "08:00", horaFin: "12:00" },
        { horaInicio: "11:30", horaFin: "13:00" },
      ])
    ).toThrow(/solap/);
  });
});

describe("slotsFromFreeWindows", () => {
  it("intervalo 30 + duración 60 + cierre 12:00 no emite 11:30", () => {
    const day = startOfDay(new Date("2026-09-21T00:00:00"));
    const windows = [
      { inicio: parseTimeOnDate(day, "08:00"), fin: parseTimeOnDate(day, "12:00") },
    ];
    const slots = slotsFromFreeWindows(windows, 60, 30);
    const labels = slots.map((s) => s.inicio.toISOString());
    expect(slots.some((s) => s.inicio.getHours() === 11 && s.inicio.getMinutes() === 30)).toBe(
      false
    );
    expect(slots.length).toBeGreaterThan(0);
    expect(labels.length).toBe(slots.length);
  });
});

describe("slotFitsSchedule", () => {
  it("un intervalo que cruza el almuerzo no cabe en ninguna franja", () => {
    const day = startOfDay(new Date("2026-09-21T00:00:00"));
    const schedule = [
      { inicio: parseTimeOnDate(day, "08:00"), fin: parseTimeOnDate(day, "12:00") },
      { inicio: parseTimeOnDate(day, "13:00"), fin: parseTimeOnDate(day, "18:00") },
    ];
    const inicio = parseTimeOnDate(day, "11:30");
    const fin = parseTimeOnDate(day, "13:30");
    expect(slotFitsSchedule(schedule, inicio, fin)).toBe(false);
  });
});
