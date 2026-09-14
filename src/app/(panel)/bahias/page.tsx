import { getAuthSession } from "@/lib/auth/session";
import { listTalleresAdmin } from "@/lib/modules/catalog/taller.service";
import { listBahiasTaller } from "@/lib/modules/catalog/bahia.service";
import { AdminOnlyBanner } from "@/components/layout/AdminOnlyBanner";
import { BahiasTallerSelect } from "@/components/bahias/BahiasTallerSelect";
import { BahiaCreateForm } from "@/components/bahias/BahiaCreateForm";
import { FormError } from "@/components/ui/FormError";
import Link from "next/link";

export default async function BahiasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAuthSession();
  const params = await searchParams;
  const requestedTallerId =
    typeof params.tallerId === "string" ? params.tallerId : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;

  const talleres = await listTalleresAdmin(session.empresaId);
  const tallerSeleccionado = requestedTallerId
    ? talleres.find((t) => t.id === requestedTallerId)
    : undefined;
  const bahias = tallerSeleccionado
    ? await listBahiasTaller(tallerSeleccionado.id, session.empresaId)
    : [];

  return (
    <div className="panel-page">
      <AdminOnlyBanner />
      <h1 className="panel-title">Bahías por taller</h1>
      <p className="panel-subtitle">
        Primero elegí el taller. Las bahías que creés quedan guardadas en ese taller (no aisladas).
        Bloqueos:{" "}
        <Link href="/agenda/bloquear" className="text-blue-700 underline hover:text-blue-800">
          bloquear bahía
        </Link>
        .
      </p>
      {error ? (
        <div className="mt-4">
          <FormError message={error} />
        </div>
      ) : null}

      {talleres.length === 0 ? (
        <p className="mt-6 text-sm text-slate-600">
          Primero creá un taller en{" "}
          <Link href="/taller" className="text-blue-700 underline">
            Talleres
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="mt-6">
            <BahiasTallerSelect
              talleres={talleres.map((t) => ({ id: t.id, nombre: t.nombre }))}
              selectedId={tallerSeleccionado?.id}
            />
          </div>

          {!tallerSeleccionado ? (
            <p className="mt-8 rounded-xl border border-dashed bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
              Elegí un taller para ver y crear sus bahías.
            </p>
          ) : (
            <>
              <p className="mt-4 text-sm text-slate-600">
                Bahías de <strong>{tallerSeleccionado.nombre}</strong>
                {" · "}
                <Link
                  href={`/taller/${tallerSeleccionado.id}`}
                  className="text-blue-700 underline"
                >
                  editar taller
                </Link>
              </p>

              <div className="panel-card mt-4">
                <table className="data-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Orden</th>
                      <th>Activa</th>
                      <th>Bloqueos activos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bahias.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-500">
                          Este taller no tiene bahías todavía.
                        </td>
                      </tr>
                    ) : (
                      bahias.map((b) => (
                        <tr key={b.id}>
                          <td className="font-medium">{b.nombre}</td>
                          <td>{b.orden}</td>
                          <td>{b.activa ? "Sí" : "No"}</td>
                          <td>{b.ocupaciones.length}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <BahiaCreateForm
                tallerId={tallerSeleccionado.id}
                tallerNombre={tallerSeleccionado.nombre}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
