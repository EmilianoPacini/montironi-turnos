import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { getCliente } from "@/lib/modules/customers/service";
import { ClienteForm } from "@/components/clientes/ClienteForm";

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  const { id } = await params;
  const cliente = await getCliente(id, session.empresaId);
  if (!cliente) notFound();

  return (
    <div className="p-6 lg:p-8">
      <Link href={`/clientes/${id}`} className="text-sm text-slate-600">← Cliente</Link>
      <h1 className="mt-4 text-2xl font-bold">Editar cliente</h1>
      <ClienteForm cliente={cliente} />
    </div>
  );
}
