"use client";

import { useState } from "react";
import { removeBlockAction } from "@/lib/modules/appointments/actions";
import { useActionTransition } from "@/components/turnos/use-action-transition";

export function BlockTile({
  blockId,
  top,
  height,
  motivo,
  autor,
}: {
  blockId: string;
  top: number;
  height: number;
  motivo?: string | null;
  autor?: string;
}) {
  const [error, setError] = useState<string | undefined>();
  const { pending, runAction } = useActionTransition(setError);

  function handleRemove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("¿Quitar este bloqueo de bahía?")) return;
    setError(undefined);
    runAction(() => removeBlockAction(blockId));
  }

  return (
    <div
      className="absolute inset-x-1 rounded border border-slate-400 bg-slate-200 px-2 py-1 text-xs text-slate-700"
      style={{ top, height: Math.max(height, 24) }}
    >
      <div className="flex items-start justify-between gap-1">
        <div>
          <span className="font-semibold">Bloqueado</span>
          {motivo ? ` · ${motivo}` : ""}
          {autor ? <span className="block text-[10px] opacity-75">por {autor}</span> : null}
          {error ? <span className="mt-1 block text-[10px] font-medium text-red-700">{error}</span> : null}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={handleRemove}
          className="shrink-0 rounded px-1 text-[10px] font-semibold text-slate-600 underline hover:text-slate-900 disabled:opacity-50"
          title="Quitar bloqueo"
        >
          Quitar
        </button>
      </div>
    </div>
  );
}
