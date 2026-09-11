"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { destroyClientSession } from "@/lib/auth/session";
import {
  createServerSession,
  revokeServerSession,
  setCookieSessionId,
  readCookieSessionId,
} from "@/lib/auth/session/index";
import { verifyPassword, hashPassword } from "@/lib/auth/password";

function extractClientMetadata(headerStore: Headers) {
  const userAgent = headerStore.get("user-agent");
  const forwarded = headerStore.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? headerStore.get("x-real-ip") ?? null;
  return { userAgent, ip };
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Complete email y contraseña" };
  }

  const usuario = await prisma.usuario.findFirst({
    where: { email, activo: true },
    include: { empresa: true },
  });

  if (!usuario || !(await verifyPassword(password, usuario.passwordHash))) {
    return { error: "Credenciales inválidas" };
  }

  const headerStore = await headers();
  const { userAgent, ip } = extractClientMetadata(headerStore);

  const { sessionId } = await createServerSession({
    usuarioId: usuario.id,
    empresaId: usuario.empresaId,
    userAgent,
    ip,
  });

  await setCookieSessionId(sessionId);
  redirect("/agenda");
}

export async function logoutAction() {
  const sessionId = await readCookieSessionId();
  if (sessionId) {
    await revokeServerSession(sessionId);
  }
  await destroyClientSession();
  redirect("/login");
}

export { hashPassword };
