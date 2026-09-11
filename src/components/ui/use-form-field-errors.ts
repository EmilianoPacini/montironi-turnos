"use client";

import { useEffect } from "react";
import { invalidFieldClass } from "@/lib/form-field-errors";

type FormFieldErrorState = {
  formKey?: number;
  focusField?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

export function useFormFieldErrors(state?: FormFieldErrorState) {
  useEffect(() => {
    if (!state?.focusField) return;
    const el = document.querySelector<HTMLElement>(`[data-field="${state.focusField}"]`);
    el?.focus();
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [state?.formKey, state?.focusField]);

  function fieldClass(field: string, baseClass: string): string {
    return invalidFieldClass(field, baseClass, state?.fieldErrors);
  }

  function fieldError(field: string): string | undefined {
    return state?.fieldErrors?.[field];
  }

  function fieldProps(field: string) {
    const message = state?.fieldErrors?.[field];
    return {
      "data-field": field,
      "aria-invalid": message ? (true as const) : undefined,
      "aria-describedby": message ? `${field}-error` : undefined,
    };
  }

  function FieldErrorMessage({ field }: { field: string }) {
    const message = state?.fieldErrors?.[field];
    if (!message) return null;
    return (
      <p id={`${field}-error`} className="mt-1 text-xs text-red-700" role="alert">
        {message}
      </p>
    );
  }

  return { fieldClass, fieldError, fieldProps, FieldErrorMessage, fieldErrors: state?.fieldErrors };
}
