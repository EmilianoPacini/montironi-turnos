"use server";

import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { verifyPassword, hashPassword } from "@/lib/auth/password";

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

  const session = await getSession();
  session.userId = usuario.id;
  session.empresaId = usuario.empresaId;
  session.email = usuario.email;
  session.nombre = usuario.nombre;
  session.rol = usuario.rol;
  session.isLoggedIn = true;
  await session.save();

  redirect("/agenda");
}

export async function logoutAction() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}

export { hashPassword };
