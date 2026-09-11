import { NextResponse } from "next/server";
import {
  isDomainError,
  httpStatusForDomainError,
} from "@/lib/modules/agenda/domain/errors";

export function domainErrorResponse(e: unknown) {
  if (isDomainError(e)) {
    return NextResponse.json(
      { error: e.message, code: e.code },
      { status: httpStatusForDomainError(e.code) }
    );
  }
  if (e instanceof Error && e.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (e instanceof Error && e.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Prohibido" }, { status: 403 });
  }
  console.error(e);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}

export function parseVersion(
  request: Request,
  body?: { version?: number }
): number | undefined {
  const header =
    request.headers.get("if-match") ?? request.headers.get("x-turno-version");
  if (header && !Number.isNaN(Number(header))) return Number(header);
  return body?.version;
}

export function idempotencyKey(request: Request): string | undefined {
  return request.headers.get("idempotency-key") ?? undefined;
}

export async function parseJsonBody<T>(request: Request): Promise<T> {
  return request.json() as Promise<T>;
}

/** POST /turnos/{id}/transiciones — `estado` canónico; `nuevoEstado` alias legacy. */
export function parseTransicionEstado(body: {
  estado?: string;
  nuevoEstado?: string;
}): string | undefined {
  return body.estado ?? body.nuevoEstado;
}
