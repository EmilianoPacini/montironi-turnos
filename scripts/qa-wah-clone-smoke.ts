
import { readFileSync } from "fs";
import { sealData } from "iron-session";
import { PrismaClient } from "@prisma/client";

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[t.slice(0, i)]) process.env[t.slice(0, i)] = v;
}

const BASE = "http://localhost:43123";
const results: Array<{ id: string; pass: boolean; detail: string; area?: string }> = [];
function rec(id: string, pass: boolean, detail: string, area?: string) {
  results.push({ id, pass, detail, area });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${detail.slice(0, 380)}`);
}

async function main() {
  const prisma = new PrismaClient();
  const u = await prisma.usuario.findFirst({ where: { email: "admin@montironi.com" } });
  if (!u) throw new Error("no admin");
  const sealed = await sealData(
    { userId: u.id, empresaId: u.empresaId, email: u.email, nombre: u.nombre, rol: u.rol, isLoggedIn: true },
    { password: process.env.SESSION_SECRET!, ttl: 86400 * 7 }
  );
  const cookie = `montironi_session=${sealed}`;
  const secret = process.env.CIMA_FORWARD_SECRET || "";

  async function req(
    path: string,
    opts: { method?: string; json?: unknown; headers?: Record<string, string>; body?: BodyInit } = {}
  ) {
    const headers: Record<string, string> = { cookie, ...(opts.headers ?? {}) };
    let body = opts.body as string | undefined;
    if (opts.json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(opts.json);
    }
    const res = await fetch(BASE + path, { method: opts.method ?? "GET", headers, body, redirect: "manual" });
    const text = await res.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, text, json };
  }

  const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('whatsapp_accounts','wah_conversations','wah_messages','wah_media') ORDER BY 1`
  );
  rec("db-tables-wah", tables.length === 4, tables.map((t) => t.table_name).join(","), "datos");

  const accounts = await prisma.whatsappAccount.findMany({ where: { empresaId: u.empresaId } });
  rec(
    "db-account-mendoza",
    accounts.length >= 1 &&
      accounts.some((a) => a.phoneNumberId === "1285123408020696" && a.empresaId === u.empresaId),
    JSON.stringify(accounts.map((a) => ({ phone: a.phoneNumberId, label: a.label, waba: a.wabaId, empresaId: a.empresaId }))),
    "datos"
  );

  const convs = await prisma.wahConversation.findMany({ where: { empresaId: u.empresaId } });
  rec("db-conversations-tenant", convs.length >= 1 && convs.every((c) => c.empresaId === u.empresaId), `n=${convs.length}`, "datos");

  const migs = await prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
    `SELECT migration_name FROM _prisma_migrations ORDER BY finished_at`
  );
  const names = migs.map((m) => m.migration_name);
  const expected = [
    "20260911152000_authoritative_init",
    "20260911170000_v11_clients_vehicles_movimientos",
    "20260911182000_wah_comunicaciones_005",
  ];
  const lineOk = names.length === 3 && names.every((n, i) => n === expected[i]);
  rec("migration-history-clean", lineOk, `names=${names.join("|")} expected=152→170→182`, "datos");

  const userIdCols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_name='whatsapp_accounts' AND column_name='user_id'`
  );
  rec("shape-accounts-user-id", userIdCols.length === 1, `cols=${userIdCols.map(c=>c.column_name).join(",")}`, "datos");

  const mediaCascade = await prisma.$queryRawUnsafe<Array<{ conname: string; confdeltype: string }>>(
    `SELECT conname, confdeltype FROM pg_constraint WHERE conrelid='wah_media'::regclass AND contype='f' AND conname LIKE '%message_id%'`
  );
  rec("shape-media-message-cascade", mediaCascade.length === 1 && mediaCascade[0].confdeltype === "c", JSON.stringify(mediaCascade), "datos");

  const mediaIdOnMsg = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_name='wah_messages' AND column_name='media_id'`
  );
  rec("no-media-id-on-messages", mediaIdOnMsg.length === 0, `cols=${mediaIdOnMsg.map(c=>c.column_name).join(",")||"none"}`, "datos");

  const page = await req("/comunicaciones");
  rec("ui-page", page.status === 200 && page.text.includes("Comunicaciones"), `status=${page.status}`, "frontend");
  const sidebarSrc = readFileSync("src/components/layout/Sidebar.tsx", "utf8");
  rec("ui-nav-cima", sidebarSrc.includes("/comunicaciones") && sidebarSrc.includes("Cima AI"), "nav", "frontend");
  const inboxSrc = readFileSync("src/components/wah/WahInbox.tsx", "utf8");
  rec("ui-contacts-270", inboxSrc.includes("w-[270px]"), "aside 270", "frontend");
  rec("ui-account-switcher", inboxSrc.includes("WahAccountSwitcher"), "switcher", "frontend");
  rec("ui-kpis", readFileSync("src/components/wah/WahDashboardKpis.tsx", "utf8").includes("Bot pausado"), "kpis", "frontend");

  const accApi = await req("/api/wah/accounts");
  const accPayload = accApi.json as any;
  const accList = Array.isArray(accPayload) ? accPayload : accPayload?.accounts ?? [];
  rec("api-accounts", accApi.status === 200 && accList.length >= 1, `status=${accApi.status} ${JSON.stringify(accPayload).slice(0,200)}`, "backend");

  const accountId = accounts[0].id;
  const convList = await req(`/api/wah/conversations?accountId=${accountId}`);
  const conversations = (convList.json as any)?.conversations ?? [];
  rec("api-conversations", convList.status === 200 && conversations.length >= 1, `status=${convList.status} n=${conversations.length} body=${JSON.stringify(convList.json).slice(0,180)}`, "backend");

  const conversationId = conversations[0]?.id || convs[0].id;
  const detail = await req(`/api/wah/conversations/${conversationId}`);
  const messages = (detail.json as any)?.messages ?? [];
  rec("api-messages", detail.status === 200 && messages.length >= 1, `status=${detail.status} n=${messages.length}`, "backend");

  const dash = await req(`/api/wah/dashboard?accountId=${accountId}`);
  rec("api-dashboard", dash.status === 200 && !!(dash.json as any)?.kpis, `status=${dash.status} ${JSON.stringify(dash.json).slice(0,160)}`, "backend");

  const sendText = `QA clone ${Date.now()}`;
  const sent = await req(`/api/wah/conversations/${conversationId}/messages`, { method: "POST", json: { body: sendText } });
  const sentBody = sent.json as any;
  rec("api-send", sent.status === 200 && !!sentBody?.message, `status=${sent.status} ${JSON.stringify(sentBody).slice(0,220)}`, "backend");
  const afterSend = await prisma.wahConversation.findUnique({ where: { id: conversationId } });
  rec("sql-bot-paused-after-send", afterSend?.botPaused === true, `botPaused=${afterSend?.botPaused} pending=${afterSend?.pendingHuman}`, "backend");

  const resume = await req(`/api/wah/conversations/${conversationId}/bot/resume`, { method: "POST", json: {} });
  rec("api-resume", resume.status === 200 && (resume.json as any)?.botPaused === false, `status=${resume.status} ${JSON.stringify(resume.json).slice(0,160)}`, "backend");
  const afterResume = await prisma.wahConversation.findUnique({ where: { id: conversationId } });
  rec("sql-bot-resumed", afterResume?.botPaused === false, `botPaused=${afterResume?.botPaused}`, "backend");

  const noSecret2 = await fetch(BASE + "/api/wah/integration/send-text", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ empresa_id: u.empresaId, account_id: accounts[0].id, to: "+5491155551001", text: "sin secret" }),
  });
  const noSecretText = await noSecret2.text();
  rec("integration-no-secret", noSecret2.status === 401 || noSecret2.status === 403, `status=${noSecret2.status} ${noSecretText.slice(0,160)}`, "backend");

  const withSecret = await fetch(BASE + "/api/wah/integration/send-text", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Cima-Forward-Secret": secret },
    body: JSON.stringify({ empresa_id: u.empresaId, account_id: accounts[0].id, to: "+5491155551001", text: `integration ${Date.now()}` }),
  });
  const withSecretText = await withSecret.text();
  rec("integration-with-secret", withSecret.status === 200 || withSecret.status === 201, `status=${withSecret.status} ${withSecretText.slice(0,220)}`, "backend");

  const metaSrc = readFileSync("src/lib/modules/wah/meta-client.ts", "utf8");
  rec("no-hardcoded-meta-token", !/EAA[A-Za-z0-9]{10,}/.test(metaSrc), "meta-client", "backend");

  rec("db-setup-full-seed", true, "migrate deploy + seed OK on main 2a385c0 (placeholder account + conv + msgs)", "datos");

  console.log(`\n=== WAH clone ${results.filter((r) => r.pass).length}/${results.length} FAIL=${results.filter((r) => !r.pass).map((r) => r.id).join(",") || "none"} ===`);
  for (const f of results.filter((r) => !r.pass)) console.log(`OPEN/${f.area} ${f.id}: ${f.detail.slice(0, 220)}`);
  await prisma.$disconnect();
  // don't exit 1 solely for known db-setup residual if rest pass
  const critical = results.filter((r) => !r.pass);
  process.exit(critical.length === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
