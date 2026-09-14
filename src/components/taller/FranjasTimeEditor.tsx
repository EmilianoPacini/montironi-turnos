"use client";

import { useState } from "react";
import { TimeClockPicker } from "@/components/ui/TimeClockPicker";

export type FranjaRow = { horaInicio: string; horaFin: string };

function toHhMm(raw: string): string {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw.trim();
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function serialize(franjas: FranjaRow[]): string {
  return franjas
    .filter((f) => f.horaInicio && f.horaFin)
    .map((f) => `${toHhMm(f.horaInicio)}-${toHhMm(f.horaFin)}`)
    .join(", ");
}

const pickerClass =
  "inline-flex w-auto min-w-[7.25rem] items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-left text-sm tabular-nums shadow-sm transition hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50";

export function FranjasTimeEditor({
  name = "franjas",
  defaultFranjas = [{ horaInicio: "08:00", horaFin: "12:00" }],
  disabled = false,
}: {
  name?: string;
  defaultFranjas?: FranjaRow[];
  disabled?: boolean;
}) {
  const [franjas, setFranjas] = useState<FranjaRow[]>(
    defaultFranjas.length > 0 ? defaultFranjas : [{ horaInicio: "08:00", horaFin: "12:00" }]
  );

  function updateRow(index: number, patch: Partial<FranjaRow>) {
    setFranjas((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setFranjas((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={serialize(franjas)} />
      {franjas.map((franja, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <TimeClockPicker
            value={franja.horaInicio}
            disabled={disabled}
            onChange={(horaInicio) => updateRow(index, { horaInicio })}
            aria-label={`Inicio franja ${index + 1}`}
            className={pickerClass}
          />
          <span className="text-slate-500">–</span>
          <TimeClockPicker
            value={franja.horaFin}
            disabled={disabled}
            onChange={(horaFin) => updateRow(index, { horaFin })}
            aria-label={`Fin franja ${index + 1}`}
            className={pickerClass}
          />
          {!disabled && franjas.length > 1 ? (
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="text-sm text-red-700 underline"
            >
              Quitar
            </button>
          ) : null}
        </div>
      ))}
      {!disabled ? (
        <button
          type="button"
          onClick={() =>
            setFranjas((prev) => [...prev, { horaInicio: "13:00", horaFin: "18:00" }])
          }
          className="text-sm text-blue-700 underline"
        >
          Agregar franja
        </button>
      ) : null}
    </div>
  );
}
