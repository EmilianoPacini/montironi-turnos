import { readFileSync } from "fs";
import { sealData } from "iron-session";
import { PrismaClient } from "@prisma/client";

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[t.slice(0, i)] = v;
}

async function main() {
  const prisma = new PrismaClient();
  const u = await prisma.usuario.findFirst({ where: { email: "admin@montironi.com" } });
  if (!u) throw new Error("no admin");
  const turno = await prisma.turno.findFirst({ where: { empresaId: u.empresaId }, orderBy: { inicio: "desc" } });
  const ses = await prisma.sesion.create({
    data: { usuarioId: u.id, empresaId: u.empresaId, expiresAt: new Date(Date.now() + 12 * 3600e3) },
  });
  const cookie = `montironi_session=${await sealData({ sessionId: ses.id }, { password: process.env.SESSION_SECRET!, ttl: 86400 })}`;

  async function hit(path: string) {
    const res = await fetch("http://localhost:43123" + path, { headers: { cookie }, redirect: "manual" });
    return { status: res.status, html: await res.text() };
  }

  const agenda = await hit("/agenda");
  const nuevo = await hit("/turnos/nuevo");
  const detalle = turno ? await hit("/turnos/" + turno.id) : { status: 0, html: "" };

  const rec = (id: string, pass: boolean, detail: string) => {
    console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${detail}`);
    return pass;
  };
  const ok = [
    rec("agenda-200", agenda.status === 200, `status=${agenda.status}`),
    rec("agenda-filters", agenda.html.includes("AgendaFilters") || /filtro|Bahía|Fecha/i.test(agenda.html), "markers"),
    rec("nuevo-200", nuevo.status === 200, `status=${nuevo.status}`),
    rec("nuevo-form-slots", nuevo.html.includes("NuevoTurno") || /cliente|vehículo|horario/i.test(nuevo.html), "form"),
    rec("detalle-200", detalle.status === 200, `status=${detalle.status}`),
    rec("detalle-title", detalle.html.includes("Detalle del turno"), "title"),
    rec("detalle-no-TurnoActions", !detalle.html.includes("TurnoActions"), "clean"),
    rec("agenda-unauth", (await fetch("http://localhost:43123/agenda", { redirect: "manual" })).status === 307, "307"),
  ];
  await prisma.sesion.delete({ where: { id: ses.id } });
  await prisma.$disconnect();
  process.exit(ok.every(Boolean) ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
