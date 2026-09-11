import type { DomainErrorCode } from "@/lib/modules/appointments/errors";

/** Maps ClienteValidationError messages to form field names. */
export function fieldForClienteValidation(message: string): string | undefined {
  const lower = message.toLowerCase();
  if (lower.includes("teléfono") || lower.includes("telefono")) return "telefono";
  if (lower.includes("nombre")) return "nombre";
  if (lower.includes("apellido")) return "apellido";
  if (lower.includes("documento")) return "documento";
  if (lower.includes("patente")) return "patente";
  return undefined;
}

export function fieldErrorsForClienteValidation(
  message: string
): Partial<Record<string, string>> | undefined {
  const field = fieldForClienteValidation(message);
  return field ? { [field]: message } : undefined;
}

export function fieldForVehiculoValidation(message: string): string | undefined {
  const lower = message.toLowerCase();
  if (lower.includes("patente")) return "patente";
  if (lower.includes("kilometraje") || lower.includes("km")) return "kilometrajeActual";
  return undefined;
}

export function fieldErrorsForVehiculoValidation(
  message: string
): Partial<Record<string, string>> | undefined {
  const field = fieldForVehiculoValidation(message);
  return field ? { [field]: message } : undefined;
}

export function fieldErrorsForTurnoDomainError(
  code: DomainErrorCode,
  message: string
): Partial<Record<string, string>> | undefined {
  switch (code) {
    case "HorarioVencido":
      return { fecha: message, hora: message };
    case "CapacidadConflicto":
    case "FueraDeHorario":
      return { fecha: message, hora: message };
    case "BahiaIncompatible":
      return { bahiaId: message };
    default:
      return undefined;
  }
}

export function focusFieldForTurnoDomainError(code: DomainErrorCode): string | undefined {
  switch (code) {
    case "HorarioVencido":
    case "CapacidadConflicto":
    case "FueraDeHorario":
      return "fecha";
    case "BahiaIncompatible":
      return "bahiaId";
    default:
      return undefined;
  }
}

export function fieldErrorsForReprogramarDomainError(
  code: DomainErrorCode,
  message: string
): Partial<Record<string, string>> | undefined {
  switch (code) {
    case "HorarioVencido":
    case "CapacidadConflicto":
    case "FueraDeHorario":
    case "TurnoNoReprogramable":
      return { inicio: message };
    case "BahiaIncompatible":
      return { bahiaId: message };
    default:
      return undefined;
  }
}

export function focusFieldForReprogramarDomainError(code: DomainErrorCode): string | undefined {
  switch (code) {
    case "BahiaIncompatible":
      return "bahiaId";
    case "HorarioVencido":
    case "CapacidadConflicto":
    case "FueraDeHorario":
    case "TurnoNoReprogramable":
      return "inicio";
    default:
      return undefined;
  }
}

export function fieldErrorsForBloquearDomainError(
  code: DomainErrorCode,
  message: string
): Partial<Record<string, string>> | undefined {
  switch (code) {
    case "BloqueoInvalido":
      return { motivo: message };
    case "CapacidadConflicto":
    case "FueraDeHorario":
      return { inicio: message, fin: message };
    default:
      return undefined;
  }
}

export function focusFieldForBloquearDomainError(code: DomainErrorCode): string | undefined {
  switch (code) {
    case "BloqueoInvalido":
      return "motivo";
    case "CapacidadConflicto":
    case "FueraDeHorario":
      return "inicio";
    default:
      return undefined;
  }
}

export function invalidFieldClass(
  field: string,
  baseClass: string,
  fieldErrors?: Partial<Record<string, string>>
): string {
  if (!fieldErrors?.[field]) return baseClass;
  return `${baseClass} border-red-500 ring-2 ring-red-200 focus:border-red-500 focus:ring-red-200`;
}
