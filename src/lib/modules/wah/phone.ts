/** Normalize phone to E.164-ish (+digits). */
export function normalizeContactPhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `+${digits.slice(1).replace(/\D/g, "")}`;
  const only = digits.replace(/\D/g, "");
  if (only.startsWith("54")) return `+${only}`;
  if (only.startsWith("9") && only.length >= 10) return `+54${only}`;
  return `+${only}`;
}

export function toWaContactId(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

export function previewText(text: string, max = 120): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1)}…`;
}
