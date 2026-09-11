import { randomUUID } from "crypto";
import { getWahConfig } from "@/lib/modules/wah/config";

type SendTextParams = {
  phoneNumberId: string;
  to: string;
  text: string;
};

type SendMediaParams = SendTextParams & {
  mediaType: "audio" | "document" | "image" | "video";
  mediaUrl?: string;
  mediaId?: string;
  filename?: string;
  caption?: string;
};

export async function sendWhatsAppText(params: SendTextParams): Promise<{ waMessageId: string }> {
  const { metaAccessToken } = getWahConfig();
  const to = params.to.replace(/\D/g, "");

  if (!metaAccessToken) {
    return { waMessageId: `local_${randomUUID()}` };
  }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${params.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${metaAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: params.text },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Meta API error: ${res.status} ${detail}`);
  }

  const json = (await res.json()) as { messages?: { id: string }[] };
  const waMessageId = json.messages?.[0]?.id ?? `local_${randomUUID()}`;
  return { waMessageId };
}

export async function sendWhatsAppMedia(params: SendMediaParams): Promise<{ waMessageId: string }> {
  const { metaAccessToken } = getWahConfig();
  const to = params.to.replace(/\D/g, "");

  if (!metaAccessToken) {
    return { waMessageId: `local_${randomUUID()}` };
  }

  const mediaPayload: Record<string, unknown> = params.mediaId
    ? { id: params.mediaId }
    : { link: params.mediaUrl };
  if (params.filename && params.mediaType === "document") {
    mediaPayload.filename = params.filename;
  }
  if (params.caption && (params.mediaType === "document" || params.mediaType === "image")) {
    mediaPayload.caption = params.caption;
  }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${params.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${metaAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: params.mediaType,
        [params.mediaType]: mediaPayload,
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Meta API error: ${res.status} ${detail}`);
  }

  const json = (await res.json()) as { messages?: { id: string }[] };
  return { waMessageId: json.messages?.[0]?.id ?? `local_${randomUUID()}` };
}
