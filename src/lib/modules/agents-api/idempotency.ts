import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { DomainError } from "@/lib/modules/appointments/errors";

export function fingerprintRequest(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

export type IdempotencyResult<T> = {
  value: T;
  replay: boolean;
};

function isPendingMarker(respuesta: unknown): boolean {
  return Boolean(
    respuesta &&
      typeof respuesta === "object" &&
      (respuesta as { pending?: boolean }).pending === true
  );
}

export async function withIdempotency<T>(params: {
  empresaId: string;
  idempotencyKey: string;
  operation: string;
  requestBody: unknown;
  handler: () => Promise<T>;
}): Promise<IdempotencyResult<T>> {
  const huella = fingerprintRequest(params.requestBody);

  try {
    await prisma.operacionApi.create({
      data: {
        empresaId: params.empresaId,
        idempotencyKey: params.idempotencyKey,
        requestFingerprint: huella,
        operacion: params.operation,
        respuesta: { pending: true },
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.operacionApi.findUnique({
        where: {
          empresaId_idempotencyKey: {
            empresaId: params.empresaId,
            idempotencyKey: params.idempotencyKey,
          },
        },
      });
      if (!existing) {
        throw new DomainError("Conflicto de idempotencia", "IdempotencyConflict");
      }
      if (existing.requestFingerprint !== huella) {
        throw new DomainError(
          "Clave idempotente reutilizada con distinta solicitud",
          "IdempotencyConflict"
        );
      }
      if (isPendingMarker(existing.respuesta)) {
        throw new DomainError("La misma solicitud aún se está procesando", "IdempotencyConflict");
      }
      return { value: existing.respuesta as T, replay: true };
    }
    throw e;
  }

  try {
    const result = await params.handler();
    await prisma.operacionApi.update({
      where: {
        empresaId_idempotencyKey: {
          empresaId: params.empresaId,
          idempotencyKey: params.idempotencyKey,
        },
      },
      data: { respuesta: result as object },
    });
    return { value: result, replay: false };
  } catch (e) {
    await prisma.operacionApi.delete({
      where: {
        empresaId_idempotencyKey: {
          empresaId: params.empresaId,
          idempotencyKey: params.idempotencyKey,
        },
      },
    });
    throw e;
  }
}

export function validateAgentApiKey(request: Request): boolean {
  const key =
    request.headers.get("x-api-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return key === process.env.AGENT_API_KEY;
}

export function authorizedEmpresaSlugs(): string[] | "any" {
  const raw = process.env.AGENT_API_EMPRESA?.trim();
  if (raw === "*") return "any";
  if (!raw) return ["montironi"];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function getEmpresaBySlug(slug: string) {
  return prisma.empresa.findUnique({ where: { slug } });
}

export type ResolveEmpresaResult =
  | { ok: true; empresa: NonNullable<Awaited<ReturnType<typeof getEmpresaBySlug>>> }
  | { ok: false; status: 403 | 404; error: string };

export async function resolveAgentEmpresa(request: Request): Promise<ResolveEmpresaResult> {
  const requested =
    new URL(request.url).searchParams.get("empresa") ??
    request.headers.get("x-empresa") ??
    null;
  const allowed = authorizedEmpresaSlugs();
  const slug = requested ?? (allowed === "any" ? "montironi" : allowed[0] ?? "montironi");

  if (allowed !== "any" && !allowed.includes(slug)) {
    return { ok: false, status: 403, error: "Empresa no autorizada para esta API key" };
  }

  const empresa = await getEmpresaBySlug(slug);
  if (!empresa) {
    return { ok: false, status: 404, error: "Empresa no encontrada" };
  }
  return { ok: true, empresa };
}
