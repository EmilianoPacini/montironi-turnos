"use client";

import { useCallback, useEffect, useState } from "react";
import type { WahContact, WahKpis, WahMessage } from "@/lib/modules/wah/types";
import { WahContactsList } from "./WahContactsList";
import { WahKpiStrip } from "./WahKpiStrip";
import { WahMessageThread } from "./WahMessageThread";

export function WahChatPanel() {
  const [contacts, setContacts] = useState<WahContact[]>([]);
  const [kpis, setKpis] = useState<WahKpis | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeContact, setActiveContact] = useState<WahContact | null>(null);
  const [messages, setMessages] = useState<WahMessage[]>([]);
  const [search, setSearch] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContacts = useCallback(async (q?: string) => {
    const params = q ? `?search=${encodeURIComponent(q)}` : "";
    const res = await fetch(`/api/wah/contacts${params}`);
    if (!res.ok) throw new Error("No se pudieron cargar los contactos");
    const data = await res.json();
    setContacts(data.contacts ?? []);
  }, []);

  const loadKpis = useCallback(async () => {
    const res = await fetch("/api/wah/kpis");
    if (!res.ok) throw new Error("No se pudieron cargar los indicadores");
    const data = await res.json();
    setKpis(data.kpis ?? null);
  }, []);

  const loadMessages = useCallback(async (chatId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/wah/chats/${chatId}/messages`);
      if (!res.ok) throw new Error("No se pudo cargar la conversación");
      const data = await res.json();
      setActiveContact(data.contact ?? null);
      setMessages(data.messages ?? []);
      setContacts((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, noLeidos: 0 } : c))
      );
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoadingContacts(true);
      setError(null);
      try {
        await Promise.all([loadContacts(), loadKpis()]);
      } catch {
        setError("Error al cargar comunicaciones. Intentá de nuevo.");
      } finally {
        setLoadingContacts(false);
      }
    })();
  }, [loadContacts, loadKpis]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadContacts(search).catch(() => {
        setError("Error al buscar contactos.");
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [search, loadContacts]);

  useEffect(() => {
    if (selectedId) {
      void loadMessages(selectedId);
    } else {
      setActiveContact(null);
      setMessages([]);
    }
  }, [selectedId, loadMessages]);

  async function handleSend(text: string) {
    if (!selectedId) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/wah/chats/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("No se pudo enviar el mensaje");
      const data = await res.json();
      setMessages((prev) => [...prev, data.message]);
      await Promise.all([loadContacts(search), loadKpis()]);
    } catch {
      setError("No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="panel-card flex h-[calc(100vh-8rem)] min-h-[520px] flex-col overflow-hidden">
      {error ? (
        <div
          role="alert"
          className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <WahContactsList
          contacts={contacts}
          selectedId={selectedId}
          onSelect={setSelectedId}
          search={search}
          onSearchChange={setSearch}
          loading={loadingContacts}
        />

        <section className="flex min-w-0 flex-1 flex-col">
          <WahKpiStrip kpis={kpis} />
          <WahMessageThread
            contact={activeContact}
            messages={messages}
            loading={loadingMessages}
            onSend={handleSend}
            sending={sending}
          />
        </section>
      </div>
    </div>
  );
}
