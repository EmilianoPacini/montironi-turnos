import { saveClienteAction } from "@/lib/modules/appointments/actions";

export function ClienteForm({
  cliente,
}: {
  cliente?: {
    id: string;
    nombre: string;
    apellido?: string | null;
    email?: string | null;
    telefono?: string | null;
    documento?: string | null;
    notas?: string | null;
  };
}) {
  const isNew = !cliente;

  return (
    <form action={saveClienteAction} className="mt-6 max-w-lg space-y-4">
      {cliente ? <input type="hidden" name="id" value={cliente.id} /> : null}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          Nombre <span className="text-red-600" aria-hidden="true">*</span>
        </span>
        <input
          name="nombre"
          required
          defaultValue={cliente?.nombre}
          className="w-full rounded-lg border px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          Apellido <span className="text-red-600" aria-hidden="true">*</span>
        </span>
        <input
          name="apellido"
          required={isNew}
          defaultValue={cliente?.apellido ?? ""}
          className="w-full rounded-lg border px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          Teléfono <span className="text-red-600" aria-hidden="true">*</span>
        </span>
        <input
          name="telefono"
          type="tel"
          required={isNew}
          placeholder="+5491112345678"
          defaultValue={cliente?.telefono ?? ""}
          className="w-full rounded-lg border px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          Documento <span className="text-red-600" aria-hidden="true">*</span>
        </span>
        <input
          name="documento"
          required={isNew}
          defaultValue={cliente?.documento ?? ""}
          className="w-full rounded-lg border px-3 py-2"
        />
      </label>
      {isNew ? (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">
            Patente <span className="text-red-600" aria-hidden="true">*</span>
          </span>
          <input
            name="patente"
            required
            placeholder="Ej. AB123CD"
            className="w-full rounded-lg border px-3 py-2 uppercase"
          />
        </label>
      ) : null}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Email</span>
        <input
          name="email"
          type="email"
          defaultValue={cliente?.email ?? ""}
          className="w-full rounded-lg border px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Notas</span>
        <textarea
          name="notas"
          defaultValue={cliente?.notas ?? ""}
          className="w-full rounded-lg border px-3 py-2"
        />
      </label>
      <button
        type="submit"
        className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white"
      >
        Guardar
      </button>
    </form>
  );
}
