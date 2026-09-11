"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EstadoTurno, RolUsuario } from "@prisma/client";
import { requireSession } from "@/lib/auth/session";
import {
  createTurno,
  confirmTurno,
  rescheduleTurno,
  cancelTurno,
  transitionTurnoState,
  blockBahia,
  removeBlock,
  AppointmentError,
} from "@/lib/modules/appointments/service";
import { upsertCliente, upsertVehiculo } from "@/lib/modules/customers/service";
import { updateConfiguracionTaller, createServicio } from "@/lib/modules/catalog/service";

function handleFormError(e: unknown): never {
  if (e instanceof AppointmentError) {
    redirect(`/error?message=${encodeURIComponent(e.message)}`);
  }
  if (e instanceof Error && e.message === "UNAUTHORIZED") redirect("/login");
  throw e;
}

export async function createTurnoAction(formData: FormData): Promise<void> {
  try {
    const session = await requireSession();
    const servicioIds = formData.getAll("servicioIds").map(String);
    const inicioStr = String(formData.get("inicio"));

    await createTurno({
      empresaId: session.empresaId,
      tallerId: String(formData.get("tallerId")),
      bahiaId: String(formData.get("bahiaId") ?? "") || undefined,
      clienteId: String(formData.get("clienteId")),
      vehiculoId: String(formData.get("vehiculoId")),
      servicioIds,
      inicio: new Date(inicioStr),
      notas: String(formData.get("notas") ?? "") || undefined,
      creadorId: session.userId,
      confirmar: formData.get("confirmar") === "true",
    });

    revalidatePath("/agenda");
    redirect("/agenda");
  } catch (e) {
    handleFormError(e);
  }
}

export async function confirmTurnoAction(turnoId: string, version: number) {
  try {
    const session = await requireSession();
    await confirmTurno({
      turnoId,
      empresaId: session.empresaId,
      usuarioId: session.userId,
      version,
    });
    revalidatePath("/agenda");
    revalidatePath(`/turnos/${turnoId}`);
    return { success: true as const };
  } catch (e) {
    if (e instanceof AppointmentError) return { error: e.message, code: e.code };
    if (e instanceof Error && e.message === "UNAUTHORIZED") redirect("/login");
    throw e;
  }
}

export async function transitionTurnoAction(
  turnoId: string,
  nuevoEstado: EstadoTurno,
  version: number
) {
  try {
    const session = await requireSession();
    await transitionTurnoState({
      turnoId,
      empresaId: session.empresaId,
      nuevoEstado,
      version,
      usuarioId: session.userId,
    });
    revalidatePath("/agenda");
    revalidatePath(`/turnos/${turnoId}`);
    return { success: true as const };
  } catch (e) {
    if (e instanceof AppointmentError) return { error: e.message, code: e.code };
    if (e instanceof Error && e.message === "UNAUTHORIZED") redirect("/login");
    throw e;
  }
}

export async function cancelTurnoAction(turnoId: string, version: number, motivo?: string) {
  try {
    const session = await requireSession();
    await cancelTurno({
      turnoId,
      empresaId: session.empresaId,
      version,
      usuarioId: session.userId,
      motivo,
    });
    revalidatePath("/agenda");
    revalidatePath(`/turnos/${turnoId}`);
    return { success: true as const };
  } catch (e) {
    if (e instanceof AppointmentError) return { error: e.message, code: e.code };
    if (e instanceof Error && e.message === "UNAUTHORIZED") redirect("/login");
    throw e;
  }
}

export async function rescheduleTurnoAction(formData: FormData): Promise<void> {
  try {
    const session = await requireSession();
    const turnoId = String(formData.get("turnoId"));
    await rescheduleTurno({
      turnoId,
      empresaId: session.empresaId,
      bahiaId: String(formData.get("bahiaId") ?? "") || undefined,
      inicio: new Date(String(formData.get("inicio"))),
      version: Number(formData.get("version")),
      usuarioId: session.userId,
    });
    revalidatePath("/agenda");
    redirect(`/turnos/${turnoId}`);
  } catch (e) {
    handleFormError(e);
  }
}

export async function blockBahiaAction(formData: FormData): Promise<void> {
  try {
    const session = await requireSession();
    await blockBahia({
      empresaId: session.empresaId,
      bahiaId: String(formData.get("bahiaId")),
      inicio: new Date(String(formData.get("inicio"))),
      fin: new Date(String(formData.get("fin"))),
      motivo: String(formData.get("motivo") ?? "") || undefined,
      usuarioId: session.userId,
    });
    revalidatePath("/agenda");
    redirect("/agenda");
  } catch (e) {
    handleFormError(e);
  }
}

export async function removeBlockAction(blockId: string) {
  try {
    const session = await requireSession();
    await removeBlock(blockId, session.empresaId);
    revalidatePath("/agenda");
    return { success: true as const };
  } catch (e) {
    if (e instanceof AppointmentError) return { error: e.message, code: e.code };
    throw e;
  }
}

export async function saveClienteAction(formData: FormData): Promise<void> {
  try {
    const session = await requireSession();
    const id = String(formData.get("id") ?? "") || undefined;
    await upsertCliente({
      id,
      empresaId: session.empresaId,
      nombre: String(formData.get("nombre")),
      apellido: String(formData.get("apellido") ?? "") || undefined,
      email: String(formData.get("email") ?? "") || undefined,
      telefono: String(formData.get("telefono") ?? "") || undefined,
      documento: String(formData.get("documento") ?? "") || undefined,
      notas: String(formData.get("notas") ?? "") || undefined,
    });
    revalidatePath("/clientes");
    redirect("/clientes");
  } catch (e) {
    handleFormError(e);
  }
}

export async function saveVehiculoAction(formData: FormData): Promise<void> {
  try {
    const session = await requireSession();
    const clienteId = String(formData.get("clienteId") ?? "") || undefined;
    await upsertVehiculo({
      empresaId: session.empresaId,
      patente: String(formData.get("patente")),
      marca: String(formData.get("marca") ?? "") || undefined,
      modelo: String(formData.get("modelo") ?? "") || undefined,
      anio: formData.get("anio") ? Number(formData.get("anio")) : undefined,
      color: String(formData.get("color") ?? "") || undefined,
      clienteId,
    });
    revalidatePath("/clientes");
    if (clienteId) redirect(`/clientes/${clienteId}`);
    redirect("/clientes");
  } catch (e) {
    handleFormError(e);
  }
}

export async function saveServicioAction(formData: FormData): Promise<void> {
  try {
    const session = await requireSession();
    if (session.rol !== RolUsuario.admin) redirect("/agenda");

    await createServicio({
      empresaId: session.empresaId,
      tipoServicioId: String(formData.get("tipoServicioId")),
      nombre: String(formData.get("nombre")),
      descripcion: String(formData.get("descripcion") ?? "") || undefined,
      duracionMin: Number(formData.get("duracionMin")),
      precio: Number(formData.get("precio")),
      modoPrecio: String(formData.get("modoPrecio") ?? "fijo") as "fijo" | "desde" | "a_presupuestar",
    });
    revalidatePath("/servicios");
    redirect("/servicios");
  } catch (e) {
    handleFormError(e);
  }
}

export async function saveConfigAction(formData: FormData): Promise<void> {
  try {
    const session = await requireSession();
    if (session.rol !== RolUsuario.admin) redirect("/agenda");

    await updateConfiguracionTaller(
      String(formData.get("tallerId")),
      Number(formData.get("margenMinutos"))
    );
    revalidatePath("/configuracion");
    redirect("/configuracion");
  } catch (e) {
    handleFormError(e);
  }
}
