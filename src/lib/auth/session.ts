import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RolUsuario } from "@prisma/client";

export interface SessionData {
  userId: string;
  empresaId: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
  isLoggedIn: boolean;
}

export const defaultSession: SessionData = {
  userId: "",
  empresaId: "",
  email: "",
  nombre: "",
  rol: RolUsuario.empleado,
  isLoggedIn: false,
};

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "montironi_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function requireSession(): Promise<
  Required<Pick<SessionData, "userId" | "empresaId" | "email" | "nombre" | "rol">> & {
    isLoggedIn: true;
  }
> {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId || !session.empresaId) {
    throw new Error("UNAUTHORIZED");
  }
  return session as Required<
    Pick<SessionData, "userId" | "empresaId" | "email" | "nombre" | "rol">
  > & { isLoggedIn: true };
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.rol !== RolUsuario.admin) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export async function getAuthSession() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId || !session.empresaId) {
    redirect("/login");
  }
  return session as Required<
    Pick<SessionData, "userId" | "empresaId" | "email" | "nombre" | "rol">
  > & { isLoggedIn: true };
}

export { sessionOptions };
