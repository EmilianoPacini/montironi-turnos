import { NextRequest } from "next/server";
import { requireWahSession, wahErrorResponse } from "@/lib/modules/wah/scope";
import {
  listWahConversations,
  type ConversationFilter,
} from "@/lib/modules/wah/conversation.service";
import { serializeConversation } from "@/lib/modules/wah/message.service";
import { jsonOk } from "@/lib/modules/wah/http";

export async function GET(request: NextRequest) {
  try {
    const session = await requireWahSession();
    const accountId = request.nextUrl.searchParams.get("accountId") ?? undefined;
    const filter = (request.nextUrl.searchParams.get("filter") ?? "all") as ConversationFilter;

    const conversations = await listWahConversations({
      empresaId: session.empresaId,
      accountId,
      filter,
    });

    return jsonOk({
      conversations: conversations.map(serializeConversation),
    });
  } catch (e) {
    return wahErrorResponse(e);
  }
}
