import type { WahKpis } from "@/lib/modules/wah/types";

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "sky" | "amber" | "blue";
}) {
  const accentClass =
    accent === "amber"
      ? "text-amber-700"
      : accent === "sky"
        ? "text-sky-700"
        : "text-blue-700";

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className={`text-lg font-bold tabular-nums ${accentClass}`}>{value}</p>
      </div>
    </div>
  );
}

export function WahKpiStrip({ kpis }: { kpis: WahKpis | null }) {
  if (!kpis) {
    return (
      <div
        className="flex shrink-0 gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3"
        aria-busy="true"
        aria-label="Cargando indicadores"
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-14 flex-1 animate-pulse rounded-lg bg-slate-200/70"
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3"
      role="region"
      aria-label="Indicadores de comunicaciones"
    >
      <KpiCard label="Conversaciones" value={kpis.conversacionesActivas} accent="blue" />
      <KpiCard label="Sin responder" value={kpis.sinResponder} accent="amber" />
      <KpiCard label="Mensajes hoy" value={kpis.mensajesHoy} accent="sky" />
      <KpiCard
        label="Resp. media"
        value={
          kpis.tiempoMedioRespuestaMin != null
            ? `${kpis.tiempoMedioRespuestaMin} min`
            : "—"
        }
        accent="sky"
      />
    </div>
  );
}
