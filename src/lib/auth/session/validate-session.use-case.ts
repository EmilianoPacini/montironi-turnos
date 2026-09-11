import { SESSION_IDLE_TIMEOUT_MS } from "./constants";
import type { AuthSession, ValidateSessionOptions } from "./types";
import { findSesionById, revokeSesionById, touchSesionLastSeen } from "./repository";

export class SessionInvalidError extends Error {
  constructor(message = "UNAUTHORIZED") {
    super(message);
    this.name = "SessionInvalidError";
  }
}

function isIdleExpired(lastSeenAt: Date, now: Date): boolean {
  return now.getTime() - lastSeenAt.getTime() >= SESSION_IDLE_TIMEOUT_MS;
}

function isAbsoluteExpired(expiresAt: Date, now: Date): boolean {
  return now.getTime() >= expiresAt.getTime();
}

export async function validateServerSession(
  sessionId: string,
  options: ValidateSessionOptions = {}
): Promise<AuthSession> {
  const { touch = true, revokeOnFailure = true } = options;
  const now = new Date();

  const sesion = await findSesionById(sessionId);
  if (!sesion) {
    throw new SessionInvalidError();
  }

  const failureReason =
    sesion.revokedAt !== null
      ? "revoked"
      : isAbsoluteExpired(sesion.expiresAt, now)
        ? "absolute_ttl"
        : isIdleExpired(sesion.lastSeenAt, now)
          ? "idle"
          : !sesion.usuario.activo
            ? "usuario_inactivo"
            : sesion.usuario.empresaId !== sesion.empresaId
              ? "tenancy_mismatch"
              : null;

  if (failureReason) {
    if (revokeOnFailure && sesion.revokedAt === null) {
      await revokeSesionById(sessionId, now);
    }
    throw new SessionInvalidError();
  }

  if (touch) {
    await touchSesionLastSeen(sessionId, now);
  }

  const { usuario } = sesion;

  return {
    sessionId: sesion.id,
    userId: usuario.id,
    empresaId: sesion.empresaId,
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol,
    isLoggedIn: true,
  };
}
