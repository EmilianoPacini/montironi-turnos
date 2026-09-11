/** Absolute session lifetime from creation (12 hours). */
export const SESSION_ABSOLUTE_TTL_MS = 12 * 60 * 60 * 1000;

/** Sliding idle timeout; extended on each authenticated request (45 minutes). */
export const SESSION_IDLE_TIMEOUT_MS = 45 * 60 * 1000;

/** Iron-session cookie max-age (7 days) — only carries opaque sessionId. */
export const SESSION_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7;
