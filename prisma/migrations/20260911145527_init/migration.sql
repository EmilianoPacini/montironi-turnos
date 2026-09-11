-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'EMPLEADO');

-- CreateEnum
CREATE TYPE "EstadoTurno" AS ENUM ('pendiente', 'confirmado', 'recibido', 'en_servicio', 'finalizado', 'cancelado', 'ausente', 'vencido');

-- CreateEnum
CREATE TYPE "OrigenTurno" AS ENUM ('panel', 'whatsapp', 'voz', 'api');

-- CreateEnum
CREATE TYPE "TipoOcupacion" AS ENUM ('turno', 'bloqueo');

-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo');

-- CreateEnum
CREATE TYPE "TipoExcepcion" AS ENUM ('cerrado', 'horario_especial');

-- CreateTable
CREATE TABLE "empresa" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'EMPLEADO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taller" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bahia" (
    "id" TEXT NOT NULL,
    "taller_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bahia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipo_servicio" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipo_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicio" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "tipo_servicio_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "duracion_min" INTEGER NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taller_servicio" (
    "id" TEXT NOT NULL,
    "taller_id" TEXT NOT NULL,
    "servicio_id" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "taller_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bahia_servicio" (
    "id" TEXT NOT NULL,
    "bahia_id" TEXT NOT NULL,
    "servicio_id" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "bahia_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patron_horario" (
    "id" TEXT NOT NULL,
    "taller_id" TEXT NOT NULL,
    "dia" "DiaSemana" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "patron_horario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "franja_horaria" (
    "id" TEXT NOT NULL,
    "patron_horario_id" TEXT NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,

    CONSTRAINT "franja_horaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "excepcion_horario" (
    "id" TEXT NOT NULL,
    "taller_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" "TipoExcepcion" NOT NULL,
    "hora_inicio" TEXT,
    "hora_fin" TEXT,
    "motivo" TEXT,

    CONSTRAINT "excepcion_horario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_turnos" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "margen_min" INTEGER NOT NULL DEFAULT 15,

    CONSTRAINT "configuracion_turnos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "documento" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehiculo" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "patente" TEXT NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "anio" INTEGER,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente_vehiculo" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "vehiculo_id" TEXT NOT NULL,
    "es_principal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cliente_vehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento_cliente" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "url" TEXT,
    "tipo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turno" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "taller_id" TEXT NOT NULL,
    "bahia_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "vehiculo_id" TEXT NOT NULL,
    "creador_id" TEXT,
    "agente_ia_id" TEXT,
    "estado" "EstadoTurno" NOT NULL DEFAULT 'pendiente',
    "origen" "OrigenTurno" NOT NULL DEFAULT 'panel',
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "notas" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalle_turno" (
    "id" TEXT NOT NULL,
    "turno_id" TEXT NOT NULL,
    "servicio_id" TEXT NOT NULL,
    "nombre_snapshot" TEXT NOT NULL,
    "duracion_min" INTEGER NOT NULL,
    "precio_snapshot" DECIMAL(10,2) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "detalle_turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocupacion_bahia" (
    "id" TEXT NOT NULL,
    "bahia_id" TEXT NOT NULL,
    "turno_id" TEXT,
    "tipo" "TipoOcupacion" NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "motivo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocupacion_bahia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_turno" (
    "id" TEXT NOT NULL,
    "turno_id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "agente_ia_id" TEXT,
    "estado_prev" "EstadoTurno",
    "estado_nuevo" "EstadoTurno" NOT NULL,
    "detalle" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operacion_api" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "clave_idempotencia" TEXT NOT NULL,
    "huella_solicitud" TEXT NOT NULL,
    "operacion" TEXT NOT NULL,
    "respuesta" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operacion_api_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agente_ia" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agente_ia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresa_slug_key" ON "empresa"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_empresa_id_email_key" ON "usuario"("empresa_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "taller_servicio_taller_id_servicio_id_key" ON "taller_servicio"("taller_id", "servicio_id");

-- CreateIndex
CREATE UNIQUE INDEX "bahia_servicio_bahia_id_servicio_id_key" ON "bahia_servicio"("bahia_id", "servicio_id");

-- CreateIndex
CREATE UNIQUE INDEX "patron_horario_taller_id_dia_key" ON "patron_horario"("taller_id", "dia");

-- CreateIndex
CREATE UNIQUE INDEX "excepcion_horario_taller_id_fecha_key" ON "excepcion_horario"("taller_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_turnos_empresa_id_key" ON "configuracion_turnos"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehiculo_empresa_id_patente_key" ON "vehiculo"("empresa_id", "patente");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_vehiculo_cliente_id_vehiculo_id_key" ON "cliente_vehiculo"("cliente_id", "vehiculo_id");

-- CreateIndex
CREATE INDEX "turno_empresa_id_inicio_idx" ON "turno"("empresa_id", "inicio");

-- CreateIndex
CREATE INDEX "turno_bahia_id_inicio_idx" ON "turno"("bahia_id", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "ocupacion_bahia_turno_id_key" ON "ocupacion_bahia"("turno_id");

-- CreateIndex
CREATE INDEX "ocupacion_bahia_bahia_id_inicio_fin_idx" ON "ocupacion_bahia"("bahia_id", "inicio", "fin");

-- CreateIndex
CREATE UNIQUE INDEX "operacion_api_empresa_id_clave_idempotencia_key" ON "operacion_api"("empresa_id", "clave_idempotencia");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taller" ADD CONSTRAINT "taller_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bahia" ADD CONSTRAINT "bahia_taller_id_fkey" FOREIGN KEY ("taller_id") REFERENCES "taller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipo_servicio" ADD CONSTRAINT "tipo_servicio_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicio" ADD CONSTRAINT "servicio_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicio" ADD CONSTRAINT "servicio_tipo_servicio_id_fkey" FOREIGN KEY ("tipo_servicio_id") REFERENCES "tipo_servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taller_servicio" ADD CONSTRAINT "taller_servicio_taller_id_fkey" FOREIGN KEY ("taller_id") REFERENCES "taller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taller_servicio" ADD CONSTRAINT "taller_servicio_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bahia_servicio" ADD CONSTRAINT "bahia_servicio_bahia_id_fkey" FOREIGN KEY ("bahia_id") REFERENCES "bahia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bahia_servicio" ADD CONSTRAINT "bahia_servicio_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patron_horario" ADD CONSTRAINT "patron_horario_taller_id_fkey" FOREIGN KEY ("taller_id") REFERENCES "taller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "franja_horaria" ADD CONSTRAINT "franja_horaria_patron_horario_id_fkey" FOREIGN KEY ("patron_horario_id") REFERENCES "patron_horario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excepcion_horario" ADD CONSTRAINT "excepcion_horario_taller_id_fkey" FOREIGN KEY ("taller_id") REFERENCES "taller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracion_turnos" ADD CONSTRAINT "configuracion_turnos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehiculo" ADD CONSTRAINT "vehiculo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_vehiculo" ADD CONSTRAINT "cliente_vehiculo_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_vehiculo" ADD CONSTRAINT "cliente_vehiculo_vehiculo_id_fkey" FOREIGN KEY ("vehiculo_id") REFERENCES "vehiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_cliente" ADD CONSTRAINT "documento_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_taller_id_fkey" FOREIGN KEY ("taller_id") REFERENCES "taller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_bahia_id_fkey" FOREIGN KEY ("bahia_id") REFERENCES "bahia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_vehiculo_id_fkey" FOREIGN KEY ("vehiculo_id") REFERENCES "vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_creador_id_fkey" FOREIGN KEY ("creador_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_agente_ia_id_fkey" FOREIGN KEY ("agente_ia_id") REFERENCES "agente_ia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_turno" ADD CONSTRAINT "detalle_turno_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_turno" ADD CONSTRAINT "detalle_turno_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocupacion_bahia" ADD CONSTRAINT "ocupacion_bahia_bahia_id_fkey" FOREIGN KEY ("bahia_id") REFERENCES "bahia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocupacion_bahia" ADD CONSTRAINT "ocupacion_bahia_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_turno" ADD CONSTRAINT "evento_turno_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_turno" ADD CONSTRAINT "evento_turno_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_turno" ADD CONSTRAINT "evento_turno_agente_ia_id_fkey" FOREIGN KEY ("agente_ia_id") REFERENCES "agente_ia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operacion_api" ADD CONSTRAINT "operacion_api_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agente_ia" ADD CONSTRAINT "agente_ia_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
