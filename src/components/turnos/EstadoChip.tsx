import { EstadoTurno } from "@prisma/client";
import { TURNO_STATE_COLORS } from "@/lib/modules/appointments/constants";

export function EstadoChip({ estado }: { estado: EstadoTurno }) {
  const colors = TURNO_STATE_COLORS[estado];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ color: colors.text, backgroundColor: colors.bg }}
    >
      {colors.label}
    </span>
  );
}
