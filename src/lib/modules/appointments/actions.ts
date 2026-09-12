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
import {
  formActionError,
  readBoolean,
  readOptionalString,
  readString,
  readStringArray,
  type FormActionState,
} from "@/lib/form-action-state";
import {
  fieldErrorsForBloquearDomainError,
  fieldErrorsForClienteValidation,
  fieldErrorsForReprogramarDomainError,
  fieldErrorsForTurnoDomainError,
  fieldErrorsForVehiculoValidation,
  focusFieldForBloquearDomainError,
  focusFieldForReprogramarDomainError,
  focusFieldForTurnoDomainError,
} from "@/lib/form-field-errors";

export type ClienteFormValues = {
  nombre: string;
  apellido: string;
  telefono: string;
  documento: string;
  patente: string;
  email: string;
  notas: string;
};

export type ClienteFormState = FormActionState<ClienteFormValues>;

export type VehiculoFormValues = {
  patente: string;
  marca: string;
  modelo: string;
  tipoVehiculo: TipoVehiculo;
  condicion: CondicionVehiculo;
  kilometrajeActual: string;
  anio: string;
  color: string;
};

export type VehiculoFormState = FormActionState<VehiculoFormValues>;

export type TurnoFormValues = {
  clienteId: string;
  vehiculoId: string;
  servicioIds: string[];
  bahiaId: string;
  inicio: string;
  kilometraje: string;
  notas: string;
  confirmar: boolean;
};

export type TurnoFormState = FormActionState<TurnoFormValues>;

export type ReprogramarFormValues = {
  bahiaId: string;
  inicio: string;
};

export type ReprogramarFormState = FormActionState<ReprogramarFormValues>;

export type BloquearFormValues = {
  bahiaId: string;
  inicio: string;
  fin: string;
  motivo: string;
};

export type BloquearFormState = FormActionState<BloquearFormValues>;

export type InlineClienteFormValues = {
  nombre: string;
  apellido: string;
  telefono: string;
};

function extractReprogramarFormValues(formData: FormData): ReprogramarFormValues {
  return {
    bahiaId: readString(formData, "bahiaId"),
    inicio: readString(formData, "inicio"),
  };
}

function extractBloquearFormValues(formData: FormData): BloquearFormValues {
  return {
    bahiaId: readString(formData, "bahiaId"),
    inicio: readString(formData, "inicio"),
    fin: readString(formData, "fin"),
    motivo: readString(formData, "motivo"),
  };
}

function extractInlineClienteFormValues(formData: FormData): InlineClienteFormValues {
  return {
    nombre: readString(formData, "nombre"),
    apellido: readString(formData, "apellido"),
    telefono: readString(formData, "telefono"),
  };
}

function extractClienteFormValues(formData: FormData): ClienteFormValues {
  return {
    nombre: readString(formData, "nombre"),
    apellido: readString(formData, "apellido"),
    telefono: readString(formData, "telefono"),
    documento: readString(formData, "documento"),
    patente: readString(formData, "patente"),
    email: readString(formData, "email"),
    notas: readString(formData, "notas"),
  };
}

function extractVehiculoFormValues(formData: FormData): VehiculoFormValues {
  return {
    patente: readString(formData, "patente"),
    marca: readString(formData, "marca"),
    modelo: readString(formData, "modelo"),
    tipoVehiculo: (readString(formData, "tipoVehiculo") || "auto") as TipoVehiculo,
    condicion: (readString(formData, "condicion") || "normal") as CondicionVehiculo,
    kilometrajeActual: readString(formData, "kilometrajeActual"),
    anio: readString(formData, "anio"),
    color: readString(formData, "color"),
  };
}

function extractTurnoFormValues(formData: FormData): TurnoFormValues {
  return {
    clienteId: readString(formData, "clienteId"),
    vehiculoId: readString(formData, "vehiculoId"),
    servicioIds: readStringArray(formData, "servicioIds"),
    bahiaId: readString(formData, "bahiaId"),
    inicio: readString(formData, "inicio"),
    kilometraje: readString(formData, "kilometraje"),
    notas: readString(formData, "notas"),
    confirmar: readBoolean(formData, "confirmar"),
  };
}

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

export async function createTurnoAction(
  _prev: TurnoFormState | undefined,
  formData: FormData
): Promise<TurnoFormState | undefined> {
  const tallerId = String(formData.get("tallerId"));
  const values = extractTurnoFormValues(formData);

  try {
    const session = await requireSession();
    const servicioIds = values.servicioIds;

    if (servicioIds.length === 0) {
      return formActionError(
        "Seleccioná al menos un servicio",
        values,
        { servicioIds: "Seleccioná al menos un servicio" },
        "servicioIds"
      );
    }

    const kmRaw = values.kilometraje;
    const inicio = new Date(values.inicio);

    assertNotPastInicio(inicio);

    await createTurno({
      empresaId: session.empresaId,
      tallerId,
      bahiaId: values.bahiaId || undefined,
      clienteId: values.clienteId,
      vehiculoId: values.vehiculoId,
      servicioIds,
      inicio,
      kilometraje: kmRaw ? Number(kmRaw) : undefined,
      notas: readOptionalString(formData, "notas"),
      creadorId: session.userId,
      confirmar: values.confirmar,
    });

    revalidatePath("/agenda");
    redirect("/agenda");
  } catch (e) {
    if (isDomainError(e)) {
      const fieldErrors = fieldErrorsForTurnoDomainError(e.code, e.message);
      return formActionError(
        e.message,
        values,
        fieldErrors,
        focusFieldForTurnoDomainError(e.code)
      );
    }
    if (e instanceof Error && e.message === "UNAUTHORIZED") redirect("/login");
    throw e;
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

export async function rescheduleTurnoAction(
  _prev: ReprogramarFormState | undefined,
  formData: FormData
): Promise<ReprogramarFormState | undefined> {
  const turnoId = String(formData.get("turnoId"));
  const values = extractReprogramarFormValues(formData);

  try {
    const session = await requireSession();
    if (!values.inicio) {
      return formActionError(
        "El nuevo inicio es obligatorio",
        values,
        { inicio: "El nuevo inicio es obligatorio" },
        "inicio"
      );
    }

    await rescheduleTurno({
      turnoId,
      empresaId: session.empresaId,
      bahiaId: values.bahiaId || undefined,
      inicio: new Date(values.inicio),
      version: Number(formData.get("version")),
      usuarioId: session.userId,
    });
    revalidatePath("/agenda");
    redirect(`/turnos/${turnoId}`);
  } catch (e) {
    if (isDomainError(e)) {
      return formActionError(
        e.message,
        values,
        fieldErrorsForReprogramarDomainError(e.code, e.message),
        focusFieldForReprogramarDomainError(e.code)
      );
    }
    if (e instanceof Error && e.message === "UNAUTHORIZED") redirect("/login");
    throw e;
  }
}

export async function blockBahiaAction(
  _prev: BloquearFormState | undefined,
  formData: FormData
): Promise<BloquearFormState | undefined> {
  const values = extractBloquearFormValues(formData);

  try {
    const session = await requireSession();
    if (!values.motivo) {
      return formActionError(
        "El motivo es obligatorio para bloqueos",
        values,
        { motivo: "El motivo es obligatorio para bloqueos" },
        "motivo"
      );
    }

    await blockBahia({
      empresaId: session.empresaId,
      bahiaId: values.bahiaId,
      inicio: new Date(values.inicio),
      fin: new Date(values.fin),
      motivo: values.motivo,
      usuarioId: session.userId,
    });
    revalidatePath("/agenda");
    redirect("/agenda");
  } catch (e) {
    if (isDomainError(e)) {
      return formActionError(
        e.message,
        values,
        fieldErrorsForBloquearDomainError(e.code, e.message),
        focusFieldForBloquearDomainError(e.code)
      );
    }
    if (e instanceof Error && e.message === "UNAUTHORIZED") redirect("/login");
    throw e;
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

export async function saveClienteAction(
  _prev: ClienteFormState | undefined,
  formData: FormData
): Promise<ClienteFormState | undefined> {
  const id = String(formData.get("id") ?? "") || undefined;
  const values = extractClienteFormValues(formData);

  try {
    const session = await requireSession();
    const { nombre, apellido, telefono, documento, patente, email, notas } = values;

    if (!nombre) {
      return formActionError("El nombre es obligatorio", values, {
        nombre: "El nombre es obligatorio",
      });
    }
    if (!id) {
      if (!apellido) {
        return formActionError("El apellido es obligatorio", values, {
          apellido: "El apellido es obligatorio",
        });
      }
      if (!telefono) {
        return formActionError("El teléfono es obligatorio", values, {
          telefono: "El teléfono es obligatorio",
        });
      }
      if (!documento) {
        return formActionError("El documento es obligatorio", values, {
          documento: "El documento es obligatorio",
        });
      }
      if (!patente) {
        return formActionError("La patente es obligatoria", values, {
          patente: "La patente es obligatoria",
        });
      }
    }

    const cliente = await upsertCliente({
      id,
      empresaId: session.empresaId,
      nombre,
      apellido: apellido || undefined,
      email: email || undefined,
      telefono: telefono || undefined,
      documento: documento || undefined,
      notas: notas || undefined,
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
    if (e instanceof ClienteValidationError) {
      return formActionError(
        e.message,
        values,
        fieldErrorsForClienteValidation(e.message)
      );
    }
    if (isDomainError(e)) {
      return formActionError(
        e.message,
        values,
        fieldErrorsForClienteValidation(e.message)
      );
    }
    if (e instanceof Error && e.message === "UNAUTHORIZED") redirect("/login");
    throw e;
  }
}

export async function createClienteInlineAction(formData: FormData) {
  const values = extractInlineClienteFormValues(formData);
  try {
    const session = await requireSession();
    const cliente = await upsertCliente({
      empresaId: session.empresaId,
      nombre: values.nombre,
      apellido: values.apellido,
      telefono: values.telefono,
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
    if (e instanceof ClienteValidationError) {
      const fieldErrors = fieldErrorsForClienteValidation(e.message);
      return {
        error: e.message,
        fieldErrors,
        focusField: fieldErrors ? Object.keys(fieldErrors)[0] : undefined,
      };
    }
    throw e;
  }
}

export async function createVehiculoInlineAction(formData: FormData) {
  const values = extractVehiculoFormValues(formData);
  try {
    const session = await requireSession();
    if (!values.patente) {
      return {
        error: "La patente es obligatoria",
        fieldErrors: { patente: "La patente es obligatoria" },
        focusField: "patente",
      };
    }
    const vehiculo = await upsertVehiculo({
      empresaId: session.empresaId,
      clienteId: String(formData.get("clienteId")),
      patente: values.patente,
      marca: values.marca || undefined,
      modelo: values.modelo || undefined,
      tipoVehiculo: values.tipoVehiculo,
      condicion: values.condicion,
      kilometrajeActual: values.kilometrajeActual
        ? Number(values.kilometrajeActual)
        : undefined,
    });
    revalidatePath("/clientes");
    return { vehiculo };
  } catch (e) {
    if (e instanceof ClienteValidationError) {
      const fieldErrors = fieldErrorsForVehiculoValidation(e.message);
      return {
        error: e.message,
        fieldErrors,
        focusField: fieldErrors ? Object.keys(fieldErrors)[0] : undefined,
      };
    }
    throw e;
  }
}

export async function saveVehiculoAction(
  _prev: VehiculoFormState | undefined,
  formData: FormData
): Promise<VehiculoFormState | undefined> {
  const clienteId = String(formData.get("clienteId") ?? "") || undefined;
  const values = extractVehiculoFormValues(formData);

  try {
    const session = await requireSession();
    if (!values.patente) {
      return formActionError("La patente es obligatoria", values, {
        patente: "La patente es obligatoria",
      });
    }
    await upsertVehiculo({
      empresaId: session.empresaId,
      patente: values.patente,
      marca: values.marca || undefined,
      modelo: values.modelo || undefined,
      anio: values.anio ? Number(values.anio) : undefined,
      color: values.color || undefined,
      tipoVehiculo: values.tipoVehiculo,
      condicion: values.condicion,
      kilometrajeActual: values.kilometrajeActual
        ? Number(values.kilometrajeActual)
        : undefined,
      clienteId,
    });
    revalidatePath("/clientes");
    if (clienteId) redirect(`/clientes/${clienteId}#vehiculos`);
    redirect("/clientes");
  } catch (e) {
    if (e instanceof ClienteValidationError) {
      return formActionError(
        e.message,
        values,
        fieldErrorsForVehiculoValidation(e.message)
      );
    }
    if (isDomainError(e)) {
      return formActionError(
        e.message,
        values,
        fieldErrorsForVehiculoValidation(e.message)
      );
    }
    if (e instanceof Error && e.message === "UNAUTHORIZED") redirect("/login");
    throw e;
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

    await updateConfiguracionTaller({
      tallerId: String(formData.get("tallerId")),
      empresaId: session.empresaId,
      margenMinutos: Number(formData.get("margenMinutos")),
    });
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
