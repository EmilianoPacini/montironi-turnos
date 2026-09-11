import Link from "next/link";
import { CanalTurno, EstadoTurno } from "@prisma/client";
import { format } from "date-fns";
import { EstadoChip } from "./EstadoChip";
import { formatTurnoOrigen } from "@/lib/modules/appointments/format-origen";

interface TurnoCardProps {
  turno: {
    id: string;
    inicio: Date;
    finalizaEn: Date;
    estado: EstadoTurno;
    canal: CanalTurno;
    cliente: { nombre: string; apellido?: string | null };
    vehiculo: { patente: string };
    detalles: { nombreSnapshot: string }[];
    creador?: { nombre: string } | null;
  };
  compact?: boolean;
}

export function TurnoCard({ turno, compact }: TurnoCardProps) {
  const servicio = turno.detalles.map((d) => d.nombreSnapshot).join(", ");

  return (
    <Link
      href={`/turnos/${turno.id}`}
      className="block rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {format(turno.inicio, "HH:mm")} – {format(turno.finalizaEn, "HH:mm")}
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
      <p className="mt-1 text-xs text-slate-500">{formatTurnoOrigen(turno)}</p>
    </Link>
  );
}
