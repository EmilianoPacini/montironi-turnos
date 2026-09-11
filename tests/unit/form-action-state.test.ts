import { describe, expect, it } from "vitest";
import {
  formActionError,
  readBoolean,
  readString,
  readStringArray,
} from "@/lib/form-action-state";

describe("form-action-state", () => {
  it("formActionError preserves values and assigns formKey", () => {
    const result = formActionError("Error de prueba", { nombre: "Ana" });
    expect(result.error).toBe("Error de prueba");
    expect(result.values).toEqual({ nombre: "Ana" });
    expect(typeof result.formKey).toBe("number");
  });

  it("reads FormData helpers", () => {
    const fd = new FormData();
    fd.set("nombre", "  Juan  ");
    fd.append("servicioIds", "a");
    fd.append("servicioIds", "b");
    fd.set("confirmar", "true");

    expect(readString(fd, "nombre")).toBe("Juan");
    expect(readStringArray(fd, "servicioIds")).toEqual(["a", "b"]);
    expect(readBoolean(fd, "confirmar")).toBe(true);
  });
});
