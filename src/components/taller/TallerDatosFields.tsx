"use client";

import { useState } from "react";
import { DiaSemana } from "@prisma/client";
import type { DiaHorarioSnapshot } from "@/lib/modules/catalog/franjas";
import { FranjasTimeEditor } from "@/components/taller/FranjasTimeEditor";

const DIA_LABEL: Record<string, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

export function TallerDatosFields({
  nombre,
  activo,
  calle,
  numero,
  localidad,
  provincia,
  codigoPostal,
  direccionLegacy,
  margenMinutos,
  intervaloInicioMinutos,
  anticipacionMinimaHoras,
  anticipacionMaximaDias,
  permiteCancelacion,
  horasLimiteCancelacion,
  includeHorarioAlta,
  horarioAlta,
}: {
  nombre?: string;
  activo?: boolean;
  calle?: string | null;
  numero?: string | null;
  localidad?: string | null;
  provincia?: string | null;
  codigoPostal?: string | null;
  direccionLegacy?: string | null;
  margenMinutos?: number;
  intervaloInicioMinutos?: number;
  anticipacionMinimaHoras?: number;
  anticipacionMaximaDias?: number;
  permiteCancelacion?: boolean;
  horasLimiteCancelacion?: number;
  includeHorarioAlta?: boolean;
  horarioAlta?: DiaHorarioSnapshot[];
}) {
  const [activeDays, setActiveDays] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      Object.values(DiaSemana).map((dia) => [
        dia,
        horarioAlta?.find((d) => d.dia === dia)?.activo ?? false,
      ])
    )
  );

  return (
    <div className="space-y-4">
    <div className="flex flex-wrap items-end gap-4">
      <label className="block min-w-[12rem] flex-1 text-sm">
        <span className="mb-1 block font-medium">Nombre</span>
        <input name="nombre" required defaultValue={nombre} className="input-field" />
      </label>
      {activo !== undefined ? (
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="activo" defaultChecked={activo} />
          Taller activo
        </label>
      ) : null}
    </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Calle</span>
          <input name="calle" defaultValue={calle ?? ""} className="input-field" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Número</span>
          <input name="numero" defaultValue={numero ?? ""} className="input-field" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Localidad</span>
          <input name="localidad" defaultValue={localidad ?? ""} className="input-field" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Provincia</span>
          <input name="provincia" defaultValue={provincia ?? ""} className="input-field" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Código postal</span>
          <input name="codigoPostal" defaultValue={codigoPostal ?? ""} className="input-field" />
        </label>
      </div>
      {!calle && !localidad && direccionLegacy ? (
        <p className="text-xs text-slate-500">Dirección anterior: {direccionLegacy}</p>
      ) : null}

      <h3 className="pt-2 font-medium">Reglas de agenda (vigencia inmediata)</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Margen (min)</span>
          <input
            name="margenMinutos"
            type="number"
            min={0}
            defaultValue={margenMinutos ?? 15}
            className="input-field"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Intervalo de inicio (min)</span>
          <input
            name="intervaloInicioMinutos"
            type="number"
            min={5}
            defaultValue={intervaloInicioMinutos ?? 15}
            className="input-field"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Anticipación mínima (horas)</span>
          <input
            name="anticipacionMinimaHoras"
            type="number"
            min={0}
            defaultValue={anticipacionMinimaHoras ?? 0}
            className="input-field"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Anticipación máxima (días)</span>
          <input
            name="anticipacionMaximaDias"
            type="number"
            min={1}
            defaultValue={anticipacionMaximaDias ?? 90}
            className="input-field"
          />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="permiteCancelacion"
            defaultChecked={permiteCancelacion ?? true}
          />
          Permite cancelación
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Horas límite para cancelar</span>
          <input
            name="horasLimiteCancelacion"
            type="number"
            min={0}
            defaultValue={horasLimiteCancelacion ?? 24}
            className="input-field"
          />
        </label>
      </div>

      {includeHorarioAlta ? (
        <div className="space-y-2">
          <h3 className="font-medium">Horario semanal inicial</h3>
          <div className="grid gap-2 sm:grid-cols-2">
          {Object.values(DiaSemana).map((dia) => {
            const day = horarioAlta?.find((d) => d.dia === dia);
            const dayActive = activeDays[dia] ?? false;
            return (
              <div key={dia} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={dayActive}
                    onChange={(e) =>
                      setActiveDays((prev) => ({ ...prev, [dia]: e.target.checked }))
                    }
                  />
                  {DIA_LABEL[dia]}
                </label>
                <div className="mt-2">
                  {dayActive ? (
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
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Primera bahía (queda en este taller)</span>
            <input
              name="bahias"
              defaultValue="Bahía 1"
              className="input-field"
              placeholder="Bahía 1"
            />
          </label>
          <p className="text-xs text-slate-500">
            Se crea vinculada a este taller. Podés agregar más después en Bahías, eligiendo este
            mismo taller. Si lo dejás vacío, el taller no ofrece turnos hasta que exista una bahía.
          </p>
        </div>
      ) : null}
    </div>
  );
}
