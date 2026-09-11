/**
 * Referencia original — estructura de fetches y layout de WahChatPanel.
 * Portado a Tailwind en src/components/comunicaciones/WahChatPanel.tsx
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import type { WahContact, WahKpis, WahMessage } from "@/lib/modules/wah/types";

export function WahChatPanelReference() {
  const [contacts, setContacts] = useState<WahContact[]>([]);
  const [kpis, setKpis] = useState<WahKpis | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WahMessage[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const loadContacts = useCallback(async (q?: string) => {
    const params = q ? `?search=${encodeURIComponent(q)}` : "";
    const res = await fetch(`/api/wah/contacts${params}`);
    const data = await res.json();
    setContacts(data.contacts ?? []);
  }, []);

  const loadKpis = useCallback(async () => {
    const res = await fetch("/api/wah/kpis");
    const data = await res.json();
    setKpis(data.kpis ?? null);
  }, []);

  const loadMessages = useCallback(async (chatId: string) => {
    const res = await fetch(`/api/wah/chats/${chatId}/messages`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages ?? []);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await Promise.all([loadContacts(), loadKpis()]);
      setLoading(false);
    })();
  }, [loadContacts, loadKpis]);

  useEffect(() => {
    const t = setTimeout(() => void loadContacts(search), 250);
    return () => clearTimeout(t);
  }, [search, loadContacts]);

  useEffect(() => {
    if (selectedId) void loadMessages(selectedId);
    else setMessages([]);
  }, [selectedId, loadMessages]);

  async function sendMessage(text: string) {
    if (!selectedId || !text.trim()) return;
    const res = await fetch(`/api/wah/chats/${selectedId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setMessages((prev) => [...prev, data.message]);
    void loadContacts(search);
    void loadKpis();
  }

  return (
    <div className="wah-chat-panel">
      <aside className="wah-contacts" style={{ width: 270 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." />
        {loading ? <p>Cargando...</p> : null}
        <ul>
          {contacts.map((c) => (
            <li key={c.id} onClick={() => setSelectedId(c.id)}>
              {c.nombre} {c.noLeidos > 0 ? `(${c.noLeidos})` : ""}
            </li>
          ))}
        </ul>
      </aside>
      <section className="wah-main">
        <div className="wah-kpis">
          {kpis ? (
            <>
              <span>Activas: {kpis.conversacionesActivas}</span>
              <span>Sin responder: {kpis.sinResponder}</span>
              <span>Hoy: {kpis.mensajesHoy}</span>
            </>
          ) : null}
        </div>
        <div className="wah-thread">
          {messages.map((m) => (
            <div key={m.id} className={m.direccion}>{m.cuerpo}</div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void sendMessage(String(fd.get("text") ?? ""));
            e.currentTarget.reset();
          }}
        >
          <input name="text" disabled={!selectedId} />
          <button type="submit" disabled={!selectedId}>Enviar</button>
        </form>
      </section>
    </div>
  );
}
