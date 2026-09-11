import { NextRequest } from "next/server";
import { requireWahIntegration, wahErrorResponse } from "@/lib/modules/wah/scope";
import { sendIntegrationAudio, serializeMessage } from "@/lib/modules/wah/message.service";
import { jsonOk, parseIntegrationBody, parseJsonBody } from "@/lib/modules/wah/http";
import { sendWahAudioIntegrationSchema } from "@/lib/modules/wah/schemas";

export async function POST(request: NextRequest) {
  try {
    requireWahIntegration(request);
    const raw = await parseJsonBody(request);
    const body = parseIntegrationBody(sendWahAudioIntegrationSchema, raw);

    const { message, conversationId } = await sendIntegrationAudio({
      empresaId: body.empresa_id,
      accountId: body.account_id,
      to: body.to,
      audioUrl: body.audio_url,
      filename: body.filename,
      contactName: body.contact_name,
      conversationId: body.conversation_id,
    });

    return jsonOk({
      conversation_id: conversationId,
      message_id: message.id,
      wa_message_id: message.wamid,
      message: serializeMessage(message),
    });
  } catch (e) {
    return wahErrorResponse(e);
  }
}
