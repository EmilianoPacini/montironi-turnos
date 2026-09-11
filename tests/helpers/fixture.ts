import { PrismaClient, DiaSemana } from "@prisma/client";
import { addMinutes, setHours, setMinutes, startOfDay } from "date-fns";

export const prisma = new PrismaClient();

export interface TestFixture {
  empresaId: string;
  empresaSlug: string;
  tallerId: string;
  bahiaId: string;
  bahia2Id: string;
  bahia3Id: string;
  clienteId: string;
  vehiculoId: string;
  servicioId: string;
  slotInicio: Date;
  userId?: string;
}

export async function createWahAccount(
  empresaId: string,
  suffix = "test",
  phoneNumberId?: string
) {
  return prisma.whatsappAccount.create({
    data: {
      empresaId,
      phoneNumberId: phoneNumberId ?? `phone_${suffix}`,
      displayPhoneNumber: "+5491112345678",
      label: `WA ${suffix}`,
    },
  });
}

export async function createTestFixture(suffix = Date.now().toString()): Promise<TestFixture> {
  const empresa = await prisma.empresa.create({
    data: { nombre: "Test Co", slug: `test-${suffix}` },
  });

  const taller = await prisma.taller.create({
    data: { empresaId: empresa.id, nombre: "Test Taller" },
  });

  await prisma.configuracionTurnos.create({
    data: { tallerId: taller.id, margenMinutos: 15 },
  });

  const bahias = await Promise.all(
    ["B1", "B2", "B3"].map((nombre, orden) =>
      prisma.bahia.create({ data: { tallerId: taller.id, nombre, orden: orden + 1 } })
    )
  );

  for (const dia of Object.values(DiaSemana)) {
    const patron = await prisma.patronHorario.create({
      data: { tallerId: taller.id, dia },
    });
    await prisma.franjaHoraria.create({
      data: { patronHorarioId: patron.id, horaInicio: "08:00", horaFin: "20:00" },
    });
  }

  const tipo = await prisma.tipoServicio.create({
    data: { empresaId: empresa.id, nombre: "Test" },
  });
  const servicio = await prisma.servicio.create({
    data: {
      empresaId: empresa.id,
      tipoServicioId: tipo.id,
      nombre: "Servicio test",
      duracionMin: 60,
      precio: 1000,
      modoPrecio: "fijo",
    },
  });

  await prisma.tallerServicio.create({
    data: { tallerId: taller.id, servicioId: servicio.id },
  });
  for (const bahia of bahias) {
    await prisma.bahiaServicio.create({
      data: { bahiaId: bahia.id, servicioId: servicio.id },
    });
  }

  const cliente = await prisma.cliente.create({
    data: {
      empresaId: empresa.id,
      nombre: "Test",
      apellido: "Cliente",
      telefono: `+54911${suffix.slice(-8).padStart(8, "0")}`,
    },
  });
  const vehiculo = await prisma.vehiculo.create({
    data: { empresaId: empresa.id, patente: `TST${suffix.slice(-4)}`, kilometrajeActual: 10000 },
  });
  await prisma.clienteVehiculo.create({
    data: { clienteId: cliente.id, vehiculoId: vehiculo.id, esPrincipal: true },
  });

  const usuario = await prisma.usuario.create({
    data: {
      empresaId: empresa.id,
      email: `test-${suffix}@example.com`,
      nombre: "Test User",
      passwordHash: "hash",
    },
  });

  const today = new Date();
  const day = today.getDay();
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : (8 - day) % 7 || 7;
  const monday = addMinutes(startOfDay(today), daysUntilMonday * 24 * 60);
  const slotInicio = setMinutes(setHours(monday, 10), 0);

  return {
    empresaId: empresa.id,
    empresaSlug: empresa.slug,
    tallerId: taller.id,
    bahiaId: bahias[0].id,
    bahia2Id: bahias[1].id,
    bahia3Id: bahias[2].id,
    clienteId: cliente.id,
    vehiculoId: vehiculo.id,
    servicioId: servicio.id,
    slotInicio,
    userId: usuario.id,
  };
}

export async function destroyTestFixture(empresaId: string) {
  await prisma.sesion.deleteMany({ where: { empresaId } });
  await prisma.wahMessage.deleteMany({ where: { empresaId } });
  await prisma.wahConversation.deleteMany({ where: { empresaId } });
  await prisma.wahMedia.deleteMany({ where: { empresaId } });
  await prisma.whatsappAccount.deleteMany({ where: { empresaId } });
  await prisma.ocupacionBahia.deleteMany({
    where: { bahia: { taller: { empresaId } } },
  });
  await prisma.eventoTurno.deleteMany({ where: { turno: { empresaId } } });
  await prisma.detalleTurno.deleteMany({ where: { turno: { empresaId } } });
  await prisma.movimiento.deleteMany({ where: { empresaId } });
  await prisma.turno.deleteMany({ where: { empresaId } });
  await prisma.empresa.delete({ where: { id: empresaId } });
}

export function slotAt(base: Date, offsetMin: number) {
  return addMinutes(base, offsetMin);
}
