export function ClienteSearchForm({ search }: { search?: string }) {
  return (
    <form method="get" className="mb-4">
      <label htmlFor="cliente-search" className="sr-only">
        Buscar clientes
      </label>
      <div className="flex gap-2">
        <input
          id="cliente-search"
          name="q"
          type="search"
          placeholder="Buscar por nombre, teléfono, documento o patente…"
          defaultValue={search ?? ""}
          className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Buscar
        </button>
      </div>
    </form>
  );
}
