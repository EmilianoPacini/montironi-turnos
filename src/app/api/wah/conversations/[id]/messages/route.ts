import { NextRequest } from "next/server";
import { requireWahSession, wahErrorResponse } from "@/lib/modules/wah/scope";
import { sendHumanMessage, serializeMessage } from "@/lib/modules/wah/message.service";
import { jsonOk, parseIntegrationBody, parseJsonBody } from "@/lib/modules/wah/http";
import { sendWahPanelMessageSchema } from "@/lib/modules/wah/schemas";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireWahSession();
    const { id } = await params;
    const raw = await parseJsonBody(request);
    const body = parseIntegrationBody(sendWahPanelMessageSchema, raw);

    const message = await sendHumanMessage({
      empresaId: session.empresaId,
      conversationId: id,
      body: body.body.trim(),
      userId: session.userId,
      generatedByAi: body.generatedByAi,
    });

    return jsonOk({ message: serializeMessage(message), botPaused: true });
  } catch (e) {
    return wahErrorResponse(e);
  }
}
