import { NextRequest } from "next/server";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { POST as webhookPost } from "@/app/api/webhooks/whatsapp/received-data/route";
import {
  createTestFixture,
  createWahAccount,
  destroyTestFixture,
  prisma,
  type TestFixture,
} from "../helpers/fixture";

const FORWARD_SECRET = "test-cima-forward-secret";
const PHONE_NUMBER_ID = "1383772331475918";

function buildInboundPayload(params: {
  phoneNumberId: string;
  from: string;
  wamid: string;
  body: string;
  contactName?: string;
}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-test",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "15550001111",
                phone_number_id: params.phoneNumberId,
              },
              contacts: params.contactName
                ? [{ profile: { name: params.contactName }, wa_id: params.from }]
                : [],
              messages: [
                {
                  from: params.from,
                  id: params.wamid,
                  timestamp: "1749416383",
                  type: "text",
                  text: { body: params.body },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function buildStatusPayload(params: {
  phoneNumberId: string;
  wamid: string;
  status: string;
}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-test",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: params.phoneNumberId },
              statuses: [
                {
                  id: params.wamid,
                  status: params.status,
                  timestamp: "1749416390",
                  recipient_id: "549119998877",
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe("WhatsApp webhook · POST /api/webhooks/whatsapp/received-data", () => {
  let fx: TestFixture;

  beforeAll(async () => {
    process.env.CIMA_FORWARD_SECRET = FORWARD_SECRET;
    fx = await createTestFixture(`wah-webhook-${Date.now()}`);
    await createWahAccount(fx.empresaId, "real-line", PHONE_NUMBER_ID);
  });

  afterAll(async () => {
    await destroyTestFixture(fx.empresaId);
    await prisma.$disconnect();
  });

  it("sin secret → 401", async () => {
    const request = new NextRequest("http://localhost/api/webhooks/whatsapp/received-data", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildInboundPayload({
        phoneNumberId: PHONE_NUMBER_ID,
        from: "549119998877",
        wamid: "wamid.unauth",
        body: "Hola",
      })),
    });

    const res = await webhookPost(request);
    expect(res.status).toBe(401);
  });

  it("phone_number_id desconocido → 404", async () => {
    const request = new NextRequest("http://localhost/api/webhooks/whatsapp/received-data", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Cima-Forward-Secret": FORWARD_SECRET,
      },
      body: JSON.stringify(buildInboundPayload({
        phoneNumberId: "0000000000000000",
        from: "549119998877",
        wamid: "wamid.unknown-phone",
        body: "Hola",
      })),
    });

    const res = await webhookPost(request);
    expect(res.status).toBe(404);
  });

  it("happy path: persiste inbound text + idempotencia wamid + status update", async () => {
    const wamid = `wamid.happy.${Date.now()}`;
    const body = "Quiero un turno";

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    process.env.WAH_MESSAGE_WEBHOOK_URL = "https://n8n.example/webhook/inbound";

    const payload = buildInboundPayload({
      phoneNumberId: PHONE_NUMBER_ID,
      from: "549119998877",
      wamid,
      body,
      contactName: "Cliente Test",
    });

    const request = new NextRequest("http://localhost/api/webhooks/whatsapp/received-data", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Cima-Forward-Secret": FORWARD_SECRET,
      },
      body: JSON.stringify(payload),
    });

    const res = await webhookPost(request);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.messages).toHaveLength(1);
    expect(json.messages[0].wamid).toBe(wamid);
    expect(json.messages[0].skipped).toBeFalsy();

    const message = await prisma.wahMessage.findFirst({ where: { wamid } });
    expect(message?.body).toBe(body);
    expect(message?.direction).toBe("inbound");
    expect(message?.senderType).toBe("contact");

    const conversation = await prisma.wahConversation.findFirst({
      where: { id: message!.conversationId },
    });
    expect(conversation?.contactPhone).toBe("+549119998877");
    expect(conversation?.waContactId).toBe("549119998877@s.whatsapp.net");
    expect(conversation?.contactName).toBe("Cliente Test");
    expect(conversation?.unreadCount).toBeGreaterThan(0);

    expect(fetchSpy).toHaveBeenCalled();

    const dupRequest = new NextRequest("http://localhost/api/webhooks/whatsapp/received-data", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Cima-Forward-Secret": FORWARD_SECRET,
      },
      body: JSON.stringify(payload),
    });

    const dupRes = await webhookPost(dupRequest);
    expect(dupRes.status).toBe(200);
    const dupJson = await dupRes.json();
    expect(dupJson.messages[0].skipped).toBe(true);

    const count = await prisma.wahMessage.count({ where: { wamid } });
    expect(count).toBe(1);

    const statusRequest = new NextRequest("http://localhost/api/webhooks/whatsapp/received-data", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Cima-Forward-Secret": FORWARD_SECRET,
      },
      body: JSON.stringify(buildStatusPayload({
        phoneNumberId: PHONE_NUMBER_ID,
        wamid,
        status: "delivered",
      })),
    });

    const statusRes = await webhookPost(statusRequest);
    expect(statusRes.status).toBe(200);
    const statusJson = await statusRes.json();
    expect(statusJson.statuses[0].updated).toBe(1);

    const updated = await prisma.wahMessage.findFirstOrThrow({ where: { wamid } });
    expect(updated.status).toBe("delivered");

    fetchSpy.mockRestore();
    delete process.env.WAH_MESSAGE_WEBHOOK_URL;
  });

  it("no forward n8n cuando bot_paused=true", async () => {
    const wamid = `wamid.paused.${Date.now()}`;
    const account = await prisma.whatsappAccount.findFirstOrThrow({
      where: { phoneNumberId: PHONE_NUMBER_ID },
    });

    const conversation = await prisma.wahConversation.create({
      data: {
        empresaId: fx.empresaId,
        accountId: account.id,
        waContactId: "549118887776@s.whatsapp.net",
        contactPhone: "+549118887776",
        botPaused: true,
      },
    });

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    process.env.WAH_MESSAGE_WEBHOOK_URL = "https://n8n.example/webhook/inbound";

    const request = new NextRequest("http://localhost/api/webhooks/whatsapp/received-data", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Cima-Forward-Secret": FORWARD_SECRET,
      },
      body: JSON.stringify(buildInboundPayload({
        phoneNumberId: PHONE_NUMBER_ID,
        from: "549118887776",
        wamid,
        body: "Bot pausado",
      })),
    });

    const res = await webhookPost(request);
    expect(res.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();

    await prisma.wahConversation.delete({ where: { id: conversation.id } });
    fetchSpy.mockRestore();
    delete process.env.WAH_MESSAGE_WEBHOOK_URL;
  });
});
