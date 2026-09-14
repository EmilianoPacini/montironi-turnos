"use client";

import { TimeClockPicker } from "@/components/ui/TimeClockPicker";
import { joinDateTimeLocal, splitDateTimeLocal } from "@/lib/time/clock-picker";

export function DateTimeClockField({
  name,
  value,
  onChange,
  required,
  disabled,
  className,
  "data-field": dataField,
}: {
  name?: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  "data-field"?: string;
}) {
  const { date, time } = splitDateTimeLocal(value);
  const combined = joinDateTimeLocal(date, time);

  return (
    <div data-field={dataField} tabIndex={-1} className={className}>
      {name ? <input type="hidden" name={name} value={combined} /> : null}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          type="date"
          required={required}
          disabled={disabled}
          value={date}
          onChange={(event) => onChange(joinDateTimeLocal(event.target.value, time))}
          className="input-field"
        />
        <TimeClockPicker
          value={time}
          disabled={disabled}
          onChange={(next) => onChange(joinDateTimeLocal(date, next))}
          className="inline-flex min-w-[7.5rem] items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm tabular-nums shadow-sm transition hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
        />
      </div>
    </div>
  );
}
