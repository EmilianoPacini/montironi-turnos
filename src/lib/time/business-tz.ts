/** Zona de negocio Montironi (sin DST). */

export const BUSINESS_TZ = "America/Argentina/Mendoza";
export const SYSTEM_HORIZON_DAYS = 90;

export function businessYmd(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Medianoche UTC del día de calendario local (alineado a Prisma @db.Date). */
export function dateOnlyUtc(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

export function parseYmdToDateOnly(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDaysUtcDateOnly(date: Date, days: number): Date {
  const next = new Date(dateOnlyUtc(date));
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function ymdFromDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
