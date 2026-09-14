/** Geometría del reloj analógico 24 h (cara tipo alarma). */

export const CLOCK_SIZE = 260;
export const CLOCK_CX = CLOCK_SIZE / 2;
export const CLOCK_CY = CLOCK_SIZE / 2;
export const CLOCK_R_OUTER = 110;
export const CLOCK_R_INNER = 54;
export const CLOCK_R_MINUTES = 110;

export function parseClockValue(value: string): { hour: number; minute: number } {
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  const hour = match ? Math.min(23, Math.max(0, Number(match[1]))) : 8;
  const minute = match ? Math.min(59, Math.max(0, Number(match[2]))) : 0;
  return { hour, minute };
}

export function formatClockValue(hour: number, minute: number): string {
  const h = ((Math.round(hour) % 24) + 24) % 24;
  const m = ((Math.round(minute) % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function clockIndexFromVector(dx: number, dy: number): number {
  let angle = Math.atan2(dy, dx) + Math.PI / 2;
  if (angle < 0) angle += 2 * Math.PI;
  return Math.round((angle / (2 * Math.PI)) * 12) % 12;
}

export function hourFromClockPointer(dx: number, dy: number): number {
  const dist = Math.hypot(dx, dy);
  const index = clockIndexFromVector(dx, dy);
  if (dist >= (CLOCK_R_INNER + CLOCK_R_OUTER) / 2) {
    return index === 0 ? 12 : index + 12;
  }
  return index;
}

export function minuteFromClockPointer(dx: number, dy: number): number {
  return clockIndexFromVector(dx, dy) * 5;
}

export function clockPoint(index: number, radius: number, total = 12): { x: number; y: number } {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return {
    x: CLOCK_CX + radius * Math.cos(angle),
    y: CLOCK_CY + radius * Math.sin(angle),
  };
}

export function hourHandRadius(hour: number): number {
  return hour >= 12 ? CLOCK_R_OUTER : CLOCK_R_INNER;
}

export function hourIndex(hour: number): number {
  return ((hour % 24) + 24) % 24 % 12;
}

export function minuteIndex(minute: number): number {
  return Math.round((((minute % 60) + 60) % 60) / 5) % 12;
}

export function splitDateTimeLocal(value: string): { date: string; time: string } {
  const [date = "", rest = ""] = value.split("T");
  const { hour, minute } = parseClockValue(rest.slice(0, 5) || "09:00");
  return { date, time: formatClockValue(hour, minute) };
}

export function joinDateTimeLocal(date: string, time: string): string {
  const { hour, minute } = parseClockValue(time);
  return `${date}T${formatClockValue(hour, minute)}`;
}
