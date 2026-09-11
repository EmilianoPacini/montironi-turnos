"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { EstadoTurno } from "@prisma/client";
import {
  confirmTurnoAction,
  transitionTurnoAction,
  cancelTurnoAction,
} from "@/lib/modules/appointments/actions";
import { TURNO_STATE_COLORS } from "@/lib/modules/appointments/constants";

export function TurnoActions({
  turnoId,
  version,
  estado,
  transiciones,
}: {
  turnoId: string;
  version: number;
  estado: EstadoTurno;
  transiciones: EstadoTurno[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      const result = await action();
      if (result && typeof result === "object" && "error" in result) {
        alert((result as { error: string }).error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {estado === EstadoTurno.pendiente ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => confirmTurnoAction(turnoId, version))}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
        >
          Confirmar
        </button>
      ) : null}

      {transiciones.map((t) => {
        const colors = TURNO_STATE_COLORS[t];
        return (
          <button
            key={t}
            type="button"
            disabled={pending}
            onClick={() => run(() => transitionTurnoAction(turnoId, t, version))}
            className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: colors.bg, color: colors.text }}
          >
            → {colors.label}
          </button>
        );
      })}

      {["pendiente", "confirmado", "recibido"].includes(estado) ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm("¿Cancelar este turno?")) {
              run(() => cancelTurnoAction(turnoId, version));
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
