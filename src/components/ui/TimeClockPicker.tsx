"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CLOCK_CX,
  CLOCK_CY,
  CLOCK_R_INNER,
  CLOCK_R_MINUTES,
  CLOCK_R_OUTER,
  CLOCK_SIZE,
  clockPoint,
  formatClockValue,
  hourFromClockPointer,
  hourHandRadius,
  hourIndex,
  minuteFromClockPointer,
  minuteIndex,
  parseClockValue,
} from "@/lib/time/clock-picker";

type Mode = "hours" | "minutes";

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-500" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 7v5l3.5 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function pointerInSvg(event: React.PointerEvent<SVGSVGElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    dx: (event.clientX - rect.left - rect.width / 2) * (CLOCK_SIZE / rect.width),
    dy: (event.clientY - rect.top - rect.height / 2) * (CLOCK_SIZE / rect.height),
  };
}

export function TimeClockPicker({
  value,
  onChange,
  disabled = false,
  name,
  className,
  "data-field": dataField,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  name?: string;
  className?: string;
  "data-field"?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
}) {
  const parsed = parseClockValue(value);
  const display = formatClockValue(parsed.hour, parsed.minute);
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("hours");
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [mounted, setMounted] = useState(false);
  const dragging = useRef(false);
  const hourRef = useRef(hour);
  const minuteRef = useRef(minute);
  hourRef.current = hour;
  minuteRef.current = minute;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const next = parseClockValue(value);
    setHour(next.hour);
    setMinute(next.minute);
    setMode("hours");
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function commit(nextHour = hourRef.current, nextMinute = minuteRef.current) {
    onChange(formatClockValue(nextHour, nextMinute));
    setOpen(false);
    triggerRef.current?.focus();
  }

  function applyPointer(event: React.PointerEvent<SVGSVGElement>, done: boolean) {
    const { dx, dy } = pointerInSvg(event);
    if (Math.hypot(dx, dy) < 18) return;
    if (mode === "hours") {
      const nextHour = hourFromClockPointer(dx, dy);
      hourRef.current = nextHour;
      setHour(nextHour);
      if (done) setMode("minutes");
      return;
    }
    const nextMinute = minuteFromClockPointer(dx, dy);
    minuteRef.current = nextMinute;
    setMinute(nextMinute);
    if (done) commit(hourRef.current, nextMinute);
  }

  const selectedHourPoint = clockPoint(hourIndex(hour), hourHandRadius(hour));
  const selectedMinutePoint = clockPoint(minuteIndex(minute), CLOCK_R_MINUTES);
  const hand = mode === "hours" ? selectedHourPoint : selectedMinutePoint;

  const dialog =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setOpen(false);
                triggerRef.current?.focus();
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={dialogId}
              className="w-[min(100%,20rem)] overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <div className="bg-blue-600 px-5 py-4 text-white">
                <p id={dialogId} className="text-xs font-medium uppercase tracking-wide text-blue-100">
                  Elegir horario
                </p>
                <div className="mt-1 flex items-baseline justify-center gap-1 font-semibold tabular-nums">
                  <button
                    type="button"
                    onClick={() => setMode("hours")}
                    className={`rounded px-1 text-5xl leading-none ${
                      mode === "hours" ? "text-white" : "text-blue-200"
                    }`}
                  >
                    {formatClockValue(hour, minute).slice(0, 2)}
                  </button>
                  <span className="text-4xl text-blue-100">:</span>
                  <button
                    type="button"
                    onClick={() => setMode("minutes")}
                    className={`rounded px-1 text-5xl leading-none ${
                      mode === "minutes" ? "text-white" : "text-blue-200"
                    }`}
                  >
                    {formatClockValue(hour, minute).slice(3)}
                  </button>
                </div>
              </div>

              <div className="flex justify-center px-4 py-4">
                <svg
                  viewBox={`0 0 ${CLOCK_SIZE} ${CLOCK_SIZE}`}
                  className="h-64 w-64 touch-none select-none"
                  onPointerDown={(event) => {
                    dragging.current = true;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    applyPointer(event, false);
                  }}
                  onPointerMove={(event) => {
                    if (!dragging.current) return;
                    applyPointer(event, false);
                  }}
                  onPointerUp={(event) => {
                    if (!dragging.current) return;
                    dragging.current = false;
                    applyPointer(event, true);
                  }}
                  onPointerCancel={() => {
                    dragging.current = false;
                  }}
                >
                  <circle cx={CLOCK_CX} cy={CLOCK_CY} r={122} fill="#f1f5f9" />
                  <line
                    x1={CLOCK_CX}
                    y1={CLOCK_CY}
                    x2={hand.x}
                    y2={hand.y}
                    stroke="#2563eb"
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                  <circle cx={hand.x} cy={hand.y} r={16} fill="#2563eb" />
                  <circle cx={CLOCK_CX} cy={CLOCK_CY} r={6} fill="#2563eb" />
                  {(mode === "hours"
                    ? [
                        ...Array.from({ length: 12 }, (_, index) => ({
                          value: index,
                          radius: CLOCK_R_INNER,
                          label: String(index).padStart(2, "0"),
                          inner: true,
                        })),
                        ...Array.from({ length: 12 }, (_, index) => ({
                          value: index === 0 ? 12 : index + 12,
                          radius: CLOCK_R_OUTER,
                          label: String(index === 0 ? 12 : index + 12),
                          inner: false,
                        })),
                      ]
                    : Array.from({ length: 12 }, (_, index) => ({
                        value: index * 5,
                        radius: CLOCK_R_MINUTES,
                        label: String(index * 5).padStart(2, "0"),
                        inner: false,
                      }))
                  ).map((tick) => {
                    const point = clockPoint(
                      mode === "hours" ? hourIndex(tick.value) : minuteIndex(tick.value),
                      tick.radius
                    );
                    const selected =
                      mode === "hours"
                        ? tick.value === hour
                        : tick.value === minuteIndex(minute) * 5;
                    return (
                      <g key={`${mode}-${tick.label}-${tick.radius}`}>
                        <text
                          x={point.x}
                          y={point.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={selected ? "#ffffff" : "#334155"}
                          fontSize={tick.inner ? 11 : 13}
                          fontWeight={600}
                          className="pointer-events-none"
                        >
                          {tick.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  onClick={() => {
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => commit()}
                >
                  Listo
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {name ? <input type="hidden" name={name} value={display} /> : null}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        data-field={dataField}
        aria-label={ariaLabel ?? "Elegir horario"}
        aria-invalid={ariaInvalid}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!disabled) setOpen(true);
        }}
        className={
          className ??
          "inline-flex w-full min-w-[7.5rem] items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm tabular-nums shadow-sm transition hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
        }
      >
        <span className="flex items-center gap-2">
          <ClockIcon />
          <span>{display}</span>
        </span>
      </button>
      {dialog}
    </>
  );
}
