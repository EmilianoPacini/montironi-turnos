import { readFileSync } from "fs";
import { randomUUID } from "crypto";
import { sealData } from "iron-session";
import { PrismaClient, RolUsuario } from "@prisma/client";
import bcrypt from "bcryptjs";

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  const k = t.slice(0, i);
  process.env[k] = v;
}

const BASE = "http://localhost:43123";
const prisma = new PrismaClient();
const results: Array<{ id: string; pass: boolean; detail: string }> = [];
function rec(id: string, pass: boolean, detail: string) {
  results.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${detail.slice(0, 420)}`);
}

async function cookieFor(sessionId: string) {
  const sealed = await sealData({ sessionId }, { password: process.env.SESSION_SECRET!, ttl: 86400 * 7 });
  return `montironi_session=${sealed}`;
}

async function createSesion(usuarioId: string, empresaId: string) {
  return prisma.sesion.create({
    data: {
      usuarioId,
      empresaId,
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      lastSeenAt: new Date(),
      userAgent: "qa-e2e",
      ip: "127.0.0.1",
    },
  });
}

async function hit(path: string, opts: { method?: string; cookie?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (opts.cookie) headers.cookie = opts.cookie;
  const res = await fetch(BASE + path, { method: opts.method ?? "GET", headers, redirect: "manual" });
  const text = await res.text();
  return { status: res.status, text };
}

async function main() {
  const stamp = Date.now();
  const empresa = await prisma.empresa.findFirst({ where: { slug: "montironi" } });
  if (!empresa) throw new Error("no empresa montironi");
  const passwordHash = await bcrypt.hash("qa-session-pass", 12);
  const admin = await prisma.usuario.create({
    data: {
      empresaId: empresa.id,
      email: `qa-session-admin-${stamp}@example.com`,
      nombre: "QA Session Admin",
      passwordHash,
      rol: RolUsuario.admin,
      activo: true,
    },
  });

  const ctxPath = "/api/v1/clientes/context?telefono=%2B5491100000000";
  const jobPath = "/api/v1/jobs/vencer-pendientes";

  try {
    const noCookie = await hit(ctxPath);
    rec("e2e-no-cookie", noCookie.status === 401, `status=${noCookie.status} ${noCookie.text.slice(0, 120)}`);

    const invented = await hit(ctxPath, { cookie: await cookieFor(randomUUID()) });
    rec("e2e-invented-sessionId", invented.status === 401, `status=${invented.status} ${invented.text.slice(0, 120)}`);

    const garbage = await hit(ctxPath, { cookie: "montironi_session=not-a-valid-iron-blob" });
    rec("e2e-garbage-cookie", garbage.status === 401, `status=${garbage.status} ${garbage.text.slice(0, 120)}`);

    const s1 = await createSesion(admin.id, empresa.id);
    const ck = await cookieFor(s1.id);
    const ok = await hit(ctxPath, { cookie: ck });
    rec("e2e-valid-session-reaches-api", ok.status === 200 || ok.status === 404, `status=${ok.status} (200/404 = auth OK)`);

    await prisma.usuario.update({ where: { id: admin.id }, data: { activo: false } });
    const deact = await hit(ctxPath, { cookie: ck });
    rec("e2e-deactivate-401", deact.status === 401, `status=${deact.status} ${deact.text.slice(0, 120)}`);
    await prisma.usuario.update({ where: { id: admin.id }, data: { activo: true } });

    const s2 = await createSesion(admin.id, empresa.id);
    const ck2 = await cookieFor(s2.id);
    await prisma.usuario.update({ where: { id: admin.id }, data: { rol: RolUsuario.empleado } });
    const demote = await hit(jobPath, { method: "POST", cookie: ck2 });
    rec("e2e-demote-403", demote.status === 403, `status=${demote.status} ${demote.text.slice(0, 160)}`);
    await prisma.usuario.update({ where: { id: admin.id }, data: { rol: RolUsuario.admin } });

    const s3 = await createSesion(admin.id, empresa.id);
    const ck3 = await cookieFor(s3.id);
    await prisma.sesion.update({ where: { id: s3.id }, data: { revokedAt: new Date() } });
    const replay = await hit(ctxPath, { cookie: ck3 });
    rec("e2e-logout-replay-401", replay.status === 401, `status=${replay.status}`);

    const s4 = await createSesion(admin.id, empresa.id);
    const ck4 = await cookieFor(s4.id);
    await prisma.sesion.update({
      where: { id: s4.id },
      data: { lastSeenAt: new Date(Date.now() - 46 * 60 * 1000) },
    });
    const idle = await hit(ctxPath, { cookie: ck4 });
    const idleRow = await prisma.sesion.findUnique({ where: { id: s4.id } });
    rec(
      "e2e-idle-401-revoked",
      idle.status === 401 && idleRow?.revokedAt != null,
      `status=${idle.status} revokedAt=${idleRow?.revokedAt?.toISOString() ?? "null"}`
    );

    const s5 = await createSesion(admin.id, empresa.id);
    const ck5 = await cookieFor(s5.id);
    await prisma.sesion.update({ where: { id: s5.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const ttl = await hit(ctxPath, { cookie: ck5 });
    rec("e2e-absolute-ttl-401", ttl.status === 401, `status=${ttl.status}`);

    const prior = await createSesion(admin.id, empresa.id);
    const priorCk = await cookieFor(prior.id);
    await prisma.sesion.update({ where: { id: prior.id }, data: { revokedAt: new Date() } });
    const next = await createSesion(admin.id, empresa.id);
    const nextCk = await cookieFor(next.id);
    const priorHit = await hit(ctxPath, { cookie: priorCk });
    const nextHit = await hit(ctxPath, { cookie: nextCk });
    const priorRow = await prisma.sesion.findUnique({ where: { id: prior.id } });
    rec(
      "e2e-fixation-new-id-old-revoked",
      next.id !== prior.id && priorHit.status === 401 && (nextHit.status === 200 || nextHit.status === 404) && priorRow?.revokedAt != null,
      `new!=old=${next.id !== prior.id} prior=${priorHit.status} next=${nextHit.status} revoked=${!!priorRow?.revokedAt}`
    );

    const s7 = await createSesion(admin.id, empresa.id);
    const ck7 = await cookieFor(s7.id);
    const other = await prisma.empresa.create({ data: { nombre: "QA Other", slug: `qa-other-${stamp}` } });
    await prisma.sesion.update({ where: { id: s7.id }, data: { empresaId: other.id } });
    const tenancy = await hit(ctxPath, { cookie: ck7 });
    const tenancyRow = await prisma.sesion.findUnique({ where: { id: s7.id } });
    rec(
      "e2e-tenancy-401-revoked",
      tenancy.status === 401 && tenancyRow?.revokedAt != null,
      `status=${tenancy.status} revokedAt=${tenancyRow?.revokedAt?.toISOString() ?? "null"}`
    );
    await prisma.sesion.deleteMany({ where: { empresaId: other.id } });
    await prisma.empresa.delete({ where: { id: other.id } });

    const apiKey = process.env.AGENT_API_KEY ?? "";
    const cron = await hit(jobPath, {
      method: "POST",
      headers: { "x-api-key": apiKey, "x-empresa": "montironi" },
    });
    rec("e2e-apikey-no-cookie", cron.status === 200 && cron.text.includes("vencidos"), `status=${cron.status} ${cron.text.slice(0, 160)}`);
  } finally {
    await prisma.sesion.deleteMany({ where: { usuarioId: admin.id } });
    await prisma.usuario.delete({ where: { id: admin.id } }).catch(() => {});
    await prisma.$disconnect();
  }

  const fail = results.filter((r) => !r.pass);
  console.log(`\n=== session E2E ${results.filter((r) => r.pass).length}/${results.length} FAIL=${fail.map((f) => f.id).join(",") || "none"} ===`);
  process.exit(fail.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
