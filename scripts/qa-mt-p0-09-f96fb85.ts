import { readFileSync } from "fs";
import { sealData } from "iron-session";
import { PrismaClient } from "@prisma/client";
import { upsertCliente, upsertVehiculo } from "@/lib/modules/customers/service";
import { ClienteValidationError } from "@/lib/modules/customers/validation";
import { formActionError } from "@/lib/form-action-state";
import {
  fieldErrorsForClienteValidation,
  fieldErrorsForVehiculoValidation,
} from "@/lib/form-field-errors";

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[t.slice(0, i)] = v;
}

function rec(id: string, pass: boolean, detail: string) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${detail}`);
  return pass;
}

async function main() {
  const prisma = new PrismaClient();
  const results: boolean[] = [];
  const u = await prisma.usuario.findFirst({ where: { email: "admin@montironi.com" } });
  if (!u) throw new Error("no admin");

  const ses = await prisma.sesion.create({
    data: { usuarioId: u.id, empresaId: u.empresaId, expiresAt: new Date(Date.now() + 12 * 3600e3) },
  });
  const cookie = `montironi_session=${await sealData({ sessionId: ses.id }, { password: process.env.SESSION_SECRET!, ttl: 86400 })}`;

  async function hit(path: string) {
    const res = await fetch("http://localhost:43123" + path, { headers: { cookie }, redirect: "manual" });
    return { status: res.status, html: await res.text() };
  }

  const login = await fetch("http://localhost:43123/login", { redirect: "manual" });
  const loginHtml = await login.text();
  results.push(rec("login-200", login.status === 200, `status=${login.status}`));
  results.push(rec("login-slate", loginHtml.includes("bg-slate-100"), "bg-slate-100"));
  results.push(
    rec(
      "login-no-gradient",
      !/from-blue-700|via-blue-600|to-sky-500|bg-gradient-to-br/.test(loginHtml),
      "no saturated blue"
    )
  );

  const clientesNuevo = await hit("/clientes/nuevo");
  const turnosNuevo = await hit("/turnos/nuevo");
  const bloquear = await hit("/agenda/bloquear");
  results.push(rec("clientes-nuevo-200", clientesNuevo.status === 200, `status=${clientesNuevo.status}`));
  results.push(rec("turnos-nuevo-200", turnosNuevo.status === 200, `status=${turnosNuevo.status}`));
  results.push(rec("bloquear-200", bloquear.status === 200, `status=${bloquear.status}`));
  results.push(
    rec(
      "clientes-data-field",
      /data-field/.test(clientesNuevo.html) || /nombre|teléfono|telefono/i.test(clientesNuevo.html),
      "form markers"
    )
  );

  const kept = { nombre: "QA-P009", apellido: "Preserve", telefono: "not-e164" };
  let mapped: Partial<Record<string, string>> | undefined;
  try {
    await upsertCliente({ empresaId: u.empresaId, ...kept });
    results.push(rec("cliente-validation-error", false, "expected ClienteValidationError"));
  } catch (e) {
    const ok = e instanceof ClienteValidationError;
    mapped = ok ? fieldErrorsForClienteValidation(e.message) : undefined;
    results.push(rec("cliente-validation-error", ok, ok ? e.message : String(e)));
    results.push(rec("cliente-field-marked", mapped?.telefono != null, JSON.stringify(mapped)));
    const preserved = formActionError((e as Error).message, kept, mapped);
    results.push(
      rec(
        "cliente-values-kept",
        preserved.values?.nombre === kept.nombre &&
          preserved.values?.apellido === kept.apellido &&
          preserved.values?.telefono === kept.telefono,
        JSON.stringify(preserved.values)
      )
    );
    results.push(rec("cliente-focus", preserved.focusField === "telefono", String(preserved.focusField)));
  }

  const created = await upsertCliente({
    empresaId: u.empresaId,
    nombre: kept.nombre,
    apellido: kept.apellido,
    telefono: "+5491112345678",
  });
  results.push(rec("cliente-retry-save", !!created.id, created.id));

  try {
    await upsertVehiculo({ empresaId: u.empresaId, clienteId: created.id, patente: "" });
    results.push(rec("vehiculo-validation-error", false, "expected error"));
  } catch (e) {
    const ok = e instanceof ClienteValidationError || (e instanceof Error && /patente/i.test(e.message));
    const fe = fieldErrorsForVehiculoValidation((e as Error).message);
    results.push(rec("vehiculo-validation-error", ok, (e as Error).message));
    results.push(rec("vehiculo-field-marked", fe?.patente != null || /patente/i.test((e as Error).message), JSON.stringify(fe)));
  }

  const noServicios = formActionError(
    "Seleccioná al menos un servicio",
    {
      clienteId: created.id,
      vehiculoId: "v1",
      servicioIds: [] as string[],
      bahiaId: "",
      inicio: "2026-09-15T10:00:00",
      kilometraje: "1000",
      notas: "keep-me",
      confirmar: false,
    },
    { servicioIds: "Seleccioná al menos un servicio" },
    "servicioIds"
  );
  results.push(
    rec(
      "turno-values-kept",
      noServicios.values?.notas === "keep-me" && noServicios.values?.clienteId === created.id,
      JSON.stringify(noServicios.values)
    )
  );
  results.push(rec("turno-focus", noServicios.focusField === "servicioIds", String(noServicios.focusField)));

  await prisma.cliente.delete({ where: { id: created.id } }).catch(() => undefined);
  await prisma.sesion.delete({ where: { id: ses.id } });
  await prisma.$disconnect();
  process.exit(results.every(Boolean) ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
