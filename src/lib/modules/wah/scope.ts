import { NextResponse } from "next/server";
import { RolUsuario } from "@prisma/client";
import { requireSession } from "@/lib/auth/session";
import {
  getCimaForwardSecretHeader,
  verifyCimaForwardSecret,
} from "@/lib/modules/wah/integration-auth";

const INBOX_ROLES: RolUsuario[] = [RolUsuario.admin, RolUsuario.empleado];

export async function requireWahSession() {
  const session = await requireSession();
  if (!INBOX_ROLES.includes(session.rol)) {
    throw new WahAuthError("FORBIDDEN", 403);
  }
  return session;
}

export function requireWahIntegration(request: Request) {
  const header = getCimaForwardSecretHeader(request);
  if (!verifyCimaForwardSecret(header)) {
    throw new WahAuthError("Unauthorized integration", 401);
  }
}

export class WahAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "WahAuthError";
    this.status = status;
  }
}

export function wahErrorResponse(e: unknown) {
  if (e instanceof WahAuthError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  if (e instanceof Error && e.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (e instanceof Error) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}
