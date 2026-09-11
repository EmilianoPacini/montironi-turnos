import { describe, expect, it } from "vitest";
import { TIPO_VEHICULO_LABELS } from "@/lib/modules/customers/vehiculo-display";

describe("TIPO_VEHICULO_LABELS", () => {
  it("tiene etiquetas en español", () => {
    expect(TIPO_VEHICULO_LABELS.auto).toBe("Auto");
    expect(TIPO_VEHICULO_LABELS.camioneta).toBe("Camioneta");
  });
});
