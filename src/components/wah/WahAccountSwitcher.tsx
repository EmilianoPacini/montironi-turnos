"use client";

import type { WahAccount } from "@/components/wah/use-wah-api";

export function WahAccountSwitcher({
  accounts,
  value,
  onChange,
}: {
  accounts: WahAccount[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  if (accounts.length === 0) {
    return (
      <p className="text-sm text-slate-500">Sin cuentas WhatsApp configuradas.</p>
    );
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium text-slate-600">Cuenta</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="input-field max-w-xs py-1.5 text-sm"
      >
        <option value="">Todas</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
            {a.displayPhoneNumber ? ` (${a.displayPhoneNumber})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
