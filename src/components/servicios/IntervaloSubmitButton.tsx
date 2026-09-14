"use client";

import { useFormStatus } from "react-dom";

export function IntervaloSubmitButton({
  children,
  pendingLabel = "Guardando...",
  size = "lg",
}: {
  children: string;
  pendingLabel?: string;
  size?: "lg" | "sm";
}) {
  const { pending } = useFormStatus();
  const className =
    size === "sm"
      ? "rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
      : "btn-primary-lg disabled:opacity-50";

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
