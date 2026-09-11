"use client";

import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import type { WahContact } from "@/lib/modules/wah/types";

function formatContactTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Ayer";
  return format(date, "dd/MM", { locale: es });
}

export function WahContactsList({
  contacts,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  loading,
}: {
  contacts: WahContact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  loading: boolean;
}) {
  return (
    <aside
      className="flex w-[270px] shrink-0 flex-col border-r border-slate-200 bg-white"
      aria-label="Lista de contactos"
    >
      <div className="border-b border-slate-200 p-3">
        <label htmlFor="wah-contact-search" className="sr-only">
          Buscar contactos
        </label>
        <input
          id="wah-contact-search"
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar contacto..."
          className="input-field"
          autoComplete="off"
        />
      </div>

      <div
        className="flex-1 overflow-y-auto"
        role="listbox"
        aria-label="Contactos de WhatsApp"
        aria-activedescendant={selectedId ? `contact-${selectedId}` : undefined}
      >
        {loading && contacts.length === 0 ? (
          <p className="p-4 text-center text-sm text-slate-500">Cargando contactos…</p>
        ) : null}

        {!loading && contacts.length === 0 ? (
          <p className="p-4 text-center text-sm text-slate-500">
            {search ? "Sin resultados" : "No hay conversaciones"}
          </p>
        ) : null}

        <ul className="divide-y divide-slate-100">
          {contacts.map((contact) => {
            const active = contact.id === selectedId;
            return (
              <li key={contact.id} role="presentation">
                <button
                  id={`contact-${contact.id}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => onSelect(contact.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(contact.id);
                    }
                  }}
                  className={`flex w-full gap-3 px-3 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                    active
                      ? "bg-blue-50 text-blue-900"
                      : "hover:bg-slate-50 text-slate-900"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      active ? "bg-blue-600 text-white" : "bg-sky-100 text-sky-700"
                    }`}
                    aria-hidden="true"
                  >
                    {contact.nombre.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium">{contact.nombre}</span>
                      <span className="shrink-0 text-xs text-slate-500">
                        {formatContactTime(contact.ultimoMensajeAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-slate-600">
                        {contact.ultimoMensaje ?? contact.telefono}
                      </span>
                      {contact.noLeidos > 0 ? (
                        <span
                          className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-sky-500 px-1.5 text-xs font-semibold text-white"
                          aria-label={`${contact.noLeidos} sin leer`}
                        >
                          {contact.noLeidos}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
