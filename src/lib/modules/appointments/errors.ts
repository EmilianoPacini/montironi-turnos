export type DomainErrorCode =
  | "CapacidadConflicto"
  | "TransicionInvalida"
  | "VersionConflicto"
  | "BahiaIncompatible"
  | "FueraDeHorario"
  | "BloqueoInvalido"
  | "TurnoNoReprogramable"
  | "RecursoNoEncontrado"
  | "IdempotencyReplay";

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: DomainErrorCode
  ) {
    super(message);
    this.name = "DomainError";
  }
}

/** Backward-compatible alias used across the app layer. */
export class AppointmentError extends DomainError {}

export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}

export function httpStatusForDomainError(code: DomainErrorCode): number {
  switch (code) {
    case "RecursoNoEncontrado":
      return 404;
    case "VersionConflicto":
      return 409;
    case "TransicionInvalida":
    case "TurnoNoReprogramable":
      return 422;
    case "IdempotencyReplay":
      return 200;
    default:
      return 409;
  }
}
