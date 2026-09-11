import fs from "fs/promises";
import path from "path";
import { createHash, randomUUID } from "crypto";
import prisma from "@/lib/db";
import { getWahConfig } from "@/lib/modules/wah/config";

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
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
