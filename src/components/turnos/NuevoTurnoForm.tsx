"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  createTurnoAction,
  type TurnoFormState,
} from "@/lib/modules/appointments/actions";
import { MODO_PRECIO_LABELS } from "@/lib/modules/appointments/constants";
import { FormError } from "@/components/ui/FormError";
import { useFormFieldErrors } from "@/components/ui/use-form-field-errors";
import { InlineClienteModal } from "@/components/clientes/InlineClienteModal";
import { InlineVehiculoModal } from "@/components/clientes/InlineVehiculoModal";

interface ClienteOption {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string;
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

function splitInicio(inicio: string | undefined, defaultInicio?: string) {
  if (inicio) {
    const date = parseISO(inicio);
    return {
      fecha: format(date, "yyyy-MM-dd"),
      hora: format(date, "HH:mm"),
    };
  }
  if (defaultInicio) {
    const date = new Date(defaultInicio);
    return {
      fecha: format(date, "yyyy-MM-dd"),
      hora: format(date, "HH:mm"),
    };
  }
  return {
    fecha: format(new Date(), "yyyy-MM-dd"),
    hora: "09:00",
  };
}

export function NuevoTurnoForm({
  tallerId,
  clientes: initialClientes,
  servicios,
  compatibleBahias,
  defaultBahiaId,
  defaultInicio,
}: {
  tallerId: string;
  clientes: ClienteOption[];
  servicios: ServicioOption[];
  compatibleBahias: BahiaOption[];
  defaultBahiaId?: string;
  defaultInicio?: string;
}) {
  const initialSchedule = splitInicio(undefined, defaultInicio);
  const [state, formAction, pending] = useActionState(
    createTurnoAction,
    undefined as TurnoFormState | undefined
  );

  const [clientes, setClientes] = useState(initialClientes);
  const [clienteId, setClienteId] = useState("");
  const [vehiculoId, setVehiculoId] = useState("");
  const [servicioIds, setServicioIds] = useState<string[]>([]);
  const [bahiaId, setBahiaId] = useState(defaultBahiaId ?? "");
  const [fecha, setFecha] = useState(initialSchedule.fecha);
  const [hora, setHora] = useState(initialSchedule.hora);
  const [kilometraje, setKilometraje] = useState("");
  const [notas, setNotas] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [inlineError, setInlineError] = useState<string | undefined>();
  const [localFieldErrors, setLocalFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [localFocusKey, setLocalFocusKey] = useState<number | undefined>();
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [showVehiculoModal, setShowVehiculoModal] = useState(false);

  useEffect(() => {
    if (!state?.values) return;
    const v = state.values;
    setClienteId(v.clienteId);
    setVehiculoId(v.vehiculoId);
    setServicioIds(v.servicioIds);
    setBahiaId(v.bahiaId);
    const schedule = splitInicio(v.inicio);
    setFecha(schedule.fecha);
    setHora(schedule.hora);
    setKilometraje(v.kilometraje);
    setNotas(v.notas);
    setConfirmar(v.confirmar);
    setLocalFieldErrors({});
  }, [state?.formKey]);

  const errorState =
    state?.formKey != null
      ? state
      : Object.keys(localFieldErrors).length > 0
        ? {
            formKey: localFocusKey,
            focusField: Object.keys(localFieldErrors)[0],
            fieldErrors: localFieldErrors,
          }
        : undefined;
  const { fieldClass, FieldErrorMessage } = useFormFieldErrors(errorState);

  const formError = state?.error ?? inlineError;

  const vehiculos = useMemo(() => {
    const cliente = clientes.find((c) => c.id === clienteId);
    return cliente?.vehiculos ?? [];
  }, [clientes, clienteId]);

  function handleClienteChange(id: string) {
    setClienteId(id);
    setVehiculoId("");
    setInlineError(undefined);
    setLocalFieldErrors({});
  }

  function toggleServicio(id: string, checked: boolean) {
    setServicioIds((prev) =>
      checked ? [...prev, id] : prev.filter((value) => value !== id)
    );
    setInlineError(undefined);
    setLocalFieldErrors((prev) => {
      if (!prev.servicioIds) return prev;
      const next = { ...prev };
      delete next.servicioIds;
      return next;
    });
  }

  return (
    <>
      <form
        action={formAction}
        className="mt-6 max-w-2xl space-y-4"
        onSubmit={(e) => {
          if (servicioIds.length === 0) {
            e.preventDefault();
            const message = "Seleccioná al menos un servicio";
            setInlineError(message);
            setLocalFieldErrors({ servicioIds: message });
            setLocalFocusKey(Date.now());
            return;
          }
          setInlineError(undefined);
          setLocalFieldErrors({});
        }}
      >
        <FormError message={formError} />
        <input type="hidden" name="tallerId" value={tallerId} />
        <input type="hidden" name="inicio" value={`${fecha}T${hora}:00`} />
        {servicioIds.map((id) => (
          <input key={id} type="hidden" name="servicioIds" value={id} />
        ))}
        {confirmar ? <input type="hidden" name="confirmar" value="true" /> : null}

        <div className="flex items-end gap-2">
          <label className="block flex-1 text-sm">
            <span className="mb-1 block font-medium">Cliente</span>
            <select
              name="clienteId"
              required
              data-field="clienteId"
              value={clienteId}
              onChange={(e) => handleClienteChange(e.target.value)}
              className={fieldClass(
                "clienteId",
                "w-full rounded-lg border border-slate-300 px-3 py-2"
              )}
            >
              <option value="">Seleccionar...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.apellido} · {c.telefono}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setShowClienteModal(true)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            + Cliente
          </button>
        </div>

        <div className="flex items-end gap-2">
          <label className="block flex-1 text-sm">
            <span className="mb-1 block font-medium">Vehículo</span>
            <select
              name="vehiculoId"
              required
              data-field="vehiculoId"
              value={vehiculoId}
              onChange={(e) => {
                setVehiculoId(e.target.value);
                setInlineError(undefined);
                setLocalFieldErrors({});
              }}
              className={fieldClass(
                "vehiculoId",
                "w-full rounded-lg border border-slate-300 px-3 py-2"
              )}
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
          <button
            type="button"
            disabled={!clienteId}
            onClick={() => setShowVehiculoModal(true)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            + Vehículo
          </button>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Servicios</legend>
          <div
            data-field="servicioIds"
            tabIndex={-1}
            className={fieldClass(
              "servicioIds",
              "space-y-2 rounded-lg border border-slate-200 p-3 outline-none"
            )}
          >
            {servicios.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={servicioIds.includes(s.id)}
                  onChange={(e) => toggleServicio(s.id, e.target.checked)}
                />
                <span>
                  {s.nombre} ({s.duracionMin} min) ·{" "}
                  {MODO_PRECIO_LABELS[s.modoPrecio] ?? s.modoPrecio}
                </span>
              </label>
            ))}
          </div>
          <FieldErrorMessage field="servicioIds" />
        </fieldset>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Bahía</span>
          <select
            name="bahiaId"
            data-field="bahiaId"
            value={bahiaId}
            onChange={(e) => setBahiaId(e.target.value)}
            className={fieldClass(
              "bahiaId",
              "w-full rounded-lg border border-slate-300 px-3 py-2"
            )}
          >
            <option value="">Automático</option>
            {compatibleBahias.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
          <FieldErrorMessage field="bahiaId" />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm sm:col-span-1">
            <span className="mb-1 block font-medium">Fecha</span>
            <input
              type="date"
              required
              data-field="fecha"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={fieldClass(
                "fecha",
                "w-full rounded-lg border border-slate-300 px-3 py-2"
              )}
            />
            <FieldErrorMessage field="fecha" />
          </label>
          <label className="block text-sm sm:col-span-1">
            <span className="mb-1 block font-medium">Hora</span>
            <input
              type="time"
              required
              data-field="hora"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className={fieldClass(
                "hora",
                "w-full rounded-lg border border-slate-300 px-3 py-2"
              )}
            />
            <FieldErrorMessage field="hora" />
          </label>
          <label className="block text-sm sm:col-span-1">
            <span className="mb-1 block font-medium">Km al turno</span>
            <input
              name="kilometraje"
              type="number"
              min={0}
              value={kilometraje}
              onChange={(e) => setKilometraje(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Notas</span>
          <textarea
            name="notas"
            rows={3}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmar}
            onChange={(e) => setConfirmar(e.target.checked)}
          />
          Confirmar inmediatamente
        </label>

        <button
          type="submit"
          disabled={pending}
          className="btn-primary-lg"
        >
          {pending ? "Creando..." : "Crear turno"}
        </button>
      </form>

      <InlineClienteModal
        open={showClienteModal}
        onClose={() => setShowClienteModal(false)}
        onCreated={(cliente) => {
          setClientes((prev) => [...prev, cliente]);
          setClienteId(cliente.id);
          setInlineError(undefined);
        }}
      />

      <InlineVehiculoModal
        open={showVehiculoModal}
        clienteId={clienteId}
        onClose={() => setShowVehiculoModal(false)}
        onCreated={(vehiculo) => {
          setClientes((prev) =>
            prev.map((c) =>
              c.id === clienteId
                ? {
                    ...c,
                    vehiculos: [
                      ...c.vehiculos,
                      {
                        vehiculoId: vehiculo.id,
                        vehiculo: { patente: vehiculo.patente, marca: vehiculo.marca },
                      },
                    ],
                  }
                : c
            )
          );
          setVehiculoId(vehiculo.id);
          setInlineError(undefined);
        }}
      />
    </>
  );
}
