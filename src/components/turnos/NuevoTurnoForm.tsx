"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { createTurnoAction } from "@/lib/modules/appointments/actions";
import { MODO_PRECIO_LABELS } from "@/lib/modules/appointments/constants";
import { FormError } from "@/components/ui/FormError";

interface ClienteOption {
  id: string;
  nombre: string;
  apellido?: string | null;
  telefono?: string | null;
  vehiculos: { vehiculoId: string; vehiculo: { patente: string; marca?: string | null } }[];
}

interface ServicioOption {
  id: string;
  nombre: string;
  duracionMin: number;
  modoPrecio: string;
}

interface BahiaOption {
  id: string;
  nombre: string;
}

export function NuevoTurnoForm({
  tallerId,
  clientes,
  servicios,
  compatibleBahias,
  defaultBahiaId,
  defaultInicio,
  error,
}: {
  tallerId: string;
  clientes: ClienteOption[];
  servicios: ServicioOption[];
  compatibleBahias: BahiaOption[];
  defaultBahiaId?: string;
  defaultInicio?: string;
  error?: string;
}) {
  const [clienteId, setClienteId] = useState("");
  const [vehiculoId, setVehiculoId] = useState("");
  const [formError, setFormError] = useState<string | undefined>(error);

  const vehiculos = useMemo(() => {
    const cliente = clientes.find((c) => c.id === clienteId);
    return cliente?.vehiculos ?? [];
  }, [clientes, clienteId]);

  function handleClienteChange(id: string) {
    setClienteId(id);
    setVehiculoId("");
  }

  return (
    <form
      action={createTurnoAction}
      className="mt-6 max-w-2xl space-y-4"
      onSubmit={(e) => {
        const form = e.currentTarget;
        const checked = form.querySelectorAll<HTMLInputElement>(
          'input[name="servicioIds"]:checked'
        );
        if (checked.length === 0) {
          e.preventDefault();
          setFormError("Seleccioná al menos un servicio");
        }
      }}
    >
      <FormError message={formError} />
      <input type="hidden" name="tallerId" value={tallerId} />

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Cliente</span>
        <select
          name="clienteId"
          required
          value={clienteId}
          onChange={(e) => handleClienteChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        >
          <option value="">Seleccionar...</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} {c.apellido ?? ""} · {c.telefono ?? "sin tel"}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Vehículo</span>
        <select
          name="vehiculoId"
          required
          value={vehiculoId}
          onChange={(e) => setVehiculoId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          disabled={!clienteId}
        >
          <option value="">
            {clienteId ? "Seleccionar vehículo..." : "Seleccioná un cliente primero"}
          </option>
          {vehiculos.map((cv) => (
            <option key={cv.vehiculoId} value={cv.vehiculoId}>
              {cv.vehiculo.patente}
              {cv.vehiculo.marca ? ` · ${cv.vehiculo.marca}` : ""}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Servicios</legend>
        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          {servicios.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="servicioIds" value={s.id} />
              <span>
                {s.nombre} ({s.duracionMin} min) ·{" "}
                {MODO_PRECIO_LABELS[s.modoPrecio] ?? s.modoPrecio}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Bahía</span>
        <select
          name="bahiaId"
          defaultValue={defaultBahiaId ?? ""}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        >
          <option value="">
            Automático — asignar si hay exactamente una bahía compatible libre
          </option>
          {compatibleBahias.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nombre} (selección manual)
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Podés elegir una bahía manualmente en cualquier momento. Si dejás automático y hay
          varias bahías libres, se pedirá selección explícita.
        </p>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Fecha y hora de inicio</span>
        <input
          type="datetime-local"
          name="inicio"
          required
          defaultValue={
            defaultInicio
              ? format(new Date(defaultInicio), "yyyy-MM-dd'T'HH:mm")
              : format(new Date(), "yyyy-MM-dd'T'09:00")
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Notas</span>
        <textarea
          name="notas"
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="confirmar" value="true" />
        Confirmar inmediatamente (revalida disponibilidad al crear)
      </label>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Crear turno
        </button>
      </div>
    </form>
  );
}
