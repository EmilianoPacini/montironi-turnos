import { saveClienteAction } from "@/lib/modules/appointments/actions";
import { ClienteCoreFields } from "@/components/clientes/ClienteCoreFields";

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
      <ClienteCoreFields cliente={cliente} required={isNew} />
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
        className="btn-primary-lg"
      >
        Guardar
      </button>
    </form>
  );
}
