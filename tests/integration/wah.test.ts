import { NextRequest } from "next/server";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { POST as sendTextPost } from "@/app/api/wah/integration/send-text/route";
import { POST as resumePost } from "@/app/api/wah/conversations/[id]/bot/resume/route";
import {
  createTestFixture,
  createWahAccount,
  destroyTestFixture,
  prisma,
  type TestFixture,
} from "../helpers/fixture";
import { findOrCreateConversation, resumeBot } from "@/lib/modules/wah/conversation.service";
import { sendHumanMessage } from "@/lib/modules/wah/message.service";
import { verifyCimaForwardSecret } from "@/lib/modules/wah/integration-auth";
import * as wahScope from "@/lib/modules/wah/scope";

const FORWARD_SECRET = "test-cima-forward-secret";

describe("WAH · Comunicaciones (Emi contract)", () => {
  let fx: TestFixture;
  let fxB: TestFixture;
  let accountId: string;
  let accountBId: string;

  beforeAll(async () => {
    process.env.CIMA_FORWARD_SECRET = FORWARD_SECRET;
    fx = await createTestFixture(`wah-a-${Date.now()}`);
    fxB = await createTestFixture(`wah-b-${Date.now()}`);
    const account = await createWahAccount(fx.empresaId, "a");
    const accountB = await createWahAccount(fxB.empresaId, "b");
    accountId = account.id;
    accountBId = accountB.id;
  });

  afterAll(async () => {
    await destroyTestFixture(fx.empresaId);
    await destroyTestFixture(fxB.empresaId);
    await prisma.$disconnect();
  });

  it("integration-auth rechaza secret incorrecto", () => {
    expect(verifyCimaForwardSecret("wrong-secret")).toBe(false);
    expect(verifyCimaForwardSecret(FORWARD_SECRET)).toBe(true);
  });

  it("send-text sin secret → 401", async () => {
    const request = new NextRequest("http://localhost/api/wah/integration/send-text", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        empresa_id: fx.empresaId,
        account_id: accountId,
        to: "+549119998877",
        text: "Hola",
      }),
    });

    const res = await sendTextPost(request);
    expect(res.status).toBe(401);
  });

  it("send-text con empresa_id persiste outbound", async () => {
    const request = new NextRequest("http://localhost/api/wah/integration/send-text", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Cima-Forward-Secret": FORWARD_SECRET,
      },
      body: JSON.stringify({
        empresa_id: fx.empresaId,
        account_id: accountId,
        to: "+549119998877",
        text: "Turno confirmado",
      }),
    });

    const res = await sendTextPost(request);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.conversation_id).toBeTruthy();
    expect(json.message_id).toBeTruthy();
  });

  it("aislamiento empresa_id: account de otra empresa → error", async () => {
    const request = new NextRequest("http://localhost/api/wah/integration/send-text", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Cima-Forward-Secret": FORWARD_SECRET,
      },
      body: JSON.stringify({
        empresa_id: fx.empresaId,
        account_id: accountBId,
        to: "+549118887776",
        text: "No debe entrar",
      }),
    });

    const res = await sendTextPost(request);
    expect(res.status).toBe(400);
  });

  it("POST messages humano → bot_paused true (misma TX persistencia)", async () => {
    const conv = await findOrCreateConversation({
      empresaId: fx.empresaId,
      accountId,
      contactPhone: "+549117776665",
    });

    await prisma.wahConversation.update({
      where: { id: conv.id },
      data: { botPaused: false },
    });

    await sendHumanMessage({
      empresaId: fx.empresaId,
      conversationId: conv.id,
      body: "Respuesta humana",
      userId: fx.userId!,
    });

    const updated = await prisma.wahConversation.findUniqueOrThrow({ where: { id: conv.id } });
    expect(updated.botPaused).toBe(true);

    const outbound = await prisma.wahMessage.findFirst({
      where: { conversationId: conv.id, direction: "outbound" },
      orderBy: { createdAt: "desc" },
    });
    expect(outbound?.body).toBe("Respuesta humana");
    expect(outbound?.senderUserId).toBe(fx.userId);
  });

  it("bot/resume → botPaused false en DB", async () => {
    const conv = await findOrCreateConversation({
      empresaId: fx.empresaId,
      accountId,
      contactPhone: "+549116665554",
    });

    await prisma.wahConversation.update({
      where: { id: conv.id },
      data: { botPaused: true },
    });

    const updated = await resumeBot(conv.id, fx.empresaId);
    expect(updated.botPaused).toBe(false);
  });

  it("bot/resume route responde { botPaused: false }", async () => {
    const conv = await findOrCreateConversation({
      empresaId: fx.empresaId,
      accountId,
      contactPhone: "+549115554443",
    });

    await prisma.wahConversation.update({
      where: { id: conv.id },
      data: { botPaused: true },
    });

    vi.spyOn(wahScope, "requireWahSession").mockResolvedValue({
      sessionId: "test-session-id",
      userId: fx.userId!,
      empresaId: fx.empresaId,
      email: "test@test.com",
      nombre: "Test",
      rol: "admin",
      isLoggedIn: true,
    });

    const res = await resumePost(new NextRequest("http://localhost"), {
      params: Promise.resolve({ id: conv.id }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ botPaused: false });

    vi.restoreAllMocks();
  });
});
