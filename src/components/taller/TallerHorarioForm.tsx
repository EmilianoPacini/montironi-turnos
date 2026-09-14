"use client";

import { useActionState, useState } from "react";
import { DiaSemana } from "@prisma/client";
import {
  confirmHorarioAction,
  previewHorarioAction,
  type HorarioPreviewState,
} from "@/lib/modules/catalog/taller.actions";
import type { DiaHorarioSnapshot } from "@/lib/modules/catalog/franjas";
import { FranjasTimeEditor } from "@/components/taller/FranjasTimeEditor";

const DIA_LABEL: Record<DiaSemana, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

export function TallerHorarioForm({
  tallerId,
  horario,
}: {
  tallerId: string;
  horario: DiaHorarioSnapshot[];
}) {
  const [preview, previewAction, previewPending] = useActionState(
    previewHorarioAction,
    undefined as HorarioPreviewState | undefined
  );
  const [activeDays, setActiveDays] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      Object.values(DiaSemana).map((dia) => [dia, horario.find((d) => d.dia === dia)?.activo ?? false])
    )
  );

  return (
    <form action={previewAction} className="space-y-3">
      <p className="text-sm text-slate-600">
        Los cambios de días y horarios se aplican desde la fecha confirmada. Las reglas de
        agenda se guardan de inmediato en el recuadro de datos del taller. El formulario
        muestra el último horario confirmado (o el patrón semanal si todavía no hay cambios).
      </p>
      <input type="hidden" name="tallerId" value={tallerId} />
      <div className="grid gap-3 sm:grid-cols-2">
      {Object.values(DiaSemana).map((dia) => {
        const day = horario.find((d) => d.dia === dia);
        const activo = activeDays[dia] ?? false;
        return (
          <div key={dia} className="rounded-lg border bg-white p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) =>
                  setActiveDays((prev) => ({ ...prev, [dia]: e.target.checked }))
                }
              />
              {DIA_LABEL[dia]}
            </label>
            <div className="mt-2">
              {activo ? (
                <>
                  <input type="hidden" name={`dia_${dia}_activo`} value="on" />
                  <FranjasTimeEditor
                    name={`dia_${dia}_franjas`}
                    defaultFranjas={
                      day?.franjas.length
                        ? day.franjas
                        : [{ horaInicio: "08:00", horaFin: "12:00" }]
                    }
                  />
                </>
              ) : (
                <p className="text-sm text-slate-500">Cerrado</p>
              )}
            </div>
          </div>
        );
      })}
      </div>
      <button type="submit" className="btn-primary" disabled={previewPending}>
        {previewPending ? "Calculando…" : "Previsualizar impacto"}
      </button>

      {preview?.error ? <p className="text-sm text-red-700">{preview.error}</p> : null}

      {preview?.previewHash && preview.aplicaDesde ? (
        <div className="space-y-3 rounded-xl border bg-sky-50 p-4">
          <input type="hidden" name="previewHash" value={preview.previewHash} />
          <input type="hidden" name="aplicaDesde" value={preview.aplicaDesde} />
          <p className="text-sm">
            Se aplicará desde <strong>{preview.aplicaDesde}</strong>.
            {preview.conflictos && preview.conflictos.length > 0
              ? ` ${preview.conflictos.length} turno(s) no caben en el nuevo horario; el cambio queda después de esos turnos.`
              : " No hay turnos incompatibles."}
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="reemplazarFuturo" />
            Reemplazar un cambio futuro ya confirmado, si existe
          </label>
          <button type="submit" formAction={confirmHorarioAction} className="btn-primary">
            Confirmar cambio de horario
          </button>
        </div>
      ) : null}
    </form>
  );
}
