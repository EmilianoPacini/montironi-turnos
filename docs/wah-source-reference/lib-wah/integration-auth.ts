/**
 * Reference copy — cima-ai lib-wah/integration-auth.ts
 * Montironi implementation: src/lib/modules/wah/integration-auth.ts
 */
import { timingSafeEqual } from "crypto";

export function verifyCimaForwardSecret(
  headerValue: string | null,
  expectedSecret: string
): boolean {
  if (!expectedSecret || !headerValue) return false;
  const expected = Buffer.from(expectedSecret, "utf8");
  const received = Buffer.from(headerValue, "utf8");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}
