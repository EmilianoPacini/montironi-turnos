/** Shared helpers for useActionState form actions that preserve input on error. */

export type FormActionState<TValues extends Record<string, unknown>> = {
  error?: string;
  /** Bumps on each failed submit so client forms can remount with new defaultValues. */
  formKey?: number;
  values?: TValues;
};

export function formActionError<TValues extends Record<string, unknown>>(
  error: string,
  values: TValues
): FormActionState<TValues> {
  return { error, values, formKey: Date.now() };
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
