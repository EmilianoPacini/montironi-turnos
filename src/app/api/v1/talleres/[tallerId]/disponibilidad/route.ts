import { NextRequest } from "next/server";
import { parseISO, startOfDay } from "date-fns";
import { requireSession } from "@/lib/auth/session";
import prisma from "@/lib/db";
import { getAvailabilityForDate } from "@/lib/modules/agenda/application";
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

    const availability = await getAvailabilityForDate({
      empresaId: session.empresaId,
      tallerId,
      date: startOfDay(parseISO(fecha)),
      servicioIds,
      bahiaId,
    });

    return Response.json({ fecha, tallerId, availability });
  } catch (e) {
    return domainErrorResponse(e);
  }
}
