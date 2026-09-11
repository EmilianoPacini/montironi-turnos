import { timingSafeEqual } from "crypto";
import { getWahConfig } from "@/lib/modules/wah/config";

/** Timing-safe comparison for X-Cima-Forward-Secret vs CIMA_FORWARD_SECRET. */
export function verifyCimaForwardSecret(headerValue: string | null): boolean {
  const { cimaForwardSecret } = getWahConfig();
  if (!cimaForwardSecret || !headerValue) return false;

  const expected = Buffer.from(cimaForwardSecret, "utf8");
  const received = Buffer.from(headerValue, "utf8");
  if (expected.length !== received.length) return false;

  return timingSafeEqual(expected, received);
}

export function getCimaForwardSecretHeader(request: Request): string | null {
  return request.headers.get("X-Cima-Forward-Secret");
}
