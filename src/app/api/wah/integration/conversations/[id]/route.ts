import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireWahIntegration, wahErrorResponse } from "@/lib/modules/wah/scope";

/**
 * Integration (n8n Caso1 opcional):
 * GET /api/wah/integration/conversations/:id
 * Auth: X-Cima-Forward-Secret
 * Body/response snake_case for n8n re-check before send.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireWahIntegration(request);
    const { id } = await params;

    const conversation = await prisma.wahConversation.findFirst({
      where: { id },
      select: {
        botPaused: true,
        contactPhone: true,
        accountId: true,
        empresaId: true,
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
    }

    return NextResponse.json({
      bot_paused: conversation.botPaused,
      contact_phone: conversation.contactPhone,
      account_id: conversation.accountId,
      empresa_id: conversation.empresaId,
    });
  } catch (e) {
    return wahErrorResponse(e);
  }
}
