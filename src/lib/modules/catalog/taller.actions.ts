"use server";

import { redirect } from "next/navigation";
import { DiaSemana, TipoExcepcion } from "@prisma/client";
import { requireSession } from "@/lib/auth/session";
import { assertAdminRole } from "@/lib/auth/guards";
import { isDomainError, DomainError } from "@/lib/modules/appointments/errors";
import { revalidateDomainSurfaces } from "@/lib/revalidate-domain";
import {
  confirmarCambioHorario,
  createTaller,
  previewCambioHorario,
  updateTaller,
  upsertExcepcion,
} from "@/lib/modules/catalog/taller.service";
import type { DiaHorarioSnapshot, FranjaJson } from "@/lib/modules/catalog/franjas";
import { normalizeFranjas, toHhMm } from "@/lib/modules/catalog/franjas";

function redirectWithError(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

function isNextControlFlow(e: unknown): boolean {
  return Boolean(
    e &&
      typeof e === "object" &&
      "digest" in e &&
      typeof (e as { digest?: unknown }).digest === "string" &&
      String((e as { digest: string }).digest).startsWith("NEXT_")
  );
}

function handleError(e: unknown, path: string): never {
  if (isNextControlFlow(e)) throw e;
  if (isDomainError(e)) redirectWithError(path, e.message);
  if (e instanceof Error && e.message === "UNAUTHORIZED") redirect("/login");
  if (e instanceof Error && (e.message.startsWith("Franja") || e.message.includes("franjas") || e.message.includes("solap"))) {
    redirectWithError(path, e.message);
  }
  const message = e instanceof Error ? e.message : "No se pudo guardar";
  redirectWithError(path, message);
}

async function requireAdmin() {
  const session = await requireSession();
  try {
    assertAdminRole(session.rol);
  } catch {
    redirect("/agenda");
  }
  return session;
}

function parseReglas(formData: FormData) {
  return {
    margenMinutos: Number(formData.get("margenMinutos") || 15),
    intervaloInicioMinutos: Number(formData.get("intervaloInicioMinutos") || 15),
    anticipacionMinimaHoras: Number(formData.get("anticipacionMinimaHoras") || 0),
    anticipacionMaximaDias: Number(formData.get("anticipacionMaximaDias") || 90),
    permiteCancelacion: formData.get("permiteCancelacion") === "on",
    horasLimiteCancelacion: Number(formData.get("horasLimiteCancelacion") || 24),
  };
}

function parseDireccion(formData: FormData) {
  return {
    calle: String(formData.get("calle") ?? ""),
    numero: String(formData.get("numero") ?? ""),
    localidad: String(formData.get("localidad") ?? ""),
    provincia: String(formData.get("provincia") ?? ""),
    codigoPostal: String(formData.get("codigoPostal") ?? ""),
  };
}

function parseFranjasField(raw: string): FranjaJson[] {
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return [];
  return normalizeFranjas(
    parts.map((part) => {
      const [horaInicio, horaFin] = part.split("-").map((s) => s.trim());
      return { horaInicio: toHhMm(horaInicio ?? ""), horaFin: toHhMm(horaFin ?? "") };
    })
  );
}

function parseHorario(formData: FormData): DiaHorarioSnapshot[] {
  return Object.values(DiaSemana).map((dia) => {
    const activo = formData.get(`dia_${dia}_activo`) === "on";
    const raw = String(formData.get(`dia_${dia}_franjas`) ?? "");
    const franjas = activo ? parseFranjasField(raw) : [];
    return { dia, activo: activo && franjas.length > 0, franjas };
  });
}

function parseBahias(formData: FormData): { nombre: string }[] {
  return String(formData.get("bahias") ?? "")
    .split("\n")
    .map((n) => n.trim())
    .filter(Boolean)
    .map((nombre) => ({ nombre }));
}

export async function createTallerAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  try {
    const nombre = String(formData.get("nombre") ?? "").trim();
    if (!nombre) {
      throw new DomainError("El nombre del taller es obligatorio", "ValidacionCliente");
    }
    const taller = await createTaller({
      empresaId: session.empresaId,
      nombre,
      direccion: parseDireccion(formData),
      reglas: parseReglas(formData),
      horario: parseHorario(formData),
      bahias: parseBahias(formData),
      usuarioId: session.userId,
    });
    revalidateDomainSurfaces(["/taller"], "catalogo");
    redirect(`/taller/${taller.id}`);
  } catch (e) {
    handleError(e, "/taller");
  }
}

export async function updateTallerAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const tallerId = String(formData.get("tallerId") ?? "");
  const path = `/taller/${tallerId}`;
  try {
    await updateTaller({
      tallerId,
      empresaId: session.empresaId,
      nombre: String(formData.get("nombre") ?? ""),
      activo: formData.get("activo") === "on",
      direccion: parseDireccion(formData),
      reglas: parseReglas(formData),
    });
    revalidateDomainSurfaces(["/taller"], "catalogo");
    redirect(`${path}?ok=reglas`);
  } catch (e) {
    handleError(e, path);
  }
}

export type HorarioPreviewState = {
  error?: string;
  aplicaDesde?: string;
  previewHash?: string;
  conflictos?: { id: string; inicio: string }[];
};

export async function previewHorarioAction(
  _prev: HorarioPreviewState | undefined,
  formData: FormData
): Promise<HorarioPreviewState> {
  try {
    const session = await requireAdmin();
    const tallerId = String(formData.get("tallerId") ?? "");
    const preview = await previewCambioHorario({
      tallerId,
      empresaId: session.empresaId,
      snapshot: parseHorario(formData),
    });
    return {
      aplicaDesde: preview.aplicaDesde,
      previewHash: preview.previewHash,
      conflictos: preview.conflictos.map((c) => ({ id: c.id, inicio: c.inicio })),
    };
  } catch (e) {
    if (isDomainError(e)) return { error: e.message };
    if (
      e instanceof Error &&
      (e.message.startsWith("Franja") || e.message.includes("franjas") || e.message.includes("solap"))
    ) {
      return { error: e.message };
    }
    throw e;
  }
}

export async function confirmHorarioAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const tallerId = String(formData.get("tallerId") ?? "");
  const path = `/taller/${tallerId}`;
  try {
    await confirmarCambioHorario({
      tallerId,
      empresaId: session.empresaId,
      snapshot: parseHorario(formData),
      aplicaDesde: String(formData.get("aplicaDesde") ?? ""),
      previewHash: String(formData.get("previewHash") ?? ""),
      reemplazarFuturo: formData.get("reemplazarFuturo") === "on",
      usuarioId: session.userId,
    });
    revalidateDomainSurfaces(["/taller"], "catalogo");
    redirect(`${path}?ok=horario`);
  } catch (e) {
    handleError(e, path);
  }
}

export async function upsertExcepcionAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const tallerId = String(formData.get("tallerId") ?? "");
  const path = `/taller/${tallerId}`;
  try {
    const tipo = String(formData.get("tipo") ?? "cerrado") as TipoExcepcion;
    const franjasRaw = String(formData.get("franjas") ?? "");
    await upsertExcepcion({
      tallerId,
      empresaId: session.empresaId,
      fecha: String(formData.get("fecha") ?? ""),
      tipo,
      franjas: tipo === TipoExcepcion.horario_especial ? parseFranjasField(franjasRaw) : [],
      motivo: String(formData.get("motivo") ?? "") || null,
    });
    revalidateDomainSurfaces(["/taller"], "catalogo");
    redirect(`${path}?ok=excepcion`);
  } catch (e) {
    handleError(e, path);
  }
}
