"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

type ActionResult = { error: string } | void | unknown;

export function useActionTransition() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function runAction(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await action();
      if (result && typeof result === "object" && "error" in result) {
        alert((result as { error: string }).error);
        return;
      }
      router.refresh();
    });
  }

  return { pending, runAction };
}
