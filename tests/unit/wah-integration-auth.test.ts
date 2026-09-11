import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifyCimaForwardSecret } from "@/lib/modules/wah/integration-auth";

describe("WAH integration-auth", () => {
  const original = process.env.CIMA_FORWARD_SECRET;

  beforeEach(() => {
    process.env.CIMA_FORWARD_SECRET = "unit-test-forward-secret";
  });

  afterEach(() => {
    process.env.CIMA_FORWARD_SECRET = original;
  });

  it("acepta secret correcto (timing-safe)", () => {
    expect(verifyCimaForwardSecret("unit-test-forward-secret")).toBe(true);
  });

  it("rechaza secret incorrecto", () => {
    expect(verifyCimaForwardSecret("wrong")).toBe(false);
    expect(verifyCimaForwardSecret(null)).toBe(false);
  });
});
