"use client";

import { useState } from "react";
import type { WahAccount } from "@/components/wah/use-wah-api";

export function WahAccountForm({
  onSaved,
}: {
  onSaved: (account: WahAccount) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        + Cuenta WhatsApp
      </button>
    );
  }

  return (
    <form
      className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        try {
          const res = await fetch("/api/wah/accounts", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              label: label.trim() || undefined,
              displayPhoneNumber: displayPhoneNumber.trim() || undefined,
              phoneNumberId: phoneNumberId.trim(),
              wabaId: wabaId.trim() || undefined,
            }),
          });
          const json = (await res.json().catch(() => ({}))) as {
            account?: WahAccount;
            error?: string;
          };
          if (!res.ok) {
            throw new Error(json.error ?? "No se pudo guardar la cuenta");
          }
          if (!json.account) throw new Error("Respuesta inválida");
          onSaved(json.account);
          setLabel("");
          setDisplayPhoneNumber("");
          setPhoneNumberId("");
          setWabaId("");
          setOpen(false);
        } catch (err) {
          setError(err instanceof Error ? err.message : "No se pudo guardar la cuenta");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Cuenta WhatsApp</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-slate-500 underline"
        >
          Cancelar
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        El phone number id es el de Meta (Graph), no el 549… del cliente. Recibir y enviar
        quedan atados a esa línea.
      </p>
      {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Nombre</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="input-field"
            placeholder="Línea Mendoza / Montironi"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Número visible</span>
          <input
            value={displayPhoneNumber}
            onChange={(e) => setDisplayPhoneNumber(e.target.value)}
            className="input-field"
            placeholder="5492616106452"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Phone number id</span>
          <input
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            className="input-field"
            required
            inputMode="numeric"
            placeholder="1285123408020696"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">WABA id</span>
          <input
            value={wabaId}
            onChange={(e) => setWabaId(e.target.value)}
            className="input-field"
            inputMode="numeric"
            placeholder="1970101330374296"
          />
        </label>
      </div>
      <button type="submit" disabled={pending} className="btn-primary mt-3">
        {pending ? "Guardando…" : "Guardar cuenta"}
      </button>
    </form>
  );
}
