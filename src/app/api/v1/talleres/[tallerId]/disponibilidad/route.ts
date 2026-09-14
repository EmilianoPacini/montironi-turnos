import { NextRequest } from "next/server";
import { format, parseISO, startOfDay } from "date-fns";
import { requireSession } from "@/lib/auth/session";
import prisma from "@/lib/db";
import {
  aggregateVentanas,
  getAvailabilityForDate,
  getTallerScheduleForDate,
} from "@/lib/modules/availability/service";
import { DomainError } from "@/lib/modules/agenda/domain/errors";
import { domainErrorResponse } from "@/lib/modules/agenda/api/http";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tallerId: string }> }
) {
  try {
    const session = await requireSession();
    const { tallerId } = await params;
    const sp = request.nextUrl.searchParams;
    const fecha = sp.get("fecha") ?? new Date().toISOString().slice(0, 10);
    const servicioIds = sp.getAll("servicioId");
    const bahiaId = sp.get("bahiaId") ?? undefined;

    if (servicioIds.length === 0) {
      return Response.json(
        { error: "servicioId requerido", code: "VALIDATION" },
        { status: 400 }
      );
    }

    const taller = await prisma.taller.findFirst({
      where: { id: tallerId, empresaId: session.empresaId },
    });
    if (!taller) {
      throw new DomainError("Taller no encontrado", "RecursoNoEncontrado");
    }

    const date = startOfDay(parseISO(fecha));
    const availability = await getAvailabilityForDate({
      empresaId: session.empresaId,
      tallerId,
      date,
      servicioIds,
      bahiaId,
    });
    const schedule = await getTallerScheduleForDate(tallerId, date);

    return Response.json({
      fecha,
      tallerId,
      availability,
      horario_del_dia: schedule.map((w) => ({
        abre: format(w.inicio, "HH:mm"),
        cierra: format(w.fin, "HH:mm"),
      })),
      ventanas_disponibles: aggregateVentanas(availability),
    });
  } catch (e) {
    return domainErrorResponse(e);
  }
}
