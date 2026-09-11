import { NextRequest } from "next/server";
import { requireWahSession, wahErrorResponse } from "@/lib/modules/wah/scope";
import { getWahConversationDetail } from "@/lib/modules/wah/conversation.service";
import { serializeConversation, serializeMessage } from "@/lib/modules/wah/message.service";
import { jsonOk } from "@/lib/modules/wah/http";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireWahSession();
    const { id } = await params;
    const detail = await getWahConversationDetail(id, session.empresaId);
    if (!detail) {
      return wahErrorResponse(new Error("Conversación no encontrada"));
    }

    return jsonOk({
      conversation: serializeConversation(detail.conversation),
      messages: detail.messages.map(serializeMessage),
    });
  } catch (e) {
    return wahErrorResponse(e);
  }
}
