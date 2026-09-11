import { NextRequest, NextResponse } from "next/server";
import { jsonOk, parseJsonBody } from "@/lib/modules/wah/http";
import { requireWahIntegration, wahErrorResponse } from "@/lib/modules/wah/scope";
import {
  processWhatsAppWebhook,
  WahAccountNotFoundError,
} from "@/lib/modules/wah/process-webhook";

export async function POST(request: NextRequest) {
  try {
    requireWahIntegration(request);
    const payload = await parseJsonBody<unknown>(request);
    const result = await processWhatsAppWebhook(payload as Parameters<typeof processWhatsAppWebhook>[0]);
    return jsonOk(result);
  } catch (e) {
    if (e instanceof WahAccountNotFoundError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    return wahErrorResponse(e);
  }
}
