import { DiaSemana } from "@prisma/client";

export type FranjaJson = { horaInicio: string; horaFin: string };

export type DiaHorarioSnapshot = {
  dia: DiaSemana;
  activo: boolean;
  franjas: FranjaJson[];
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function toHhMm(raw: string): string {
  const match = String(raw).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return String(raw).trim();
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = toHhMm(hhmm).split(":").map(Number);
  return h * 60 + m;
}

export function normalizeFranjas(input: unknown): FranjaJson[] {
  if (!Array.isArray(input)) {
    throw new Error("Las franjas deben ser una lista");
  }
  const parsed: FranjaJson[] = input.map((raw, index) => {
    if (!raw || typeof raw !== "object") {
      throw new Error(`Franja ${index + 1} inválida`);
    }
    const row = raw as Record<string, unknown>;
    const horaInicio = toHhMm(String(row.horaInicio ?? row.desde ?? ""));
    const horaFin = toHhMm(String(row.horaFin ?? row.hasta ?? ""));
    if (!TIME_RE.test(horaInicio) || !TIME_RE.test(horaFin)) {
      throw new Error(`Franja ${index + 1}: usá HH:mm`);
    }
    if (timeToMinutes(horaInicio) >= timeToMinutes(horaFin)) {
      throw new Error(`Franja ${index + 1}: el inicio debe ser anterior al fin`);
    }
    return { horaInicio, horaFin };
  });

  const ordered = [...parsed].sort(
    (a, b) => timeToMinutes(a.horaInicio) - timeToMinutes(b.horaInicio)
  );
  for (let i = 1; i < ordered.length; i += 1) {
    if (timeToMinutes(ordered[i].horaInicio) < timeToMinutes(ordered[i - 1].horaFin)) {
      throw new Error("Las franjas no pueden solaparse");
    }
  }
  return ordered;
}

export function franjasFromLegacy(
  horaInicio?: string | null,
  horaFin?: string | null
): FranjaJson[] {
  if (!horaInicio || !horaFin) return [];
  return normalizeFranjas([{ horaInicio, horaFin }]);
}

export function canonicalWeeklySnapshot(dias: DiaHorarioSnapshot[]): DiaHorarioSnapshot[] {
  const byDia = new Map(dias.map((d) => [d.dia, d]));
  return Object.values(DiaSemana).map((dia) => {
    const existing = byDia.get(dia);
    if (!existing) {
      return { dia, activo: false, franjas: [] };
    }
    return {
      dia,
      activo: existing.activo && existing.franjas.length > 0,
      franjas: existing.activo ? normalizeFranjas(existing.franjas) : [],
    };
  });
}
