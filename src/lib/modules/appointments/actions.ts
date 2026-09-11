"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EstadoTurno } from "@prisma/client";
import { requireSession } from "@/lib/auth/session";
import {
  createTurno,
  confirmTurno,
  rescheduleTurno,
  cancelTurno,
  transitionTurnoState,
  blockBahia,
  removeBlock,
  assertNotPastInicio,
} from "@/lib/modules/appointments/service";
import { isDomainError } from "@/lib/modules/appointments/errors";
import { upsertCliente, upsertVehiculo } from "@/lib/modules/customers/service";
import { ClienteValidationError } from "@/lib/modules/customers/validation";
import { updateConfiguracionTaller, createServicio } from "@/lib/modules/catalog/service";
import { upsertIntervaloKm } from "@/lib/modules/catalog/intervalo.service";
import { createBahia, updateBahia } from "@/lib/modules/catalog/bahia.service";
import { assertAdminRole } from "@/lib/auth/guards";
import { CondicionVehiculo, TipoVehiculo } from "@prisma/client";

function redirectWithError(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

function handleFormError(e: unknown, returnPath: string): never {
  if (isDomainError(e)) {
    redirectWithError(returnPath, e.message);
  }
  if (e instanceof Error && e.message === "UNAUTHORIZED") redirect("/login");
  throw e;
}

function mapClienteError(e: unknown, returnPath: string): never {
  if (e instanceof ClienteValidationError) {
    redirectWithError(returnPath, e.message);
  }
  handleFormError(e, returnPath);
}

export async function createTurnoAction(formData: FormData): Promise<void> {
  const tallerId = String(formData.get("tallerId"));
  const returnPath = `/turnos/nuevo?tallerId=${tallerId}`;

  try {
    const session = await requireSession();
    const servicioIds = formData.getAll("servicioIds").map(String);

    if (servicioIds.length === 0) {
      redirectWithError(returnPath, "Seleccioná al menos un servicio");
    }

    const inicioStr = String(formData.get("inicio"));
    const kmRaw = String(formData.get("kilometraje") ?? "").trim();
    const inicio = new Date(inicioStr);

    assertNotPastInicio(inicio);

    await createTurno({
      empresaId: session.empresaId,
      tallerId,
      bahiaId: String(formData.get("bahiaId") ?? "") || undefined,
      clienteId: String(formData.get("clienteId")),
      vehiculoId: String(formData.get("vehiculoId")),
      servicioIds,
      inicio,
      kilometraje: kmRaw ? Number(kmRaw) : undefined,
      notas: String(formData.get("notas") ?? "") || undefined,
      creadorId: session.userId,
      confirmar: formData.get("confirmar") === "true",
    });

    revalidatePath("/agenda");
    redirect("/agenda");
  } catch (e) {
    handleFormError(e, returnPath);
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
    if (isDomainError(e)) return { error: e.message, code: e.code };
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
    if (isDomainError(e)) return { error: e.message, code: e.code };
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
    if (isDomainError(e)) return { error: e.message, code: e.code };
    if (e instanceof Error && e.message === "UNAUTHORIZED") redirect("/login");
    throw e;
  }
}

export async function rescheduleTurnoAction(formData: FormData): Promise<void> {
  const turnoId = String(formData.get("turnoId"));
  const returnPath = `/turnos/${turnoId}/reprogramar`;

  try {
    const session = await requireSession();
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
    handleFormError(e, returnPath);
  }
}

export async function blockBahiaAction(formData: FormData): Promise<void> {
  const bahiaId = String(formData.get("bahiaId"));
  const returnPath = `/agenda/bloquear?bahiaId=${bahiaId}`;

  try {
    const session = await requireSession();
    const motivo = String(formData.get("motivo") ?? "").trim();
    if (!motivo) {
      redirectWithError(returnPath, "El motivo es obligatorio para bloqueos");
    }

    await blockBahia({
      empresaId: session.empresaId,
      bahiaId,
      inicio: new Date(String(formData.get("inicio"))),
      fin: new Date(String(formData.get("fin"))),
      motivo,
      usuarioId: session.userId,
    });
    revalidatePath("/agenda");
    redirect("/agenda");
  } catch (e) {
    handleFormError(e, returnPath);
  }
}

export async function removeBlockAction(blockId: string) {
  try {
    const session = await requireSession();
    await removeBlock(blockId, session.empresaId);
    revalidatePath("/agenda");
    return { success: true as const };
  } catch (e) {
    if (isDomainError(e)) return { error: e.message, code: e.code };
    throw e;
  }
}

export async function saveClienteAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "") || undefined;
  const returnPath = id ? `/clientes/${id}/editar` : "/clientes/nuevo";

  try {
    const session = await requireSession();

    const nombre = String(formData.get("nombre") ?? "").trim();
    const apellido = String(formData.get("apellido") ?? "").trim();
    const telefono = String(formData.get("telefono") ?? "").trim();
    const documento = String(formData.get("documento") ?? "").trim();
    const patente = String(formData.get("patente") ?? "").trim();

    if (!nombre) {
      redirectWithError(returnPath, "El nombre es obligatorio");
    }
    if (!id) {
      if (!apellido) redirectWithError(returnPath, "El apellido es obligatorio");
      if (!telefono) redirectWithError(returnPath, "El teléfono es obligatorio");
      if (!documento) redirectWithError(returnPath, "El documento es obligatorio");
      if (!patente) redirectWithError(returnPath, "La patente es obligatoria");
    }

    const cliente = await upsertCliente({
      id,
      empresaId: session.empresaId,
      nombre,
      apellido: apellido || undefined,
      email: String(formData.get("email") ?? "") || undefined,
      telefono: telefono || undefined,
      documento: documento || undefined,
      notas: String(formData.get("notas") ?? "") || undefined,
    });

    if (!id && patente) {
      await upsertVehiculo({
        empresaId: session.empresaId,
        patente,
        clienteId: cliente.id,
      });
    }

    revalidatePath("/clientes");
    redirect("/clientes");
  } catch (e) {
    mapClienteError(e, returnPath);
  }
}

export async function createClienteInlineAction(formData: FormData) {
  try {
    const session = await requireSession();
    const cliente = await upsertCliente({
      empresaId: session.empresaId,
      nombre: String(formData.get("nombre")),
      apellido: String(formData.get("apellido")),
      telefono: String(formData.get("telefono")),
    });
    revalidatePath("/clientes");
    return {
      cliente: {
        id: cliente.id,
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        telefono: cliente.telefono,
        vehiculos: [] as { vehiculoId: string; vehiculo: { patente: string; marca?: string | null } }[],
      },
    };
  } catch (e) {
    if (e instanceof ClienteValidationError) return { error: e.message };
    throw e;
  }
}

export async function createVehiculoInlineAction(formData: FormData) {
  try {
    const session = await requireSession();
    const vehiculo = await upsertVehiculo({
      empresaId: session.empresaId,
      clienteId: String(formData.get("clienteId")),
      patente: String(formData.get("patente")),
      marca: String(formData.get("marca") ?? "") || undefined,
      modelo: String(formData.get("modelo") ?? "") || undefined,
      tipoVehiculo: (String(formData.get("tipoVehiculo") ?? "auto") as TipoVehiculo),
      condicion: (String(formData.get("condicion") ?? "normal") as CondicionVehiculo),
      kilometrajeActual: formData.get("kilometrajeActual")
        ? Number(formData.get("kilometrajeActual"))
        : undefined,
    });
    revalidatePath("/clientes");
    return { vehiculo };
  } catch (e) {
    if (e instanceof ClienteValidationError) return { error: e.message };
    throw e;
  }
}

export async function saveVehiculoAction(formData: FormData): Promise<void> {
  const clienteId = String(formData.get("clienteId") ?? "") || undefined;
  const returnPath = clienteId
    ? `/clientes/${clienteId}/vehiculo/nuevo`
    : "/clientes";

  try {
    const session = await requireSession();
    await upsertVehiculo({
      empresaId: session.empresaId,
      patente: String(formData.get("patente")),
      marca: String(formData.get("marca") ?? "") || undefined,
      modelo: String(formData.get("modelo") ?? "") || undefined,
      anio: formData.get("anio") ? Number(formData.get("anio")) : undefined,
      color: String(formData.get("color") ?? "") || undefined,
      tipoVehiculo: String(formData.get("tipoVehiculo") ?? "auto") as TipoVehiculo,
      condicion: String(formData.get("condicion") ?? "normal") as CondicionVehiculo,
      kilometrajeActual: formData.get("kilometrajeActual")
        ? Number(formData.get("kilometrajeActual"))
        : undefined,
      clienteId,
    });
    revalidatePath("/clientes");
    if (clienteId) redirect(`/clientes/${clienteId}`);
    redirect("/clientes");
  } catch (e) {
    handleFormError(e, returnPath);
  }
}

export async function saveServicioAction(formData: FormData): Promise<void> {
  try {
    const session = await requireSession();
    try {
      assertAdminRole(session.rol);
    } catch {
      redirect("/agenda");
    }

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
    handleFormError(e, "/servicios");
  }
}

export async function saveConfigAction(formData: FormData): Promise<void> {
  try {
    const session = await requireSession();
    try {
      assertAdminRole(session.rol);
    } catch {
      redirect("/agenda");
    }

    await updateConfiguracionTaller(
      String(formData.get("tallerId")),
      Number(formData.get("margenMinutos"))
    );
    revalidatePath("/configuracion");
    redirect("/configuracion");
  } catch (e) {
    handleFormError(e, "/configuracion");
  }
}

export async function saveIntervaloAction(formData: FormData): Promise<void> {
  try {
    const session = await requireSession();
    assertAdminRole(session.rol);
    await upsertIntervaloKm({
      servicioId: String(formData.get("servicioId")),
      empresaId: session.empresaId,
      tipoVehiculo: String(formData.get("tipoVehiculo")) as TipoVehiculo,
      condicion: String(formData.get("condicion")) as CondicionVehiculo,
      intervaloKm: Number(formData.get("intervaloKm")),
    });
    revalidatePath("/servicios");
    redirect("/servicios");
  } catch (e) {
    handleFormError(e, "/servicios");
  }
}

export async function saveBahiaAction(formData: FormData): Promise<void> {
  try {
    const session = await requireSession();
    assertAdminRole(session.rol);
    const tallerId = String(formData.get("tallerId"));
    const bahiaId = String(formData.get("bahiaId") ?? "");
    if (bahiaId) {
      await updateBahia({
        bahiaId,
        empresaId: session.empresaId,
        nombre: String(formData.get("nombre")),
        activa: formData.get("activa") === "true",
        usuarioId: session.userId,
      });
    } else {
      await createBahia({
        tallerId,
        empresaId: session.empresaId,
        nombre: String(formData.get("nombre")),
        usuarioId: session.userId,
      });
    }
    revalidatePath("/bahias");
    redirect("/bahias");
  } catch (e) {
    handleFormError(e, "/bahias");
  }
}
