import type { ModoPrecio } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";

/** Coerce Prisma Decimal (or numeric string) to a plain number for client props. */
export function toNumber(value: Decimal | number | string | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return Number(value);
}

/** Strip Decimal fields from turno detalles before passing to client components. */
export function mapTurnoDetalleForClient(d: {
  nombreSnapshot: string;
  precioSnapshot?: Decimal | number | string;
  modoPrecioSnapshot?: ModoPrecio | string;
}) {
  return { nombreSnapshot: d.nombreSnapshot };
}

/** Map agenda turnos for client components (AgendaGrid). */
export function mapTurnoForAgendaClient<
  T extends {
    detalles: Array<{
      nombreSnapshot: string;
      precioSnapshot?: Decimal | number | string;
      modoPrecioSnapshot?: ModoPrecio | string;
    }>;
  },
>(turno: T) {
  return {
    ...turno,
    detalles: turno.detalles.map(mapTurnoDetalleForClient),
  };
}

/** Servicio fields needed by NuevoTurnoForm — omits Decimal precio. */
export function mapServicioForClient(s: {
  id: string;
  nombre: string;
  duracionMin: number;
  modoPrecio: ModoPrecio | string;
  precio?: Decimal | number | string;
}) {
  return {
    id: s.id,
    nombre: s.nombre,
    duracionMin: s.duracionMin,
    modoPrecio: s.modoPrecio,
  };
}
