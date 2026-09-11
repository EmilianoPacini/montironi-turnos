import { PrismaClient, DiaSemana, EstadoTurno, CanalTurno, RolUsuario, ModoPrecio } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { addMinutes, setHours, setMinutes, startOfDay } from "date-fns";

const prisma = new PrismaClient();

function timeOnToday(h: number, m: number): Date {
  const d = startOfDay(new Date());
  return setMinutes(setHours(d, h), m);
}

async function main() {
  console.log("🌱 Sembrando base de datos Montironi...");

  await prisma.eventoTurno.deleteMany();
  await prisma.detalleTurno.deleteMany();
  await prisma.ocupacionBahia.deleteMany();
  await prisma.turno.deleteMany();
  await prisma.operacionApi.deleteMany();
  await prisma.movimiento.deleteMany();
  await prisma.servicioIntervaloKm.deleteMany();
  await prisma.documentoCliente.deleteMany();
  await prisma.clienteVehiculo.deleteMany();
  await prisma.franjaHoraria.deleteMany();
  await prisma.patronHorario.deleteMany();
  await prisma.excepcionHorario.deleteMany();
  await prisma.bahiaServicio.deleteMany();
  await prisma.tallerServicio.deleteMany();
  await prisma.servicio.deleteMany();
  await prisma.tipoServicio.deleteMany();
  await prisma.bahia.deleteMany();
  await prisma.taller.deleteMany();
  await prisma.configuracionTurnos.deleteMany();
  await prisma.vehiculo.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.empresa.deleteMany();

  const empresa = await prisma.empresa.create({
    data: {
      nombre: "Montironi",
      slug: "montironi",
    },
  });

  const adminHash = await hashPassword("admin123");
  const empleadoHash = await hashPassword("empleado123");

  const admin = await prisma.usuario.create({
    data: {
      empresaId: empresa.id,
      email: "admin@montironi.com",
      nombre: "Admin Montironi",
      passwordHash: adminHash,
      rol: RolUsuario.admin,
    },
  });

  await prisma.usuario.create({
    data: {
      empresaId: empresa.id,
      email: "empleado@montironi.com",
      nombre: "Juan Pérez",
      passwordHash: empleadoHash,
      rol: RolUsuario.empleado,
    },
  });

  const tallerCentro = await prisma.taller.create({
    data: {
      empresaId: empresa.id,
      nombre: "Taller Centro",
      direccion: "Av. Corrientes 1234, CABA",
    },
  });

  const tallerNorte = await prisma.taller.create({
    data: {
      empresaId: empresa.id,
      nombre: "Taller Norte",
      direccion: "Av. del Libertador 5678",
    },
  });

  await prisma.configuracionTurnos.create({
    data: { tallerId: tallerCentro.id, margenMinutos: 15 },
  });
  await prisma.configuracionTurnos.create({
    data: { tallerId: tallerNorte.id, margenMinutos: 20 },
  });

  const bahiasCentro = await Promise.all(
    ["Bahía 1", "Bahía 2", "Bahía 3"].map((nombre, i) =>
      prisma.bahia.create({
        data: { tallerId: tallerCentro.id, nombre, orden: i + 1 },
      })
    )
  );

  const bahiasNorte = await Promise.all(
    ["Bahía A", "Bahía B"].map((nombre, i) =>
      prisma.bahia.create({
        data: { tallerId: tallerNorte.id, nombre, orden: i + 1 },
      })
    )
  );

  const dias = [
    DiaSemana.lunes,
    DiaSemana.martes,
    DiaSemana.miercoles,
    DiaSemana.jueves,
    DiaSemana.viernes,
  ];

  for (const taller of [tallerCentro, tallerNorte]) {
    for (const dia of dias) {
      const patron = await prisma.patronHorario.create({
        data: { tallerId: taller.id, dia },
      });
      await prisma.franjaHoraria.createMany({
        data: [
          { patronHorarioId: patron.id, horaInicio: "08:00", horaFin: "12:00" },
          { patronHorarioId: patron.id, horaInicio: "13:00", horaFin: "18:00" },
        ],
      });
    }
  }

  const tipoMecanica = await prisma.tipoServicio.create({
    data: { empresaId: empresa.id, nombre: "Mecánica" },
  });

  const tipoService = await prisma.tipoServicio.create({
    data: { empresaId: empresa.id, nombre: "Service" },
  });

  const servicios = await Promise.all([
    prisma.servicio.create({
      data: {
        empresaId: empresa.id,
        tipoServicioId: tipoMecanica.id,
        nombre: "Cambio de aceite",
        duracionMin: 45,
        precio: 85000,
        modoPrecio: ModoPrecio.fijo,
      },
    }),
    prisma.servicio.create({
      data: {
        empresaId: empresa.id,
        tipoServicioId: tipoMecanica.id,
        nombre: "Frenos - revisión",
        duracionMin: 60,
        precio: 120000,
        modoPrecio: ModoPrecio.desde,
      },
    }),
    prisma.servicio.create({
      data: {
        empresaId: empresa.id,
        tipoServicioId: tipoService.id,
        nombre: "Service 10.000 km",
        duracionMin: 90,
        precio: 180000,
        modoPrecio: ModoPrecio.fijo,
      },
    }),
    prisma.servicio.create({
      data: {
        empresaId: empresa.id,
        tipoServicioId: tipoService.id,
        nombre: "Alineación y balanceo",
        duracionMin: 60,
        precio: 95000,
        modoPrecio: ModoPrecio.a_presupuestar,
      },
    }),
  ]);

  await prisma.servicioIntervaloKm.createMany({
    data: [
      { servicioId: servicios[0].id, tipoVehiculo: "auto", condicion: "normal", intervaloKm: 10000 },
      { servicioId: servicios[0].id, tipoVehiculo: "camioneta", condicion: "normal", intervaloKm: 8000 },
      { servicioId: servicios[2].id, tipoVehiculo: "auto", condicion: "normal", intervaloKm: 10000 },
    ],
  });

  for (const taller of [tallerCentro, tallerNorte]) {
    for (const s of servicios) {
      await prisma.tallerServicio.create({
        data: { tallerId: taller.id, servicioId: s.id },
      });
    }
  }

  for (const bahia of [...bahiasCentro, ...bahiasNorte]) {
    for (const s of servicios) {
      await prisma.bahiaServicio.create({
        data: { bahiaId: bahia.id, servicioId: s.id },
      });
    }
  }

  const clientesData = [
    { nombre: "María", apellido: "González", telefono: "+5491155551001", email: "maria.g@email.com" },
    { nombre: "Carlos", apellido: "Rodríguez", telefono: "+5491155551002", email: "carlos.r@email.com" },
    { nombre: "Laura", apellido: "Fernández", telefono: "+5491155551003" },
    { nombre: "Diego", apellido: "López", telefono: "+5491155551004", email: "diego.l@email.com" },
  ];

  const clientes = [];
  for (const c of clientesData) {
    clientes.push(
      await prisma.cliente.create({ data: { empresaId: empresa.id, ...c } })
    );
  }

  const vehiculosData = [
    { patente: "AB123CD", marca: "Toyota", modelo: "Corolla", anio: 2022, tipoVehiculo: "auto" as const, condicion: "normal" as const, kilometrajeActual: 45000 },
    { patente: "AC456EF", marca: "Ford", modelo: "Ranger", anio: 2021, tipoVehiculo: "camioneta" as const, condicion: "normal" as const, kilometrajeActual: 82000 },
    { patente: "AD789GH", marca: "Volkswagen", modelo: "Amarok", anio: 2023, tipoVehiculo: "camioneta" as const, condicion: "nuevo" as const, kilometrajeActual: 12000 },
    { patente: "AE012IJ", marca: "Chevrolet", modelo: "Onix", anio: 2020, tipoVehiculo: "auto" as const, condicion: "viejo" as const, kilometrajeActual: 98000 },
  ];

  const vehiculos = [];
  for (const v of vehiculosData) {
    vehiculos.push(
      await prisma.vehiculo.create({ data: { empresaId: empresa.id, ...v } })
    );
  }

  for (let i = 0; i < clientes.length; i++) {
    await prisma.clienteVehiculo.create({
      data: {
        clienteId: clientes[i].id,
        vehiculoId: vehiculos[i].id,
        esPrincipal: true,
      },
    });
  }

  const turnoSpecs = [
    { h: 9, m: 0, estado: EstadoTurno.confirmado, bahia: bahiasCentro[0], cliente: 0, servicios: [0], canal: CanalTurno.interno },
    { h: 10, m: 30, estado: EstadoTurno.pendiente, bahia: bahiasCentro[1], cliente: 1, servicios: [1], canal: CanalTurno.whatsapp },
    { h: 11, m: 0, estado: EstadoTurno.recibido, bahia: bahiasCentro[0], cliente: 2, servicios: [2], canal: CanalTurno.interno },
    { h: 14, m: 0, estado: EstadoTurno.en_servicio, bahia: bahiasCentro[2], cliente: 3, servicios: [0, 3], canal: CanalTurno.agente_ia },
    { h: 15, m: 30, estado: EstadoTurno.finalizado, bahia: bahiasCentro[1], cliente: 0, servicios: [0], canal: CanalTurno.interno },
    { h: 16, m: 0, estado: EstadoTurno.pendiente, bahia: bahiasCentro[2], cliente: 1, servicios: [2], canal: CanalTurno.telefono },
  ];

  for (const spec of turnoSpecs) {
    const inicio = timeOnToday(spec.h, spec.m);
    const selectedServicios = spec.servicios.map((i) => servicios[i]);
    const duracion = selectedServicios.reduce((a, s) => a + s.duracionMin, 0) + 15;
    const finalizaEn = addMinutes(inicio, duracion);

    const turno = await prisma.turno.create({
      data: {
        empresaId: empresa.id,
        tallerId: tallerCentro.id,
        bahiaId: spec.bahia.id,
        clienteId: clientes[spec.cliente].id,
        vehiculoId: vehiculos[spec.cliente].id,
        creadorId: admin.id,
        estado: spec.estado,
        canal: spec.canal,
        inicio,
        finalizaEn,
        detalles: {
          create: selectedServicios.map((s, i) => ({
            servicioId: s.id,
            nombreSnapshot: s.nombre,
            duracionMin: s.duracionMin,
            precioSnapshot: s.precio,
            modoPrecioSnapshot: s.modoPrecio,
            orden: i,
          })),
        },
        eventos: {
          create: {
            estadoNuevo: spec.estado,
            usuarioId: admin.id,
            detalle: "Turno sembrado",
          },
        },
      },
    });

    await prisma.ocupacionBahia.create({
      data: {
        bahiaId: spec.bahia.id,
        turnoId: turno.id,
        tipo: "turno",
        inicio,
        fin: finalizaEn,
        activo: !(
          [
            EstadoTurno.finalizado,
            EstadoTurno.cancelado,
            EstadoTurno.ausente,
            EstadoTurno.vencido,
          ] as EstadoTurno[]
        ).includes(spec.estado),
      },
    });
  }

  await prisma.ocupacionBahia.create({
    data: {
      bahiaId: bahiasCentro[1].id,
      tipo: "bloqueo",
      inicio: timeOnToday(12, 0),
      fin: timeOnToday(13, 0),
      motivo: "Almuerzo / mantenimiento equipos",
      creadoPorUsuarioId: admin.id,
      activo: true,
    },
  });

  console.log("✅ Seed completado");
  console.log("   Admin: admin@montironi.com / admin123");
  console.log("   Empleado: empleado@montironi.com / empleado123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
