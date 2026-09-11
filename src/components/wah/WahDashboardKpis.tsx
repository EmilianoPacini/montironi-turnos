"use client";

import type { WahKpis } from "@/components/wah/use-wah-api";

export function WahDashboardKpis({ kpis, loading }: { kpis?: WahKpis; loading?: boolean }) {
  const items = [
    { label: "Total", value: kpis?.total, tone: "text-slate-700" },
    { label: "Sin leer", value: kpis?.unread, tone: "text-sky-700" },
    { label: "Pendientes", value: kpis?.pending, tone: "text-amber-700" },
    { label: "Bot pausado", value: kpis?.botPaused, tone: "text-violet-700" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {item.label}
          </p>
          <p className={`text-lg font-bold tabular-nums ${item.tone}`}>
            {loading ? "—" : (item.value ?? 0)}
          </p>
        </div>
      ))}
    </div>
  );
}
