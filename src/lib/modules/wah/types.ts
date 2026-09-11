/** WAH column literals — aligned to 005_comunicaciones_wah.sql (TEXT, no PG enums). */

export const WAH_DIRECTION = {
  inbound: "inbound",
  outbound: "outbound",
} as const;

export type WahDirection = (typeof WAH_DIRECTION)[keyof typeof WAH_DIRECTION];

export const WAH_SENDER_TYPE = {
  contact: "contact",
  human: "human",
  bot: "bot",
  integration: "integration",
} as const;

export type WahSenderType = (typeof WAH_SENDER_TYPE)[keyof typeof WAH_SENDER_TYPE];

export const WAH_MESSAGE_TYPE = {
  text: "text",
  audio: "audio",
  file: "file",
  image: "image",
  document: "document",
  video: "video",
  sticker: "sticker",
  system: "system",
} as const;

export type WahMessageType = (typeof WAH_MESSAGE_TYPE)[keyof typeof WAH_MESSAGE_TYPE];
