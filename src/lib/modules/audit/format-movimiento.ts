import { TURNO_STATE_COLORS } from "@/lib/modules/appointments/constants";

type Detalle = Record<string, unknown> | null;

export type MovimientoContext = {
  turno?: {
    cliente: { nombre: string; apellido: string | null };
    vehiculo: { patente: string };
    bahia?: { nombre: string; taller?: { nombre: string } };
  };
  bahia?: {
    nombre: string;
    taller?: { nombre: string };
  };
  taller?: { nombre: string };
};

const ACCION_LABELS: Record<string, string> = {
  crear_bahia: "Crear bahía",
  actualizar_bahia: "Actualizar bahía",
  crear_confirmado: "Crear turno",
  crear_pendiente: "Crear turno",
  cancelar: "Cancelar turno",
  transicion: "Cambiar estado",
};

function detalleString(detalle: Detalle, key: string): string | undefined {
  if (!detalle || typeof detalle[key] !== "string") return undefined;
  return detalle[key] as string;
}

function formatPersona(cliente: { nombre: string; apellido: string | null }): string {
  return [cliente.nombre, cliente.apellido].filter(Boolean).join(" ");
}

function formatBahiaContext(
  nombre: string,
  tallerNombre?: string
): string {
  return tallerNombre ? `${nombre} (${tallerNombre})` : nombre;
}

function formatTurnoContext(ctx: NonNullable<MovimientoContext["turno"]>): string {
  const parts = [formatPersona(ctx.cliente), ctx.vehiculo.patente];
  return parts.filter(Boolean).join(" · ");
}

export function formatMovimientoDescripcion(
  movimiento: {
    entidad: string;
    entidadId: string;
    accion: string;
    detalle: Detalle;
  },
  context: MovimientoContext = {}
): string {
  const accionLabel =
    ACCION_LABELS[movimiento.accion] ??
    movimiento.accion.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

  if (movimiento.entidad === "bahia") {
    const nombre =
      context.bahia?.nombre ??
      detalleString(movimiento.detalle, "nombre") ??
      "Bahía";
    const tallerNombre =
      context.bahia?.taller?.nombre ??
      context.taller?.nombre;
    return `${accionLabel} · ${formatBahiaContext(nombre, tallerNombre)}`;
  }

  if (movimiento.entidad === "turno") {
    if (context.turno) {
      const clienteNombre = formatPersona(context.turno.cliente);
      const turnoContext = formatTurnoContext(context.turno);
      if (movimiento.accion === "transicion") {
        const estadoPrev = detalleString(movimiento.detalle, "estadoPrev");
        const estadoNuevo = detalleString(movimiento.detalle, "estadoNuevo");
        const prevLabel = estadoPrev
          ? (TURNO_STATE_COLORS[estadoPrev as keyof typeof TURNO_STATE_COLORS]?.label ??
            estadoPrev)
          : undefined;
        const nuevoLabel = estadoNuevo
          ? (TURNO_STATE_COLORS[estadoNuevo as keyof typeof TURNO_STATE_COLORS]?.label ??
            estadoNuevo)
          : undefined;
        if (prevLabel && nuevoLabel) {
          return `${accionLabel} · ${clienteNombre} · ${prevLabel} → ${nuevoLabel}`;
        }
      }
      return `${accionLabel} · ${turnoContext}`;
    }

    const bahiaId = detalleString(movimiento.detalle, "bahiaId");
    if (bahiaId) {
      return `${accionLabel} · Turno`;
    }
    return accionLabel;
  }

  const entidadLabel = movimiento.entidad.replace(/_/g, " ");
  return `${accionLabel} · ${entidadLabel}`;
}
