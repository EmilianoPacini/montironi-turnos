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
          className="input-field max-w-md"
        />
        <button type="submit" className="btn-primary">
          Buscar
        </button>
      </div>
    </form>
  );
}
