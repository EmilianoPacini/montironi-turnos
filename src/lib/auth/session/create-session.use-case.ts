import { SESSION_ABSOLUTE_TTL_MS } from "./constants";
import type { CreateSessionInput } from "./types";
import { insertSesion } from "./repository";

export async function createServerSession(input: CreateSessionInput) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_TTL_MS);

  const sesion = await insertSesion({
    usuarioId: input.usuarioId,
    empresaId: input.empresaId,
    expiresAt,
    userAgent: input.userAgent ?? null,
    ip: input.ip ?? null,
  });

  return { sessionId: sesion.id, expiresAt };
}
