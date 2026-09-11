"use client";

import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export type WahAccount = {
  id: string;
  label: string;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  active: boolean;
};

export type WahConversation = {
  id: string;
  accountId: string;
  clienteId: string | null;
  contactName: string | null;
  contactPhone: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  botPaused: boolean;
  pendingHuman: boolean;
  cliente: { id: string; nombre: string } | null;
};

export type WahMessage = {
  id: string;
  direction: string;
  senderType: string;
  messageType: string;
  body: string | null;
  status: string;
  createdAt: string;
  media: { id: string; mimeType: string; fileName: string } | null;
};

export type WahKpis = {
  total: number;
  unread: number;
  pending: number;
  botPaused: number;
};

export function useWahAccounts() {
  return useSWR<{ accounts: WahAccount[] }>("/api/wah/accounts", fetcher, {
    refreshInterval: 30_000,
  });
}

export function useWahDashboard(accountId: string | null) {
  const qs = accountId ? `?accountId=${accountId}` : "";
  return useSWR<{ kpis: WahKpis }>(`/api/wah/dashboard${qs}`, fetcher, {
    refreshInterval: 8_000,
  });
}

export function useWahConversations(accountId: string | null, filter: string) {
  const params = new URLSearchParams();
  if (accountId) params.set("accountId", accountId);
  if (filter !== "all") params.set("filter", filter);
  const qs = params.toString() ? `?${params}` : "";
  return useSWR<{ conversations: WahConversation[] }>(
    `/api/wah/conversations${qs}`,
    fetcher,
    { refreshInterval: 5_000 }
  );
}

export function useWahConversationDetail(conversationId: string | null) {
  return useSWR<{ conversation: WahConversation; messages: WahMessage[] }>(
    conversationId ? `/api/wah/conversations/${conversationId}` : null,
    fetcher,
    { refreshInterval: 4_000 }
  );
}

export async function postWahMessage(conversationId: string, body: string) {
  const res = await fetch(`/api/wah/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Error al enviar");
  }
  return res.json();
}

export async function markWahRead(conversationId: string) {
  await fetch(`/api/wah/conversations/${conversationId}/read`, {
    method: "POST",
    credentials: "include",
  });
}

export async function resumeWahBot(conversationId: string) {
  const res = await fetch(`/api/wah/conversations/${conversationId}/bot/resume`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("No se pudo reanudar el bot");
  return res.json();
}
