import { NextRequest } from "next/server";
import { requireWahIntegration, wahErrorResponse } from "@/lib/modules/wah/scope";
import { sendIntegrationFile, serializeMessage } from "@/lib/modules/wah/message.service";
import { jsonOk, parseIntegrationBody, parseJsonBody } from "@/lib/modules/wah/http";
import { sendWahFileIntegrationSchema } from "@/lib/modules/wah/schemas";

export async function POST(request: NextRequest) {
  try {
    requireWahIntegration(request);
    const raw = await parseJsonBody(request);
    const body = parseIntegrationBody(sendWahFileIntegrationSchema, raw);

    const { message, conversationId } = await sendIntegrationFile({
      empresaId: body.empresa_id,
      accountId: body.account_id,
      to: body.to,
      fileUrl: body.file_url,
      filename: body.filename,
      caption: body.caption,
      contactName: body.contact_name,
      conversationId: body.conversation_id,
    });

    return jsonOk({
      conversation_id: conversationId,
      message_id: message.id,
      wa_message_id: message.waMessageId,
      message: serializeMessage(message),
    });
  } catch (e) {
    return wahErrorResponse(e);
  }
}
