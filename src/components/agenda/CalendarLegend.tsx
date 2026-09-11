export function CalendarLegend({ isClosed }: { isClosed: boolean }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
      <span className="font-medium text-slate-600">Calendario:</span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800 ring-1 ring-emerald-200">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        Disponible
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700 ring-1 ring-slate-300">
        <span className="h-2 w-2 rounded-full bg-slate-400" />
        Bloqueado
      </span>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ring-1 ${
          isClosed
            ? "bg-amber-100 text-amber-900 ring-amber-300"
            : "bg-white text-slate-500 ring-slate-200"
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${isClosed ? "bg-amber-500" : "bg-slate-300"}`} />
        Cerrado
      </span>
    </div>
  );
}
