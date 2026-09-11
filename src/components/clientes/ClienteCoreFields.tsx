type ClienteCoreValues = {
  nombre?: string | null;
  apellido?: string | null;
  telefono?: string | null;
};

export function ClienteCoreFields({
  cliente,
  required = true,
  className = "w-full rounded-lg border px-3 py-2",
}: {
  cliente?: ClienteCoreValues;
  required?: boolean;
  className?: string;
}) {
  return (
    <>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          Nombre {required ? <span className="text-red-600" aria-hidden="true">*</span> : null}
        </span>
        <input
          name="nombre"
          required={required}
          defaultValue={cliente?.nombre ?? ""}
          className={className}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          Apellido {required ? <span className="text-red-600" aria-hidden="true">*</span> : null}
        </span>
        <input
          name="apellido"
          required={required}
          defaultValue={cliente?.apellido ?? ""}
          className={className}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          Teléfono {required ? <span className="text-red-600" aria-hidden="true">*</span> : null}
        </span>
        <input
          name="telefono"
          type="tel"
          required={required}
          placeholder="+5491112345678"
          defaultValue={cliente?.telefono ?? ""}
          className={className}
        />
      </label>
    </>
  );
}
