"use client";

import { useRouter } from "next/navigation";

export function AgendaToolbar({
  talleres,
  tallerId,
  dateStr,
}: {
  talleres: { id: string; nombre: string }[];
  tallerId: string;
  dateStr: string;
}) {
  const router = useRouter();

  function updateParam(key: string, value: string) {
    const q = new URLSearchParams(window.location.search);
    q.set(key, value);
    router.push(`/agenda?${q.toString()}`);
  }

  return (
    <div className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-700">Taller</span>
        <select
          value={tallerId}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          onChange={(e) => updateParam("taller", e.target.value)}
        >
          {talleres.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-700">Fecha</span>
        <input
          type="date"
          value={dateStr}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          onChange={(e) => updateParam("fecha", e.target.value)}
        />
      </label>
    </div>
  );
}
