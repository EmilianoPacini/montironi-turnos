import { redirect } from "next/navigation";
import { readCookieSessionId, validateServerSession } from "@/lib/auth/session/index";

export default async function HomePage() {
  const sessionId = await readCookieSessionId();
  if (sessionId) {
    try {
      await validateServerSession(sessionId, { touch: false });
      redirect("/agenda");
    } catch {
      // stale or invalid cookie — fall through to login
    }
  }
  redirect("/login");
}
