import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { domainErrorResponse } from "@/lib/modules/agenda/api/http";
import {
  getWahConversation,
  listWahMessages,
  sendWahMessage,
} from "@/lib/modules/wah/service";

type RouteContext = { params: Promise<{ chatId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    const { chatId } = await context.params;

    const contact = await getWahConversation(session.empresaId, chatId);
    if (!contact) {
      return Response.json(
        { error: "Conversación no encontrada", code: "RecursoNoEncontrado" },
        { status: 404 }
      );
    }

    const messages = await listWahMessages(session.empresaId, chatId);
    return Response.json({ contact, messages });
  } catch (e) {
    return domainErrorResponse(e);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    const { chatId } = await context.params;
    const body = (await request.json()) as { text?: string };

    if (!body.text?.trim()) {
      return Response.json(
        { error: "El texto del mensaje es obligatorio", code: "VALIDATION" },
        { status: 400 }
      );
    }

    const message = await sendWahMessage(
      session.empresaId,
      chatId,
      body.text,
      session.userId
    );
    return Response.json({ message });
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return Response.json(
        { error: "Conversación no encontrada", code: "RecursoNoEncontrado" },
        { status: 404 }
      );
    }
    if (e instanceof Error && e.message === "VALIDATION") {
      return Response.json(
        { error: "El texto del mensaje es obligatorio", code: "VALIDATION" },
        { status: 400 }
      );
    }
    return domainErrorResponse(e);
  }
}
