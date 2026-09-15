import fs from "fs/promises";
import path from "path";
import { createHash, randomUUID } from "crypto";
import prisma from "@/lib/db";
import { getWahConfig } from "@/lib/modules/wah/config";

const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
const FETCH_MEDIA_TIMEOUT_MS = 30_000;

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  pdf: "application/pdf",
};

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export function inferMimeTypeFromFilename(filename: string, fallback = "application/octet-stream") {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return fallback;
  return EXT_MIME[ext] ?? fallback;
}

export async function fetchMediaBuffer(
  url: string,
  filename?: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MEDIA_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Media fetch failed: ${res.status}`);
    }
    const contentLength = Number(res.headers.get("content-length") ?? 0);
    if (contentLength > MAX_MEDIA_BYTES) {
      throw new Error(`Media too large: ${contentLength} bytes`);
    }
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_MEDIA_BYTES) {
      throw new Error(`Media too large: ${arrayBuffer.byteLength} bytes`);
    }
    const buffer = Buffer.from(arrayBuffer);
    const headerMime = res.headers.get("content-type")?.split(";")[0]?.trim();
    const mimeType =
      headerMime && headerMime !== "application/octet-stream"
        ? headerMime
        : filename
          ? inferMimeTypeFromFilename(filename)
          : "application/octet-stream";
    return { buffer, mimeType };
  } finally {
    clearTimeout(timer);
  }
}

/** Best-effort local copy for panel replay (cima-ai upsertMessageMedia pattern). */
export async function persistOutboundMediaBestEffort(params: {
  empresaId: string;
  messageId: string;
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  caption?: string;
  voice?: boolean;
}) {
  const existing = await prisma.wahMedia.findFirst({
    where: { messageId: params.messageId, empresaId: params.empresaId },
    select: { id: true, storagePath: true },
  });
  if (existing?.storagePath) return existing;

  try {
    return await storeWahMedia({
      empresaId: params.empresaId,
      messageId: params.messageId,
      buffer: params.buffer,
      mimeType: params.mimeType,
      fileName: params.fileName,
      caption: params.caption,
      voice: params.voice,
      subdir: "send",
    });
  } catch {
    return null;
  }
}

export async function storeWahMedia(params: {
  empresaId: string;
  messageId: string;
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  metaMediaId?: string;
  caption?: string;
  width?: number;
  height?: number;
  durationMs?: number;
  voice?: boolean;
  subdir?: "media" | "send";
}) {
  const { mediaDir, sendFilesDir } = getWahConfig();
  const baseDir = params.subdir === "send" ? sendFilesDir : mediaDir;
  await ensureDir(baseDir);

  const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = path.join(baseDir, `${randomUUID()}_${safeName}`);
  await fs.writeFile(storagePath, params.buffer);

  const sha256 = createHash("sha256").update(params.buffer).digest("hex");

  return prisma.wahMedia.create({
    data: {
      empresaId: params.empresaId,
      messageId: params.messageId,
      metaMediaId: params.metaMediaId,
      mimeType: params.mimeType,
      fileName: params.fileName,
      storagePath,
      fileSize: params.buffer.length,
      sha256,
      caption: params.caption,
      width: params.width,
      height: params.height,
      durationMs: params.durationMs,
      voice: params.voice ?? false,
    },
  });
}

export async function getWahMediaForEmpresa(mediaId: string, empresaId: string) {
  return prisma.wahMedia.findFirst({
    where: { id: mediaId, empresaId },
  });
}

export async function readWahMediaFile(media: { storagePath: string }) {
  return fs.readFile(media.storagePath);
}
