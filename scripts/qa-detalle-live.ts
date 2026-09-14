import { readFileSync } from "fs";
import { sealData } from "iron-session";
import { PrismaClient, EstadoTurno } from "@prisma/client";

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
  const active = await prisma.turno.findFirst({
    where: {
      empresaId: u.empresaId,
      estado: { in: [EstadoTurno.pendiente, EstadoTurno.confirmado, EstadoTurno.recibido, EstadoTurno.en_servicio] },
    },
    orderBy: { inicio: "desc" },
  });
  const any = await prisma.turno.findFirst({ where: { empresaId: u.empresaId }, orderBy: { inicio: "desc" } });
  const t = active ?? any;
  if (!t) throw new Error("no turno");
  const ses = await prisma.sesion.create({
    data: { usuarioId: u.id, empresaId: u.empresaId, expiresAt: new Date(Date.now() + 12 * 3600e3) },
  });
  const cookie = await sealData({ sessionId: ses.id }, { password: process.env.SESSION_SECRET!, ttl: 86400 });
  const res = await fetch("http://localhost:43123/turnos/" + t.id, {
    headers: { cookie: `montironi_session=${cookie}` },
    redirect: "manual",
  });
  const html = await res.text();
  console.log("status", res.status, "estado", t.estado, "id", t.id);
  console.log("hasDetalleTitle", html.includes("Detalle del turno"));
  console.log("hasConfirmar", html.includes("Confirmar"));
  console.log("hasSelectEstado", html.includes("Cambiar estado") || html.includes("<select"));
  console.log("hasTurnoActions", html.includes("TurnoActions"));
  console.log("hasProximosHeading", html.includes("Próximo servicio por km"));
  console.log("hasReprogramar", html.includes("Reprogramar turno"));
  await prisma.sesion.delete({ where: { id: ses.id } });
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
