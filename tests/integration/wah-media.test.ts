import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as sendAudioPost } from "@/app/api/wah/integration/send-audio/route";
import { POST as sendFilePost } from "@/app/api/wah/integration/send-file/route";
import { GET as conversationGet } from "@/app/api/wah/conversations/[id]/route";
import { POST as webhookPost } from "@/app/api/webhooks/whatsapp/received-data/route";
import { getWahConversationDetail } from "@/lib/modules/wah/conversation.service";
import {
  createTestFixture,
  createWahAccount,
  destroyTestFixture,
  prisma,
  type TestFixture,
} from "../helpers/fixture";
import * as wahScope from "@/lib/modules/wah/scope";

const FORWARD_SECRET = "test-cima-forward-secret";
const PHONE_NUMBER_ID = "1383772331475918";
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

describe("WAH · media panel visibility", () => {
  let fx: TestFixture;
  let accountId: string;
  let sendDir: string;

  beforeAll(async () => {
    process.env.CIMA_FORWARD_SECRET = FORWARD_SECRET;
    sendDir = await mkdtemp(path.join(tmpdir(), "wah-send-"));
    process.env.WAH_SEND_FILES_DIR = sendDir;
    fx = await createTestFixture(`wah-media-${Date.now()}`);
    const account = await createWahAccount(fx.empresaId, "media", PHONE_NUMBER_ID);
    accountId = account.id;
  });

  afterAll(async () => {
    await destroyTestFixture(fx.empresaId);
    await prisma.$disconnect();
    await rm(sendDir, { recursive: true, force: true });
  });

  it("send-file persiste wah_media y aparece en conversation detail", async () => {
    const mediaUrl = "https://example.com/promo.jpg";
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === mediaUrl) {
        return new Response(PNG_BYTES, {
          status: 200,
          headers: { "Content-Type": "image/png" },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const res = await sendFilePost(
      new NextRequest("http://localhost/api/wah/integration/send-file", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Cima-Forward-Secret": FORWARD_SECRET,
        },
        body: JSON.stringify({
          empresa_id: fx.empresaId,
          account_id: accountId,
          to: "+549119887766",
          file_url: mediaUrl,
          filename: "promo.jpg",
          caption: "Oferta",
        }),
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message.media).toMatchObject({
      mimeType: "image/png",
      fileName: "promo.jpg",
    });

    const mediaRow = await prisma.wahMedia.findFirst({
      where: { messageId: json.message_id },
    });
    expect(mediaRow?.storagePath).toContain(sendDir);

    const detail = await getWahConversationDetail(json.conversation_id, fx.empresaId);
    const outbound = detail?.messages.find((m) => m.id === json.message_id);
    expect(outbound?.media?.mimeType).toBe("image/png");

    fetchSpy.mockRestore();
  });

  it("send-audio persiste wah_media", async () => {
    const mediaUrl = "https://example.com/voice.ogg";
    const audioBytes = Buffer.from("fake-audio");
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === mediaUrl) {
        return new Response(audioBytes, {
          status: 200,
          headers: { "Content-Type": "audio/ogg" },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const res = await sendAudioPost(
      new NextRequest("http://localhost/api/wah/integration/send-audio", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Cima-Forward-Secret": FORWARD_SECRET,
        },
        body: JSON.stringify({
          empresa_id: fx.empresaId,
          account_id: accountId,
          to: "+549118776655",
          audio_url: mediaUrl,
          filename: "voice.ogg",
        }),
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message.media?.mimeType).toBe("audio/ogg");

    const mediaRow = await prisma.wahMedia.findFirst({
      where: { messageId: json.message_id },
    });
    expect(mediaRow).toBeTruthy();

    fetchSpy.mockRestore();
  });

  it("send-file sin fetch de media sigue creando mensaje outbound", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));

    const res = await sendFilePost(
      new NextRequest("http://localhost/api/wah/integration/send-file", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Cima-Forward-Secret": FORWARD_SECRET,
        },
        body: JSON.stringify({
          empresa_id: fx.empresaId,
          account_id: accountId,
          to: "+549117665544",
          file_url: "https://example.com/missing.jpg",
          filename: "missing.jpg",
        }),
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message_id).toBeTruthy();
    expect(json.message.media).toBeNull();

    const mediaRow = await prisma.wahMedia.findFirst({
      where: { messageId: json.message_id },
    });
    expect(mediaRow).toBeNull();

    fetchSpy.mockRestore();
  });

  it("GET panel conversation incluye media en mensajes outbound", async () => {
    const mediaUrl = "https://example.com/panel-check.jpg";
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      if (String(input) === mediaUrl) {
        return new Response(PNG_BYTES, {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        });
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    });

    const sendRes = await sendFilePost(
      new NextRequest("http://localhost/api/wah/integration/send-file", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Cima-Forward-Secret": FORWARD_SECRET,
        },
        body: JSON.stringify({
          empresa_id: fx.empresaId,
          account_id: accountId,
          to: "+549110011223",
          file_url: mediaUrl,
          filename: "panel-check.jpg",
        }),
      })
    );
    const sent = await sendRes.json();

    vi.spyOn(wahScope, "requireWahSession").mockResolvedValue({
      sessionId: "test-session",
      userId: fx.userId!,
      empresaId: fx.empresaId,
      email: "test@test.com",
      nombre: "Test",
      rol: "admin",
      isLoggedIn: true,
    });

    const res = await conversationGet(new NextRequest("http://localhost"), {
      params: Promise.resolve({ id: sent.conversation_id }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    const msg = json.messages.find((m: { id: string }) => m.id === sent.message_id);
    expect(msg?.media?.id).toBeTruthy();

    fetchSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("webhook inbound persiste mensaje aunque falle descarga de media", async () => {
    vi.spyOn(
      await import("@/lib/modules/wah/meta-client"),
      "downloadWhatsAppMedia"
    ).mockRejectedValue(new Error("Meta token invalid"));

    const wamid = `wamid.media-fail.${Date.now()}`;
    const res = await webhookPost(
      new NextRequest("http://localhost/api/webhooks/whatsapp/received-data", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Cima-Forward-Secret": FORWARD_SECRET,
        },
        body: JSON.stringify({
          object: "whatsapp_business_account",
          entry: [
            {
              changes: [
                {
                  field: "messages",
                  value: {
                    messaging_product: "whatsapp",
                    metadata: { phone_number_id: PHONE_NUMBER_ID },
                    messages: [
                      {
                        from: "549116554433",
                        id: wamid,
                        type: "image",
                        image: { id: "meta-img-123", mime_type: "image/jpeg" },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        }),
      })
    );

    expect(res.status).toBe(200);
    const message = await prisma.wahMessage.findFirst({ where: { wamid } });
    expect(message?.body).toBe("[image]");
    const mediaRow = await prisma.wahMedia.findFirst({ where: { messageId: message!.id } });
    expect(mediaRow).toBeNull();

    vi.restoreAllMocks();
  });
});
