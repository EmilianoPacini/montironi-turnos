import { describe, expect, it } from "vitest";
import { normalizeMetaId } from "@/lib/modules/wah/account.service";

describe("ids Meta de WhatsApp", () => {
  it("acepta phone number id y waba id numéricos", () => {
    expect(normalizeMetaId("1285123408020696", "Phone number id")).toBe("1285123408020696");
    expect(normalizeMetaId("1970101330374296", "WABA id")).toBe("1970101330374296");
  });

  it("rechaza un id que no es de Meta", () => {
    expect(() => normalizeMetaId("5492616106452abc", "Phone number id")).toThrow(/inválido/);
  });
});
