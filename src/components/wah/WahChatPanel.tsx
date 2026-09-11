"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { WahConversation, WahMessage } from "@/components/wah/use-wah-api";
import {
  markWahRead,
  postWahMessage,
  resumeWahBot,
  useWahConversationDetail,
} from "@/components/wah/use-wah-api";

function senderLabel(m: WahMessage): string {
  if (m.senderType === "human") return "Humano";
  if (m.senderType === "bot") return "Bot";
  if (m.senderType === "integration") return "Integración";
  return "Contacto";
}

export function WahChatPanel({
  conversationId,
  onConversationUpdated,
}: {
  conversationId: string | null;
  onConversationUpdated: () => void;
}) {
  const { data, mutate, isLoading } = useWahConversationDetail(conversationId);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversation = data?.conversation;
  const messages = data?.messages ?? [];

  useEffect(() => {
    if (!conversationId || !conversation) return;
    if (conversation.unreadCount > 0) {
      void markWahRead(conversationId).then(() => {
        mutate();
        onConversationUpdated();
      });
    }
  }, [conversationId, conversation, mutate, onConversationUpdated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, conversationId]);

  if (!conversationId) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-slate-50/50 p-8 text-center">
        <p className="text-sm font-medium text-slate-600">Seleccioná una conversación</p>
        <p className="mt-1 text-xs text-slate-400">Los mensajes aparecerán acá</p>
      </div>
    );
  }

  if (isLoading && !conversation) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Cargando chat…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-900">
            {conversation?.contactName || conversation?.contactPhone}
          </h2>
          <p className="truncate text-xs text-slate-500">{conversation?.contactPhone}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {conversation?.botPaused ? (
            <button
              type="button"
              onClick={async () => {
                await resumeWahBot(conversationId);
                await mutate();
                onConversationUpdated();
              }}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
            >
              Reanudar bot
            </button>
          ) : (
            <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
              Bot activo
            </span>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-3">
          {messages.map((m) => {
            const outbound = m.direction === "outbound";
            return (
              <div
                key={m.id}
                className={`flex ${outbound ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${
                    outbound
                      ? "rounded-br-md bg-blue-600 text-white"
                      : "rounded-bl-md bg-slate-100 text-slate-900"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {m.body ?? `[${m.messageType}]`}
                  </p>
                  {m.media ? (
                    <a
                      href={`/api/wah/media/${m.media.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className={`mt-1 block text-xs underline ${
                        outbound ? "text-blue-100" : "text-blue-700"
                      }`}
                    >
                      {m.media.fileName}
                    </a>
                  ) : null}
                  <div
                    className={`mt-1 flex items-center gap-2 text-[10px] ${
                      outbound ? "text-blue-100" : "text-slate-500"
                    }`}
                  >
                    <span>{senderLabel(m)}</span>
                    <span>{format(new Date(m.createdAt), "HH:mm", { locale: es })}</span>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      <footer className="shrink-0 border-t border-slate-200 p-3">
        {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim() || !conversationId) return;
            setSending(true);
            setError(null);
            try {
              await postWahMessage(conversationId, text.trim());
              setText("");
              await mutate();
              onConversationUpdated();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Error al enviar");
            } finally {
              setSending(false);
            }
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribí un mensaje…"
            className="input-field flex-1 text-sm"
            disabled={sending}
          />
          <button type="submit" disabled={sending || !text.trim()} className="btn-primary px-4">
            Enviar
          </button>
        </form>
        <p className="mt-1 text-[10px] text-slate-400">
          Enviar como humano pausa el bot automáticamente.
        </p>
      </footer>
    </div>
  );
}
