import { NextRequest } from "next/server";
import { parseISO, startOfDay } from "date-fns";
import { requireSession } from "@/lib/auth/session";
import prisma from "@/lib/db";
import { getAgendaForDate } from "@/lib/modules/agenda/application";
import { DomainError } from "@/lib/modules/agenda/domain/errors";
import { domainErrorResponse } from "@/lib/modules/agenda/api/http";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tallerId: string }> }
) {
  try {
    const session = await requireSession();
    const { tallerId } = await params;
    const fecha = request.nextUrl.searchParams.get("fecha") ?? new Date().toISOString().slice(0, 10);

    const taller = await prisma.taller.findFirst({
      where: { id: tallerId, empresaId: session.empresaId },
    });
    if (!taller) {
      throw new DomainError("Taller no encontrado", "RecursoNoEncontrado");
    }

    const agenda = await getAgendaForDate({
      empresaId: session.empresaId,
      tallerId,
      date: startOfDay(parseISO(fecha)),
    });

    return Response.json({ fecha, tallerId, ...agenda });
  } catch (e) {
    return domainErrorResponse(e);
  }
}
