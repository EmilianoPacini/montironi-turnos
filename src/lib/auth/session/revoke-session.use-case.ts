import { revokeAllSesionesForUsuario, revokeSesionById } from "./repository";

export async function revokeServerSession(sessionId: string) {
  const now = new Date();
  await revokeSesionById(sessionId, now);
}

export async function revokeAllUserSessions(usuarioId: string) {
  const now = new Date();
  const result = await revokeAllSesionesForUsuario(usuarioId, now);
  return result.count;
}

/** Call when usuario.activo is set to false. */
export async function revokeSessionsOnUserDeactivated(usuarioId: string) {
  return revokeAllUserSessions(usuarioId);
}

/** Call when usuario password hash changes. */
export async function revokeSessionsOnPasswordChange(usuarioId: string) {
  return revokeAllUserSessions(usuarioId);
}

/** Call when usuario.rol changes. */
export async function revokeSessionsOnRoleChange(usuarioId: string) {
  return revokeAllUserSessions(usuarioId);
}
