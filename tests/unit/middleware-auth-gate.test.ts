import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { SESSION_COOKIE_NAME } from "@/lib/auth/access";

function runMiddleware(path: string, cookieValue?: string) {
  const request = new NextRequest(`http://localhost${path}`);
  if (cookieValue !== undefined) {
    request.cookies.set(SESSION_COOKIE_NAME, cookieValue);
  }
  return middleware(request);
}

describe("middleware · Edge cookie gate (B5)", () => {
  it("no cookie → /agenda redirects to /login", () => {
    const response = runMiddleware("/agenda");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/login?from=%2Fagenda"
    );
  });

  it("no cookie → /api/v1/clientes/context returns 401 JSON", async () => {
    const response = runMiddleware("/api/v1/clientes/context");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "No autorizado",
      code: "UNAUTHORIZED",
    });
  });

  it("session cookie present → passes through with x-pathname and security headers", () => {
    const response = runMiddleware("/agenda", "sealed-session-placeholder");
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin"
    );
  });

  it("public /api/agents passes without cookie", () => {
    const response = runMiddleware("/api/agents");
    expect(response.status).toBe(200);
  });

  it("public /api/wah/integration passes without cookie", () => {
    const response = runMiddleware("/api/wah/integration/send-text");
    expect(response.status).toBe(200);
  });

  it("public /api/v1/jobs passes without cookie", () => {
    const response = runMiddleware("/api/v1/jobs/vencer-pendientes");
    expect(response.status).toBe(200);
  });

  it("non-jobs /api/v1/* still requires cookie at Edge", async () => {
    const response = runMiddleware("/api/v1/turnos");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "No autorizado",
      code: "UNAUTHORIZED",
    });
  });

  it("new unlisted panel path is blocked without cookie (fail-closed)", () => {
    const response = runMiddleware("/futuro-modulo");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });
});
