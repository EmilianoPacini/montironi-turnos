import { sealData } from "iron-session";
import { RolUsuario } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { sessionOptions } from "@/lib/auth/session/index";
import { createServerSession } from "@/lib/auth/session/create-session.use-case";
import { cookieStore } from "../setup";
import { prisma } from "./fixture";

export async function createTestUsuario(
  empresaId: string,
  suffix: string,
  rol: RolUsuario = RolUsuario.empleado
) {
  const passwordHash = await hashPassword("testpass123");
  return prisma.usuario.create({
    data: {
      empresaId,
      email: `session-${suffix}@example.com`,
      nombre: `Session User ${suffix}`,
      passwordHash,
      rol,
      activo: true,
    },
  });
}

export async function createTestServerSession(
  usuarioId: string,
  empresaId: string,
  metadata?: { userAgent?: string; ip?: string }
) {
  return createServerSession({
    usuarioId,
    empresaId,
    userAgent: metadata?.userAgent ?? "vitest",
    ip: metadata?.ip ?? "127.0.0.1",
  });
}

export async function bindSessionCookie(sessionId: string) {
  const sealed = await sealData({ sessionId }, sessionOptions);
  cookieStore.set(sessionOptions.cookieName, sealed);
}

export function clearSessionCookie() {
  cookieStore.clear();
}

export async function seedAuthenticatedCookie(usuarioId: string, empresaId: string) {
  const { sessionId } = await createTestServerSession(usuarioId, empresaId);
  await bindSessionCookie(sessionId);
  return sessionId;
}
