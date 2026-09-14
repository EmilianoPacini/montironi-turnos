"use client";

import { useFormStatus } from "react-dom";

export function FormSubmitButton({
  children,
  pendingLabel,
  className = "btn-primary",
}: {
  children: string;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
