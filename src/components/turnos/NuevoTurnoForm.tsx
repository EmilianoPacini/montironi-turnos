"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  createTurnoAction,
  createClienteInlineAction,
  createVehiculoInlineAction,
  type TurnoFormState,
} from "@/lib/modules/appointments/actions";
import { MODO_PRECIO_LABELS } from "@/lib/modules/appointments/constants";
import { FormError } from "@/components/ui/FormError";
import { VehiculoFields } from "@/components/clientes/VehiculoFields";
import { ClienteCoreFields } from "@/components/clientes/ClienteCoreFields";

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
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [showVehiculoModal, setShowVehiculoModal] = useState(false);
  const [clientePending, setClientePending] = useState(false);
  const [vehiculoPending, setVehiculoPending] = useState(false);

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
  }, [state?.formKey]);

  const formError = state?.error ?? inlineError;

  const vehiculos = useMemo(() => {
    const cliente = clientes.find((c) => c.id === clienteId);
    return cliente?.vehiculos ?? [];
  }, [clientes, clienteId]);

  function handleClienteChange(id: string) {
    setClienteId(id);
    setVehiculoId("");
    setInlineError(undefined);
  }

  function toggleServicio(id: string, checked: boolean) {
    setServicioIds((prev) =>
      checked ? [...prev, id] : prev.filter((value) => value !== id)
    );
    setInlineError(undefined);
  }

  async function handleInlineCliente(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setClientePending(true);
    const fd = new FormData(e.currentTarget);
    const result = await createClienteInlineAction(fd);
    setClientePending(false);
    if ("error" in result) {
      setInlineError(result.error);
      return;
    }
    setClientes((prev) => [...prev, result.cliente]);
    setClienteId(result.cliente.id);
    setShowClienteModal(false);
    setInlineError(undefined);
  }

  async function handleInlineVehiculo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!clienteId) return;
    setVehiculoPending(true);
    const fd = new FormData(e.currentTarget);
    fd.set("clienteId", clienteId);
    const result = await createVehiculoInlineAction(fd);
    setVehiculoPending(false);
    if ("error" in result) {
      setInlineError(result.error);
      return;
    }
    setClientes((prev) =>
      prev.map((c) =>
        c.id === clienteId
          ? {
              ...c,
              vehiculos: [
                ...c.vehiculos,
                {
                  vehiculoId: result.vehiculo.id,
                  vehiculo: { patente: result.vehiculo.patente, marca: result.vehiculo.marca },
                },
              ],
            }
          : c
      )
    );
    setVehiculoId(result.vehiculo.id);
    setShowVehiculoModal(false);
    setInlineError(undefined);
  }

  return (
    <>
      <form
        action={formAction}
        className="mt-6 max-w-2xl space-y-4"
        onSubmit={(e) => {
          if (servicioIds.length === 0) {
            e.preventDefault();
            setInlineError("Seleccioná al menos un servicio");
            return;
          }
          setInlineError(undefined);
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
              value={clienteId}
              onChange={(e) => handleClienteChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
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
              value={vehiculoId}
              onChange={(e) => {
                setVehiculoId(e.target.value);
                setInlineError(undefined);
              }}
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
          <div className="space-y-2 rounded-lg border border-slate-200 p-3">
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
        </fieldset>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Bahía</span>
          <select
            name="bahiaId"
            value={bahiaId}
            onChange={(e) => setBahiaId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="">Automático</option>
            {compatibleBahias.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm sm:col-span-1">
            <span className="mb-1 block font-medium">Fecha</span>
            <input
              type="date"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-1">
            <span className="mb-1 block font-medium">Hora</span>
            <input
              type="time"
              required
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
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

      {showClienteModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleInlineCliente} className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-lg">
            <h3 className="font-semibold">Nuevo cliente</h3>
            <ClienteCoreFields className="w-full rounded border px-3 py-2" />
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={clientePending} className="btn-primary">Guardar</button>
              <button type="button" onClick={() => setShowClienteModal(false)} className="rounded border px-4 py-2 text-sm">Cancelar</button>
            </div>
          </form>
        </div>
      ) : null}

      {showVehiculoModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleInlineVehiculo}
            className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-slate-900">Nuevo vehículo</h3>
            <p className="text-sm text-slate-600">
              Mismos campos que en la ficha del cliente.
            </p>
            <VehiculoFields />
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={vehiculoPending} className="btn-primary">
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setShowVehiculoModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
