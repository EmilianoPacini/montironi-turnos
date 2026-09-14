"use client";

import { useRouter } from "next/navigation";

type TallerOption = { id: string; nombre: string };

export function BahiasTallerSelect({
  talleres,
  selectedId,
}: {
  talleres: TallerOption[];
  selectedId?: string;
}) {
  const router = useRouter();

  return (
    <label className="block max-w-md text-sm">
      <span className="mb-1 block font-medium">¿De qué taller querés ver las bahías?</span>
      <select
        className="input-field"
        value={selectedId ?? ""}
        onChange={(e) => {
          const id = e.target.value;
          router.push(id ? `/bahias?tallerId=${encodeURIComponent(id)}` : "/bahias");
        }}
      >
        <option value="">Elegí un taller…</option>
        {talleres.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
