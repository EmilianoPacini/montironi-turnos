import { createHash } from "crypto";
import prisma from "@/lib/db";
import { DomainError } from "@/lib/modules/appointments/errors";

export function fingerprintRequest(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

export type IdempotencyResult<T> = {
  value: T;
  replay: boolean;
};

export async function withIdempotency<T>(params: {
  empresaId: string;
  idempotencyKey: string;
  operation: string;
  requestBody: unknown;
  handler: () => Promise<T>;
}): Promise<IdempotencyResult<T>> {
  const huella = fingerprintRequest(params.requestBody);

  const existing = await prisma.operacionApi.findUnique({
    where: {
      empresaId_idempotencyKey: {
        empresaId: params.empresaId,
        idempotencyKey: params.idempotencyKey,
      },
    },
  });

  if (existing) {
    if (existing.requestFingerprint !== huella) {
      throw new DomainError(
        "Clave idempotente reutilizada con distinta solicitud",
        "CapacidadConflicto"
      );
    }
    return {
      value: existing.respuesta as T,
      replay: true,
    };
  }

  const result = await params.handler();

  await prisma.operacionApi.create({
    data: {
      empresaId: params.empresaId,
      idempotencyKey: params.idempotencyKey,
      requestFingerprint: huella,
      operacion: params.operation,
      respuesta: result as object,
    },
  });

  return { value: result, replay: false };
}

export function validateAgentApiKey(request: Request): boolean {
  const key =
    request.headers.get("x-api-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return key === process.env.AGENT_API_KEY;
}

export async function getEmpresaBySlug(slug: string) {
  return prisma.empresa.findUnique({ where: { slug } });
}
