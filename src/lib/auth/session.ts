import { redirect } from "next/navigation";
import { RolUsuario } from "@prisma/client";
import { assertPanelAccess } from "@/lib/auth/access";
import {
  clearCookieSession,
  getCookieSession,
  readCookieSessionId,
  sessionOptions,
  validateServerSession,
  type AuthSession,
} from "@/lib/auth/session/index";

export type { AuthSession as SessionData } from "@/lib/auth/session/index";
export { sessionOptions };

export async function getSession() {
  return getCookieSession();
}

async function resolveAuthSession(): Promise<AuthSession> {
  const sessionId = await readCookieSessionId();
  if (!sessionId) {
    throw new Error("UNAUTHORIZED");
  }
  try {
    return await validateServerSession(sessionId);
  } catch {
    throw new Error("UNAUTHORIZED");
  }
}

export async function requireSession(): Promise<AuthSession> {
  return resolveAuthSession();
}

export async function requireAdmin(): Promise<AuthSession> {
  const session = await requireSession();
  assertPanelAccess({ rol: session.rol, roles: [RolUsuario.admin] });
  return session;
}

export async function getAuthSession(): Promise<AuthSession> {
  try {
    return await resolveAuthSession();
  } catch {
    redirect("/login");
  }
}

export async function destroyClientSession() {
  await clearCookieSession();
}
