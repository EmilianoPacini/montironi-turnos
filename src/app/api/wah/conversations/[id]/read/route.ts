import { NextRequest } from "next/server";
import { requireWahSession, wahErrorResponse } from "@/lib/modules/wah/scope";
import { markConversationRead } from "@/lib/modules/wah/conversation.service";
import { serializeConversation } from "@/lib/modules/wah/message.service";
import { jsonOk } from "@/lib/modules/wah/http";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireWahSession();
    const { id } = await params;
    const conversation = await markConversationRead(id, session.empresaId);
    return jsonOk({ conversation: serializeConversation(conversation) });
  } catch (e) {
    return wahErrorResponse(e);
  }
}
