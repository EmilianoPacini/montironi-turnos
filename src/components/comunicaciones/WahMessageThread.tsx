"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { WahContact, WahMessage } from "@/lib/modules/wah/types";

export function WahMessageThread({
  contact,
  messages,
  loading,
  onSend,
  sending,
}: {
  contact: WahContact | null;
  messages: WahMessage[];
  loading: boolean;
  onSend: (text: string) => Promise<void>;
  sending: boolean;
}) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    await onSend(text);
    textareaRef.current?.focus();
  }

  if (!contact) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 p-8 text-center">
        <div className="rounded-full bg-sky-100 p-4 text-sky-600">
          <svg aria-hidden="true" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="mt-4 text-lg font-semibold text-slate-900">Seleccioná un contacto</p>
        <p className="mt-1 max-w-sm text-sm text-slate-600">
          Elegí una conversación de la lista para ver el historial y responder por WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-900">{contact.nombre}</h2>
          <p className="truncate text-sm text-slate-500">{contact.telefono}</p>
        </div>
        {contact.clienteId ? (
          <Link
            href={`/clientes/${contact.clienteId}`}
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Ver cliente
          </Link>
        ) : null}
      </header>

      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        role="log"
        aria-live="polite"
        aria-label={`Mensajes con ${contact.nombre}`}
      >
        {loading ? (
          <p className="text-center text-sm text-slate-500">Cargando mensajes…</p>
        ) : null}

        {!loading && messages.length === 0 ? (
          <p className="text-center text-sm text-slate-500">Sin mensajes en esta conversación.</p>
        ) : null}

        <ul className="space-y-3">
          {messages.map((msg) => {
            const outbound = msg.direccion === "saliente";
            return (
              <li
                key={msg.id}
                className={`flex ${outbound ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    outbound
                      ? "rounded-br-md bg-blue-600 text-white"
                      : "rounded-bl-md border border-slate-200 bg-white text-slate-900"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.cuerpo}</p>
                  <p
                    className={`mt-1 text-right text-[11px] ${
                      outbound ? "text-blue-100" : "text-slate-400"
                    }`}
                  >
                    {format(new Date(msg.enviadoAt), "dd/MM HH:mm", { locale: es })}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-slate-200 bg-white p-4"
        aria-label="Compositor de mensajes"
      >
        <label htmlFor="wah-message-input" className="sr-only">
          Escribir mensaje
        </label>
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            id="wah-message-input"
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit(e);
              }
            }}
            placeholder="Escribí un mensaje…"
            disabled={sending}
            className="input-field min-h-[44px] resize-none"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="btn-primary shrink-0 px-4 py-2.5"
            aria-label="Enviar mensaje"
          >
            {sending ? "Enviando…" : "Enviar"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Enter para enviar · Shift+Enter para nueva línea</p>
      </form>
    </div>
  );
}
