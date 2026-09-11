import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { ClienteForm } from "@/components/clientes/ClienteForm";

export default async function NuevoClientePage() {
  const session = await getAuthSession();

  return (
    <div className="p-6 lg:p-8">
      <Link href="/clientes" className="text-sm text-slate-600">
        ← Clientes
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Nuevo cliente</h1>
      <ClienteForm />
    </div>
  );
}
