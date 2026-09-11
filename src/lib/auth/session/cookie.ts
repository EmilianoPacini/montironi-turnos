import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { SESSION_COOKIE_MAX_AGE_SEC } from "./constants";
import type { CookieSessionData } from "./types";

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "montironi_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_COOKIE_MAX_AGE_SEC,
  },
};

export async function getCookieSession() {
  const cookieStore = await cookies();
  return getIronSession<CookieSessionData>(cookieStore, sessionOptions);
}

export async function setCookieSessionId(sessionId: string) {
  const cookie = await getCookieSession();
  cookie.sessionId = sessionId;
  await cookie.save();
}

export async function clearCookieSession() {
  const cookie = await getCookieSession();
  cookie.destroy();
}

export async function readCookieSessionId(): Promise<string | null> {
  const cookie = await getCookieSession();
  return cookie.sessionId ?? null;
}
