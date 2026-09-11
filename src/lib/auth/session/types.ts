import type { RolUsuario } from "@prisma/client";

/** Encrypted iron-session cookie payload — opaque session id only. */
export interface CookieSessionData {
  sessionId?: string;
}

/** Resolved authenticated session loaded from DB (source of truth for rol/tenancy). */
export interface AuthSession {
  sessionId: string;
  userId: string;
  empresaId: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
  isLoggedIn: true;
}

export interface CreateSessionInput {
  usuarioId: string;
  empresaId: string;
  userAgent?: string | null;
  ip?: string | null;
}

export interface ValidateSessionOptions {
  /** Update lastSeenAt on successful validation (sliding idle). Default true. */
  touch?: boolean;
  /** Revoke session row when expired/idle/revoked on read. Default true. */
  revokeOnFailure?: boolean;
}
