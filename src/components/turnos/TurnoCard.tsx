import Link from "next/link";
import { EstadoTurno, OrigenTurno } from "@prisma/client";
import { format } from "date-fns";
import { EstadoChip } from "./EstadoChip";
import { ORIGEN_LABELS } from "@/lib/modules/appointments/constants";

interface TurnoCardProps {
  turno: {
    id: string;
    inicio: Date;
    fin: Date;
    estado: EstadoTurno;
    origen: OrigenTurno;
    cliente: { nombre: string; apellido?: string | null };
    vehiculo: { patente: string };
    detalles: { nombreSnapshot: string }[];
    creador?: { nombre: string } | null;
    agenteIa?: { nombre: string } | null;
  };
  compact?: boolean;
}

export function TurnoCard({ turno, compact }: TurnoCardProps) {
  const servicio = turno.detalles.map((d) => d.nombreSnapshot).join(", ");
  const actor =
    turno.origen === "panel"
      ? turno.creador?.nombre ?? "Panel"
      : turno.agenteIa?.nombre ?? ORIGEN_LABELS[turno.origen];

  return (
    <Link
      href={`/turnos/${turno.id}`}
      className="block rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {format(turno.inicio, "HH:mm")} – {format(turno.fin, "HH:mm")}
          </p>
          {!compact && <p className="text-xs text-slate-500">{servicio}</p>}
        </div>
        <EstadoChip estado={turno.estado} />
      </div>
      <p className="text-sm text-slate-800">
        {turno.cliente.nombre} {turno.cliente.apellido ?? ""} · {turno.vehiculo.patente}
      </p>
      {compact ? (
        <p className="mt-1 truncate text-xs text-slate-500">{servicio}</p>
      ) : null}
      <p className="mt-1 text-xs text-slate-500">
        {ORIGEN_LABELS[turno.origen]} · {actor}
      </p>
    </Link>
  );
}
