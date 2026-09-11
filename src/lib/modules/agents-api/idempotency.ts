import { createHash } from "crypto";
import prisma from "@/lib/db";

export function fingerprintRequest(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

export async function withIdempotency<T>(params: {
  empresaId: string;
  idempotencyKey: string;
  operation: string;
  requestBody: unknown;
  handler: () => Promise<T>;
}): Promise<T> {
  const huella = fingerprintRequest(params.requestBody);

  const existing = await prisma.operacionApi.findUnique({
    where: {
      empresaId_claveIdempotencia: {
        empresaId: params.empresaId,
        claveIdempotencia: params.idempotencyKey,
      },
    },
  });

  if (existing) {
    if (existing.huellaSolicitud !== huella) {
      throw new Error("IDEMPOTENCY_KEY_REUSED");
    }
    return existing.respuesta as T;
  }

  const result = await params.handler();

  await prisma.operacionApi.create({
    data: {
      empresaId: params.empresaId,
      claveIdempotencia: params.idempotencyKey,
      huellaSolicitud: huella,
      operacion: params.operation,
      respuesta: result as object,
    },
  });

  return result;
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
