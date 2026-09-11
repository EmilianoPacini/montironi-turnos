import { format } from "date-fns";

export interface AvailabilityBahia {
  bahiaId: string;
  bahiaNombre: string;
  slots: { inicio: Date }[];
}

export function AvailabilitySlotsPanel({
  availability,
  title,
  maxSlotsPerBahia,
  variant = "card",
  emptySlotsLabel = "Sin slots libres",
}: {
  availability: AvailabilityBahia[];
  title: string;
  maxSlotsPerBahia?: number;
  variant?: "card" | "compact";
  emptySlotsLabel?: string;
}) {
  if (availability.length === 0) return null;

  const containerClass =
    variant === "compact"
      ? "mt-8 max-w-xl"
      : "mt-8 max-w-2xl rounded-xl border border-slate-200 bg-slate-50 p-4";

  const bahiaClass =
    variant === "compact"
      ? "mb-3 rounded-lg border bg-white p-3"
      : "space-y-2 text-sm";

  return (
    <div className={containerClass}>
      <h2 className={`mb-3 ${variant === "compact" ? "font-semibold" : "text-sm font-semibold text-slate-800"}`}>
        {title}
      </h2>
      <div className={variant === "compact" ? undefined : "space-y-2 text-sm"}>
        {availability.map((b) => {
          const slots = maxSlotsPerBahia ? b.slots.slice(0, maxSlotsPerBahia) : b.slots;
          const slotText =
            slots.length > 0
              ? slots.map((s) => format(s.inicio, "HH:mm")).join(variant === "compact" ? " · " : ", ")
              : emptySlotsLabel;

          return (
            <div key={b.bahiaId} className={bahiaClass}>
              <p className="font-medium">{b.bahiaNombre}</p>
              <p className="text-slate-600">{slotText}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
