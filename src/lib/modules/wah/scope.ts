import { NextResponse } from "next/server";
import { assertPanelAccess } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import {
  getCimaForwardSecretHeader,
  verifyCimaForwardSecret,
} from "@/lib/modules/wah/integration-auth";

export async function requireWahSession() {
  const session = await requireSession();
  try {
    assertPanelAccess({ rol: session.rol });
  } catch {
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
