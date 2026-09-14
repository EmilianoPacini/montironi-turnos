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

export async function sendWhatsAppText(params: SendTextParams): Promise<{ wamid: string }> {
  const { metaAccessToken } = getWahConfig();
  const to = params.to.replace(/\D/g, "");

  if (!metaAccessToken || process.env.VITEST) {
    return { wamid: `local_${randomUUID()}` };
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
  return { wamid: json.messages?.[0]?.id ?? `local_${randomUUID()}` };
}

export async function sendWhatsAppMedia(params: SendMediaParams): Promise<{ wamid: string }> {
  const { metaAccessToken } = getWahConfig();
  const to = params.to.replace(/\D/g, "");

  if (!metaAccessToken || process.env.VITEST) {
    return { wamid: `local_${randomUUID()}` };
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
  return { wamid: json.messages?.[0]?.id ?? `local_${randomUUID()}` };
}

export async function downloadWhatsAppMedia(
  mediaId: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const { metaAccessToken } = getWahConfig();

  if (!metaAccessToken || process.env.VITEST) {
    return {
      buffer: Buffer.from(`mock-media:${mediaId}`),
      mimeType: "application/octet-stream",
    };
  }

  const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${metaAccessToken}` },
  });

  if (!metaRes.ok) {
    const detail = await metaRes.text();
    throw new Error(`Meta media metadata error: ${metaRes.status} ${detail}`);
  }

  const metaJson = (await metaRes.json()) as { url?: string; mime_type?: string };
  if (!metaJson.url) {
    throw new Error("Meta media response missing url");
  }

  const fileRes = await fetch(metaJson.url, {
    headers: { Authorization: `Bearer ${metaAccessToken}` },
  });

  if (!fileRes.ok) {
    const detail = await fileRes.text();
    throw new Error(`Meta media download error: ${fileRes.status} ${detail}`);
  }

  const buffer = Buffer.from(await fileRes.arrayBuffer());
  return { buffer, mimeType: metaJson.mime_type ?? "application/octet-stream" };
}
