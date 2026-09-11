/** E.164: +[1-9] followed by 7–14 digits (ITU-T). */
export const E164_REGEX = /^\+[1-9]\d{7,14}$/;

export function normalizeTelefonoE164(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("+")) {
    throw new ClienteValidationError("El teléfono debe estar en formato E.164 (ej. +5491112345678)");
  }
  if (!E164_REGEX.test(trimmed)) {
    throw new ClienteValidationError("Teléfono inválido — use formato E.164 (+5491112345678)");
  }
  return trimmed;
}

export class ClienteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClienteValidationError";
  }
}

export function assertClienteRequiredFields(params: {
  nombre: string;
  apellido?: string | null;
  telefono?: string | null;
}): { nombre: string; apellido: string; telefono: string } {
  const nombre = params.nombre.trim();
  const apellido = (params.apellido ?? "").trim();
  const telefonoRaw = (params.telefono ?? "").trim();

  if (!nombre) throw new ClienteValidationError("El nombre es obligatorio");
  if (!apellido) throw new ClienteValidationError("El apellido es obligatorio");
  if (!telefonoRaw) throw new ClienteValidationError("El teléfono es obligatorio");

  return { nombre, apellido, telefono: normalizeTelefonoE164(telefonoRaw) };
}
