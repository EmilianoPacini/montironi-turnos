import Link from "next/link";

export function ClienteVehiculosCell({
  clienteId,
  vehiculos,
}: {
  clienteId: string;
  vehiculos: { vehiculo: { patente: string } }[];
}) {
  const count = vehiculos.length;
  const detailHref = `/clientes/${clienteId}#vehiculos`;

  if (count === 0) {
    return (
      <Link
        href={`/clientes/${clienteId}/vehiculo/nuevo`}
        className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
      >
        + Agregar vehículo
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Link
        href={detailHref}
        className="text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline"
      >
        Ver vehículos ({count})
      </Link>
      {vehiculos.slice(0, 3).map((v) => (
        <Link
          key={v.vehiculo.patente}
          href={detailHref}
          className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800 ring-1 ring-sky-200 transition hover:bg-sky-100 hover:ring-sky-300"
          title={`Ver vehículos de este cliente`}
        >
          {v.vehiculo.patente}
        </Link>
      ))}
      {count > 3 ? (
        <span className="text-xs text-slate-500">+{count - 3}</span>
      ) : null}
    </div>
  );
}
