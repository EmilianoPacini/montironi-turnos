import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";

export async function parseJsonBody<T>(request: Request): Promise<T> {
  return request.json() as Promise<T>;
}

export function parseIntegrationBody<T>(schema: ZodSchema<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Body inválido");
  }
  return parsed.data;
}

export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}
