import prisma from "@/lib/db";

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
  if (params.id) {
    return prisma.cliente.update({
      where: { id: params.id },
      data: {
        nombre: params.nombre,
        apellido: params.apellido,
        email: params.email,
        telefono: params.telefono,
        documento: params.documento,
        notas: params.notas,
      },
    });
  }

  return prisma.cliente.create({
    data: {
      empresaId: params.empresaId,
      nombre: params.nombre,
      apellido: params.apellido,
      email: params.email,
      telefono: params.telefono,
      documento: params.documento,
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
    },
    update: {
      marca: params.marca,
      modelo: params.modelo,
      anio: params.anio,
      color: params.color,
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

  if (!cliente || !vehiculo) throw new Error("NOT_FOUND");

  return prisma.clienteVehiculo.upsert({
    where: { clienteId_vehiculoId: { clienteId, vehiculoId } },
    create: { clienteId, vehiculoId },
    update: {},
  });
}
