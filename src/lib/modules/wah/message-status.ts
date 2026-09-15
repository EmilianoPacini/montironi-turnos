/** Meta Cloud API delivery statuses for outbound WhatsApp messages. */
export const WAH_MESSAGE_STATUSES = [
  "sent",
  "delivered",
  "read",
  "failed",
] as const;

export type WahMessageStatus = (typeof WAH_MESSAGE_STATUSES)[number];

const STATUS_RANK: Record<string, number> = {
  received: 0,
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 99,
};

export function normalizeWahStatus(raw: string | null | undefined) {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "failed" || value === "error") return "failed";
  if (value === "read") return "read";
  if (value === "delivered") return "delivered";
  if (value === "sent" || value === "enviado") return "sent";
  if (value === "received" || value === "recibido") return "received";
  return value || "sent";
}

/** Prefer newer delivery state; `failed` always wins. */
export function shouldApplyStatusUpdate(
  current: string | null | undefined,
  next: string | null | undefined
) {
  const from = normalizeWahStatus(current);
  const to = normalizeWahStatus(next);
  if (to === "failed") return from !== "failed";
  if (from === "failed") return false;
  return (STATUS_RANK[to] ?? 0) >= (STATUS_RANK[from] ?? 0);
}

export function wahStatusLabel(status: string | null | undefined) {
  switch (normalizeWahStatus(status)) {
    case "sent":
      return "Enviado";
    case "delivered":
      return "Entregado";
    case "read":
      return "Leído";
    case "failed":
      return "Fallido";
    case "received":
      return "Recibido";
    default:
      return status || "";
  }
}

export function wahStatusTicks(status: string | null | undefined) {
  switch (normalizeWahStatus(status)) {
    case "read":
      return { color: "#53bdeb", text: "✓✓" };
    case "delivered":
      return { color: "inherit", text: "✓✓" };
    case "sent":
      return { color: "inherit", text: "✓" };
    case "failed":
      return { color: "#f87171", text: "!" };
    default:
      return { color: "inherit", text: "" };
  }
}
