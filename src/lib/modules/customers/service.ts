import prisma from "@/lib/db";
import { CondicionVehiculo, TipoVehiculo } from "@prisma/client";
import {
  assertClienteRequiredFields,
  ClienteValidationError,
  normalizeTelefonoE164,
} from "@/lib/modules/customers/validation";
import { DomainError } from "@/lib/modules/appointments/errors";

export { ClienteValidationError };

export async function listClientes(empresaId: string, search?: string) {
  return prisma.cliente.findMany({
    where: {
      empresaId,
      activo: true,
      ...(search
        ? {
            OR: [
              { nombre: { contains: search, mode: "insensitive" } },
              { apellido: { contains: search, mode: "insensitive" } },
              { telefono: { contains: search } },
              { email: { contains: search, mode: "insensitive" } },
              { documento: { contains: search, mode: "insensitive" } },
              {
                vehiculos: {
                  some: {
                    vehiculo: {
                      patente: { contains: search, mode: "insensitive" },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      vehiculos: { include: { vehiculo: true } },
    },
    orderBy: { nombre: "asc" },
  });
}

export async function getCliente(id: string, empresaId: string) {
  return prisma.cliente.findFirst({
    where: { id, empresaId },
    include: {
      vehiculos: { include: { vehiculo: true } },
      documentos: true,
      turnos: {
        orderBy: { inicio: "desc" },
        take: 10,
        include: { detalles: true, bahia: true },
      },
    },
  });
}

export async function getClienteByTelefono(telefono: string, empresaId: string) {
  const normalized = normalizeTelefonoE164(telefono);
  return prisma.cliente.findFirst({
    where: { empresaId, telefono: normalized, activo: true },
  });
}

export async function upsertCliente(params: {
  empresaId: string;
  id?: string;
  nombre: string;
  apellido?: string;
  email?: string;
  telefono?: string;
  documento?: string;
  notas?: string;
}) {
  const { nombre, apellido, telefono } = assertClienteRequiredFields(params);

  if (params.id) {
    const updated = await prisma.cliente.updateMany({
      where: { id: params.id, empresaId: params.empresaId },
      data: {
        nombre,
        apellido,
        email: params.email?.trim() || null,
        telefono,
        documento: params.documento?.trim() || null,
        notas: params.notas,
      },
    });
    if (updated.count === 0) {
      throw new DomainError("Cliente no encontrado", "RecursoNoEncontrado");
    }
    return prisma.cliente.findFirstOrThrow({
      where: { id: params.id, empresaId: params.empresaId },
    });
  }

  return prisma.cliente.create({
    data: {
      empresaId: params.empresaId,
      nombre,
      apellido,
      email: params.email?.trim() || null,
      telefono,
      documento: params.documento?.trim() || null,
      notas: params.notas,
    },
  });
}

export async function upsertVehiculo(params: {
  empresaId: string;
  patente: string;
  marca?: string;
  modelo?: string;
  anio?: number;
  color?: string;
  tipoVehiculo?: TipoVehiculo;
  condicion?: CondicionVehiculo;
  kilometrajeActual?: number;
  clienteId?: string;
}) {
  const vehiculo = await prisma.vehiculo.upsert({
    where: {
      empresaId_patente: {
        empresaId: params.empresaId,
        patente: params.patente.toUpperCase(),
      },
    },
    create: {
      empresaId: params.empresaId,
      patente: params.patente.toUpperCase(),
      marca: params.marca,
      modelo: params.modelo,
      anio: params.anio,
      color: params.color,
      tipoVehiculo: params.tipoVehiculo ?? TipoVehiculo.auto,
      condicion: params.condicion ?? CondicionVehiculo.normal,
      kilometrajeActual: params.kilometrajeActual,
    },
    update: {
      marca: params.marca,
      modelo: params.modelo,
      anio: params.anio,
      color: params.color,
      ...(params.tipoVehiculo ? { tipoVehiculo: params.tipoVehiculo } : {}),
      ...(params.condicion ? { condicion: params.condicion } : {}),
      ...(params.kilometrajeActual !== undefined
        ? { kilometrajeActual: params.kilometrajeActual }
        : {}),
    },
  });

  if (params.clienteId) {
    await prisma.clienteVehiculo.upsert({
      where: {
        clienteId_vehiculoId: {
          clienteId: params.clienteId,
          vehiculoId: vehiculo.id,
        },
      },
      create: {
        clienteId: params.clienteId,
        vehiculoId: vehiculo.id,
        esPrincipal: true,
      },
      update: {},
    });
  }

  return vehiculo;
}

export async function getVehiculoForCliente(
  vehiculoId: string,
  clienteId: string,
  empresaId: string
) {
  const link = await prisma.clienteVehiculo.findFirst({
    where: {
      vehiculoId,
      clienteId,
      cliente: { empresaId },
      vehiculo: { empresaId },
    },
    include: { vehiculo: true },
  });
  return link?.vehiculo ?? null;
}

export async function linkVehiculoToCliente(
  clienteId: string,
  vehiculoId: string,
  empresaId: string
) {
  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, empresaId },
  });
  const vehiculo = await prisma.vehiculo.findFirst({
    where: { id: vehiculoId, empresaId },
  });

  if (!cliente || !vehiculo) throw new DomainError("No encontrado", "RecursoNoEncontrado");

  return prisma.clienteVehiculo.upsert({
    where: { clienteId_vehiculoId: { clienteId, vehiculoId } },
    create: { clienteId, vehiculoId },
    update: {},
  });
}

export { getClienteContext } from "@/lib/modules/customers/application/get-cliente-context";
