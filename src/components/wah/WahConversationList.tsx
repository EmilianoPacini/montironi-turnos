"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { WahConversation } from "@/components/wah/use-wah-api";

export function WahConversationList({
  conversations,
  selectedId,
  onSelect,
  loading,
}: {
  conversations: WahConversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
}) {
  if (loading && conversations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-slate-500">
        Cargando conversaciones…
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-slate-500">
        No hay conversaciones para este filtro.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 overflow-y-auto">
      {conversations.map((c) => {
        const active = c.id === selectedId;
        const title = c.contactName || c.contactPhone;
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className={`w-full px-3 py-2.5 text-left transition ${
                active ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : "hover:bg-slate-50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="truncate text-sm font-semibold text-slate-900">{title}</span>
                {c.unreadCount > 0 ? (
                  <span className="shrink-0 rounded-full bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {c.unreadCount}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {c.lastMessagePreview ?? c.contactPhone}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {c.lastMessageAt ? (
                  <span className="text-[10px] text-slate-400">
                    {format(new Date(c.lastMessageAt), "dd MMM HH:mm", { locale: es })}
                  </span>
                ) : null}
                {c.pendingHuman ? (
                  <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-800">
                    Pendiente
                  </span>
                ) : null}
                {c.botPaused ? (
                  <span className="rounded bg-violet-100 px-1 py-0.5 text-[10px] font-medium text-violet-800">
                    Bot off
                  </span>
                ) : null}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
