import path from "path";

export function getWahConfig() {
  return {
    cimaForwardSecret: process.env.CIMA_FORWARD_SECRET ?? "",
    metaAccessToken: process.env.META_WHATSAPP_ACCESS_TOKEN ?? "",
    messageWebhookUrl: process.env.WAH_MESSAGE_WEBHOOK_URL ?? "",
    mediaDir: process.env.WAH_MEDIA_DIR ?? path.join(process.cwd(), "data", "wah-media"),
    sendFilesDir: process.env.WAH_SEND_FILES_DIR ?? path.join(process.cwd(), "data", "wah-send"),
  };
}

export function assertWahIntegrationConfigured() {
  const { cimaForwardSecret } = getWahConfig();
  if (!cimaForwardSecret) {
    throw new WahConfigError("CIMA_FORWARD_SECRET no configurado");
  }
}

export class WahConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WahConfigError";
  }
}
