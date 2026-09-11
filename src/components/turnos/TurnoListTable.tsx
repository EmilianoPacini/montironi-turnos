import Link from "next/link";
import { format } from "date-fns";
import { CanalTurno, EstadoTurno } from "@prisma/client";
import { EstadoChip } from "./EstadoChip";
import { formatTurnoOrigen } from "@/lib/modules/appointments/format-origen";
import { VALID_TRANSITIONS } from "@/lib/modules/appointments/constants";

const TERMINAL_ESTADOS: EstadoTurno[] = [
  EstadoTurno.finalizado,
  EstadoTurno.cancelado,
  EstadoTurno.ausente,
  EstadoTurno.vencido,
];

interface TurnoListItem {
  id: string;
  inicio: Date;
  finalizaEn: Date;
  estado: EstadoTurno;
  canal: CanalTurno;
  cliente: { nombre: string; apellido?: string | null };
  vehiculo: { patente: string };
  detalles: { nombreSnapshot: string }[];
  creador?: { nombre: string } | null;
}

export function TurnoListTable({ turnos }: { turnos: TurnoListItem[] }) {
  const terminalCount = turnos.filter((t) => TERMINAL_ESTADOS.includes(t.estado)).length;

  if (turnos.length === 0) {
    return <p className="text-center text-slate-500">Sin turnos para mostrar</p>;
  }

  return (
    <div>
      <p className="mb-3 text-sm text-slate-600">
        {turnos.length} turno{turnos.length === 1 ? "" : "s"} ·{" "}
        {terminalCount} en estado terminal
      </p>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Hora</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Servicio</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Origen</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {turnos.map((turno) => {
              const servicio = turno.detalles.map((d) => d.nombreSnapshot).join(", ");
              const canConfirm =
                turno.estado === EstadoTurno.pendiente &&
                VALID_TRANSITIONS[turno.estado].includes(EstadoTurno.confirmado);

              return (
                <tr key={turno.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-900">
                    {format(turno.inicio, "HH:mm")} – {format(turno.finalizaEn, "HH:mm")}
                  </td>
                  <td className="px-4 py-3">
                    {turno.cliente.nombre} {turno.cliente.apellido ?? ""}
                    <span className="block text-xs text-slate-500">{turno.vehiculo.patente}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{servicio}</td>
                  <td className="px-4 py-3">
                    <EstadoChip estado={turno.estado} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatTurnoOrigen(turno)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/turnos/${turno.id}`}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Ver
                      </Link>
                      {canConfirm ? (
                        <Link
                          href={`/turnos/${turno.id}`}
                          className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                        >
                          Confirmar
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
