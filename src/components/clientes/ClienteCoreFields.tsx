import type { InputHTMLAttributes } from "react";
import { invalidFieldClass } from "@/lib/form-field-errors";

type ClienteCoreValues = {
  nombre?: string | null;
  apellido?: string | null;
  telefono?: string | null;
};

type ClienteCoreFieldName = keyof ClienteCoreValues;

export function ClienteCoreFields({
  cliente,
  values,
  onChange,
  fieldErrors,
  required = true,
  className = "w-full rounded-lg border px-3 py-2",
}: {
  cliente?: ClienteCoreValues;
  values?: ClienteCoreValues;
  onChange?: (field: ClienteCoreFieldName, value: string) => void;
  fieldErrors?: Partial<Record<string, string>>;
  required?: boolean;
  className?: string;
}) {
  const resolved = {
    nombre: values?.nombre ?? cliente?.nombre ?? "",
    apellido: values?.apellido ?? cliente?.apellido ?? "",
    telefono: values?.telefono ?? cliente?.telefono ?? "",
  };

  function renderField(
    field: ClienteCoreFieldName,
    label: string,
    inputProps: InputHTMLAttributes<HTMLInputElement>
  ) {
    const message = fieldErrors?.[field];
    return (
      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          {label} {required ? <span className="text-red-600" aria-hidden="true">*</span> : null}
        </span>
        <input
          {...inputProps}
          name={field}
          required={required}
          data-field={field}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? `${field}-error` : undefined}
          className={invalidFieldClass(field, className, fieldErrors)}
          value={onChange ? resolved[field] : undefined}
          defaultValue={onChange ? undefined : resolved[field]}
          onChange={
            onChange
              ? (e) => onChange(field, e.target.value)
              : inputProps.onChange
          }
        />
        {message ? (
          <p id={`${field}-error`} className="mt-1 text-xs text-red-700" role="alert">
            {message}
          </p>
        ) : null}
      </label>
    );
  }

  return (
    <>
      {renderField("nombre", "Nombre", { type: "text" })}
      {renderField("apellido", "Apellido", { type: "text" })}
      {renderField("telefono", "Teléfono", {
        type: "tel",
        placeholder: "+5491112345678",
      })}
    </>
  );
}
