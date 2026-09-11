import { describe, expect, it } from "vitest";
import {
  formActionError,
  readBoolean,
  readString,
  readStringArray,
} from "@/lib/form-action-state";
import {
  fieldErrorsForClienteValidation,
  fieldForClienteValidation,
  focusFieldForBloquearDomainError,
  focusFieldForReprogramarDomainError,
  focusFieldForTurnoDomainError,
} from "@/lib/form-field-errors";

describe("form-action-state", () => {
  it("formActionError preserves values, field errors, and focusField", () => {
    const result = formActionError(
      "Error de prueba",
      { nombre: "Ana" },
      { nombre: "Error de prueba" }
    );
    expect(result.error).toBe("Error de prueba");
    expect(result.values).toEqual({ nombre: "Ana" });
    expect(result.fieldErrors).toEqual({ nombre: "Error de prueba" });
    expect(result.focusField).toBe("nombre");
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

describe("form-field-errors", () => {
  it("maps cliente validation messages to fields", () => {
    expect(fieldForClienteValidation("El teléfono es obligatorio")).toBe("telefono");
    expect(fieldForClienteValidation("Teléfono inválido — use formato E.164 (+5491112345678)")).toBe(
      "telefono"
    );
    expect(fieldErrorsForClienteValidation("El apellido es obligatorio")).toEqual({
      apellido: "El apellido es obligatorio",
    });
  });

  it("maps turno domain errors to focus targets", () => {
    expect(focusFieldForTurnoDomainError("HorarioVencido")).toBe("fecha");
    expect(focusFieldForTurnoDomainError("BahiaIncompatible")).toBe("bahiaId");
    expect(focusFieldForReprogramarDomainError("CapacidadConflicto")).toBe("inicio");
    expect(focusFieldForBloquearDomainError("BloqueoInvalido")).toBe("motivo");
  });
});
