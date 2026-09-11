import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { getCliente } from "@/lib/modules/customers/service";
import { saveVehiculoAction } from "@/lib/modules/appointments/actions";
import { VehiculoFields } from "@/components/clientes/VehiculoFields";

export default async function NuevoVehiculoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  const { id } = await params;
  const cliente = await getCliente(id, session.empresaId);
  if (!cliente) notFound();

  return (
    <div className="p-6 lg:p-8">
      <Link href={`/clientes/${id}`} className="text-sm text-slate-600">← Cliente</Link>
      <h1 className="mt-4 text-2xl font-bold">Agregar vehículo</h1>
      <form action={saveVehiculoAction} className="mt-6 max-w-lg space-y-4">
        <input type="hidden" name="clienteId" value={id} />
        <VehiculoFields />
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Año</span>
          <input name="anio" type="number" className="w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Color</span>
          <input name="color" className="w-full rounded-lg border px-3 py-2" />
        </label>
        <button type="submit" className="btn-primary-lg">
          Guardar
        </button>
      </form>
    </div>
  );
}
