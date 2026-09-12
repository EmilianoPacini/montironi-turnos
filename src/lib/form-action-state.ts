/** Shared helpers for useActionState form actions that preserve input on error. */

export type FormActionState<TValues extends Record<string, unknown>> = {
  error?: string;
  /** Field name → message; first key becomes focusField when omitted. */
  fieldErrors?: Partial<Record<string, string>>;
  focusField?: string;
  /** Bumps on each failed submit so clients can react (focus, sync state). */
  formKey?: number;
  values?: TValues;
};

export function formActionError<TValues extends Record<string, unknown>>(
  error: string,
  values: TValues,
  fieldErrors?: Partial<Record<string, string>>,
  focusField?: string
): FormActionState<TValues> {
  const errors = fieldErrors ?? {};
  const resolvedFocus =
    focusField ??
    Object.keys(errors).find((key) => errors[key]) ??
    undefined;
  return {
    error,
    values,
    fieldErrors: errors,
    focusField: resolvedFocus,
    formKey: Date.now(),
  };
}

export function readString(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export function readOptionalString(formData: FormData, name: string): string | undefined {
  const value = readString(formData, name);
  return value || undefined;
}

export function readStringArray(formData: FormData, name: string): string[] {
  return formData.getAll(name).map(String);
}

export function readBoolean(formData: FormData, name: string): boolean {
  return formData.get(name) === "true";
}
