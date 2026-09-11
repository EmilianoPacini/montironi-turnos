import { NextRequest } from "next/server";
import { requireWahSession, wahErrorResponse } from "@/lib/modules/wah/scope";
import { resumeBot } from "@/lib/modules/wah/conversation.service";
import { jsonOk } from "@/lib/modules/wah/http";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireWahSession();
    const { id } = await params;
    await resumeBot(id, session.empresaId);
    return jsonOk({ botPaused: false });
  } catch (e) {
    return wahErrorResponse(e);
  }
}
