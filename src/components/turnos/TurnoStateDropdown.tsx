"use client";

import { EstadoTurno } from "@prisma/client";
import {
  confirmTurnoAction,
  transitionTurnoAction,
  cancelTurnoAction,
} from "@/lib/modules/appointments/actions";
import { TURNO_STATE_COLORS, VALID_TRANSITIONS } from "@/lib/modules/appointments/constants";
import { useActionTransition } from "@/components/turnos/use-action-transition";

export function TurnoStateDropdown({
  turnoId,
  version,
  estado,
}: {
  turnoId: string;
  version: number;
  estado: EstadoTurno;
}) {
  const { pending, runAction } = useActionTransition();

  const options = VALID_TRANSITIONS[estado].filter((t) => t !== EstadoTurno.cancelado);
  const canCancel = VALID_TRANSITIONS[estado].includes(EstadoTurno.cancelado);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {estado === EstadoTurno.pendiente ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => runAction(() => confirmTurnoAction(turnoId, version))}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
        >
          Confirmar
        </button>
      ) : null}

      {options.length > 0 ? (
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium text-slate-700">Estado:</span>
          <select
            disabled={pending}
            defaultValue=""
            className="rounded-lg border border-slate-300 px-3 py-2"
            onChange={(e) => {
              const next = e.target.value as EstadoTurno;
              if (!next) return;
              e.target.value = "";
              runAction(() => transitionTurnoAction(turnoId, next, version));
            }}
          >
            <option value="">Cambiar a…</option>
            {options.map((t) => {
              const colors = TURNO_STATE_COLORS[t];
              return (
                <option key={t} value={t}>
                  {colors.label}
                </option>
              );
            })}
          </select>
        </label>
      ) : null}

      {canCancel ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm("¿Cancelar este turno?")) {
              runAction(() => cancelTurnoAction(turnoId, version));
            }
          }}
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
        >
          Cancelar
        </button>
      ) : null}
    </div>
  );
}
