"use client";

import { Fragment, useId } from "react";
import { useRouter } from "next/navigation";
import { CondicionVehiculo, TipoVehiculo } from "@prisma/client";
import { MODO_PRECIO_LABELS } from "@/lib/modules/appointments/constants";
import {
  CONDICION_VEHICULO_LABELS,
  TIPO_VEHICULO_LABELS,
} from "@/lib/modules/customers/vehiculo-labels";
import { saveIntervaloAction } from "@/lib/modules/appointments/actions";
import { IntervaloKmFields } from "@/components/servicios/IntervaloKmFields";
import { IntervaloSubmitButton } from "@/components/servicios/IntervaloSubmitButton";

export type ServicioCatalogIntervalo = {
  id: string;
  tipoVehiculo: string;
  condicion: string;
  intervaloKm: number;
};

export type ServicioCatalogRow = {
  id: string;
  nombre: string;
  tipoNombre: string;
  duracionMin: number;
  precio: number;
  modoPrecio: string;
  intervalos: ServicioCatalogIntervalo[];
};

function tipoLabel(value: string) {
  return TIPO_VEHICULO_LABELS[value as TipoVehiculo] ?? value;
}

function condicionLabel(value: string) {
  return CONDICION_VEHICULO_LABELS[value as CondicionVehiculo] ?? value;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IntervalosDetalle({
  servicio,
  panelId,
}: {
  servicio: ServicioCatalogRow;
  panelId: string;
}) {
  return (
    <div id={panelId} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Intervalos de km · {servicio.nombre}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Se guardan en la base. El próximo service es kilometraje actual + intervalo, según tipo y condición.
          Si la combinación ya existe, se actualiza.
        </p>
      </div>

      {servicio.intervalos.length === 0 ? (
        <p className="border-b border-slate-100 px-4 py-4 text-sm text-slate-600">
          Todavía no hay intervalos para este servicio. Cargá el primero acá o en el recuadro de la derecha.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2.5 font-medium">Tipo vehículo</th>
              <th className="px-4 py-2.5 font-medium">Condición</th>
              <th className="px-4 py-2.5 font-medium">Intervalo (km)</th>
            </tr>
          </thead>
          <tbody>
            {servicio.intervalos.map((intervalo) => (
              <tr key={intervalo.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 text-slate-800">{tipoLabel(intervalo.tipoVehiculo)}</td>
                <td className="px-4 py-2.5 text-slate-800">{condicionLabel(intervalo.condicion)}</td>
                <td className="px-4 py-2.5">
                  <form action={saveIntervaloAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="servicioId" value={servicio.id} />
                    <input type="hidden" name="tipoVehiculo" value={intervalo.tipoVehiculo} />
                    <input type="hidden" name="condicion" value={intervalo.condicion} />
                    <input
                      name="intervaloKm"
                      type="number"
                      required
                      min={1}
                      defaultValue={intervalo.intervaloKm}
                      aria-label={`Intervalo km ${tipoLabel(intervalo.tipoVehiculo)} ${condicionLabel(intervalo.condicion)}`}
                      className="w-28 rounded-lg border px-3 py-1.5 tabular-nums"
                    />
                    <IntervaloSubmitButton size="sm" pendingLabel="Guardando...">
                      Guardar
                    </IntervaloSubmitButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form action={saveIntervaloAction} className="space-y-3 border-t border-slate-100 bg-slate-50/70 px-4 py-4">
        <input type="hidden" name="servicioId" value={servicio.id} />
        <p className="text-sm font-medium text-slate-800">Agregar intervalo</p>
        <IntervaloKmFields layout="inline" />
        <IntervaloSubmitButton size="sm">Crear intervalo</IntervaloSubmitButton>
      </form>
    </div>
  );
}

export function ServiciosCatalogTable({
  servicios,
  openServicioId,
}: {
  servicios: ServicioCatalogRow[];
  openServicioId?: string;
}) {
  const reactId = useId();
  const router = useRouter();

  function setOpenServicio(id: string | null) {
    const url = id ? `/servicios?detalle=${encodeURIComponent(id)}` : "/servicios";
    router.replace(url, { scroll: false });
  }

  if (servicios.length === 0) {
    return (
      <div className="panel-card px-4 py-8 text-center text-sm text-slate-500">
        No hay servicios en el catálogo.
      </div>
    );
  }

  return (
    <div className="panel-card">
      <table className="data-table w-full text-sm">
        <thead>
          <tr>
            <th>Servicio</th>
            <th>Tipo</th>
            <th>Duración</th>
            <th>Precio</th>
            <th>Modo</th>
            <th className="text-right">Consultar detalle</th>
          </tr>
        </thead>
        <tbody>
          {servicios.map((servicio) => {
            const open = openServicioId === servicio.id;
            const panelId = `${reactId}-detalle-${servicio.id}`;
            const count = servicio.intervalos.length;

            return (
              <Fragment key={servicio.id}>
                <tr className={open ? "bg-sky-50/40 hover:bg-sky-50/40" : undefined}>
                  <td className="font-medium text-slate-900">{servicio.nombre}</td>
                  <td>{servicio.tipoNombre}</td>
                  <td>{servicio.duracionMin} min</td>
                  <td className="tabular-nums">${servicio.precio.toLocaleString("es-AR")}</td>
                  <td>{MODO_PRECIO_LABELS[servicio.modoPrecio] ?? servicio.modoPrecio}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => setOpenServicio(open ? null : servicio.id)}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    >
                      Consultar detalle
                      {count > 0 ? (
                        <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-sky-800 ring-1 ring-sky-200">
                          {count}
                        </span>
                      ) : null}
                      <Chevron open={open} />
                    </button>
                  </td>
                </tr>
                {open ? (
                  <tr className="hover:bg-transparent">
                    <td colSpan={6} className="bg-slate-50/80 px-4 py-4">
                      <IntervalosDetalle servicio={servicio} panelId={panelId} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
