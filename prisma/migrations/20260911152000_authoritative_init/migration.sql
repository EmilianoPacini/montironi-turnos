-- 001_authoritative_init.sql — Montironi Turnos (data architect DDL + block patch)

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Enums (authoritative names)
CREATE TYPE estado_turno AS ENUM (
  'pendiente','confirmado','recibido','en_servicio','finalizado','cancelado','ausente','vencido'
);
CREATE TYPE estado_calendario AS ENUM ('disponible','bloqueado','cerrado');
CREATE TYPE rol_usuario AS ENUM ('admin','operador','asesor','empleado');
CREATE TYPE canal_turno AS ENUM ('web','telefono','whatsapp','interno','agente_ia');
CREATE TYPE tipo_ocupacion AS ENUM ('turno','bloqueo');
CREATE TYPE dia_semana AS ENUM ('lunes','martes','miercoles','jueves','viernes','sabado','domingo');
CREATE TYPE tipo_excepcion AS ENUM ('cerrado','horario_especial');
CREATE TYPE modo_precio AS ENUM ('fijo','desde','a_presupuestar');

-- empresa
CREATE TABLE empresa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- usuario
CREATE TABLE usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  rol rol_usuario NOT NULL DEFAULT 'empleado',
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, email)
);

-- taller
CREATE TABLE taller (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  direccion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- bahia
CREATE TABLE bahia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taller_id UUID NOT NULL REFERENCES taller(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  orden INT NOT NULL DEFAULT 0,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- tipo_servicio
CREATE TABLE tipo_servicio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- servicio
CREATE TABLE servicio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  tipo_servicio_id UUID NOT NULL REFERENCES tipo_servicio(id) ON DELETE RESTRICT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  duracion_min INT NOT NULL,
  precio NUMERIC(10,2) NOT NULL,
  modo_precio modo_precio NOT NULL DEFAULT 'fijo',
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- taller_servicio
CREATE TABLE taller_servicio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taller_id UUID NOT NULL REFERENCES taller(id) ON DELETE CASCADE,
  servicio_id UUID NOT NULL REFERENCES servicio(id) ON DELETE CASCADE,
  activo BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (taller_id, servicio_id)
);

-- bahia_servicio
CREATE TABLE bahia_servicio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bahia_id UUID NOT NULL REFERENCES bahia(id) ON DELETE CASCADE,
  servicio_id UUID NOT NULL REFERENCES servicio(id) ON DELETE CASCADE,
  activo BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (bahia_id, servicio_id)
);

-- patron_horario
CREATE TABLE patron_horario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taller_id UUID NOT NULL REFERENCES taller(id) ON DELETE CASCADE,
  dia dia_semana NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (taller_id, dia)
);

-- franja_horaria
CREATE TABLE franja_horaria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patron_horario_id UUID NOT NULL REFERENCES patron_horario(id) ON DELETE CASCADE,
  hora_inicio TEXT NOT NULL,
  hora_fin TEXT NOT NULL
);

-- excepcion_horario
CREATE TABLE excepcion_horario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taller_id UUID NOT NULL REFERENCES taller(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  tipo tipo_excepcion NOT NULL,
  hora_inicio TEXT,
  hora_fin TEXT,
  motivo TEXT,
  UNIQUE (taller_id, fecha)
);

-- configuracion_turnos (per taller)
CREATE TABLE configuracion_turnos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taller_id UUID NOT NULL UNIQUE REFERENCES taller(id) ON DELETE CASCADE,
  margen_minutos INT NOT NULL DEFAULT 15
);

-- cliente
CREATE TABLE cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  apellido TEXT,
  email TEXT,
  telefono TEXT,
  documento TEXT,
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- vehiculo
CREATE TABLE vehiculo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  patente TEXT NOT NULL,
  marca TEXT,
  modelo TEXT,
  anio INT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, patente)
);

-- cliente_vehiculo
CREATE TABLE cliente_vehiculo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES cliente(id) ON DELETE CASCADE,
  vehiculo_id UUID NOT NULL REFERENCES vehiculo(id) ON DELETE CASCADE,
  es_principal BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (cliente_id, vehiculo_id)
);

-- documento_cliente
CREATE TABLE documento_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES cliente(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  url TEXT,
  tipo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- turno
CREATE TABLE turno (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  taller_id UUID NOT NULL REFERENCES taller(id) ON DELETE RESTRICT,
  bahia_id UUID NOT NULL REFERENCES bahia(id) ON DELETE RESTRICT,
  cliente_id UUID NOT NULL REFERENCES cliente(id) ON DELETE RESTRICT,
  vehiculo_id UUID NOT NULL REFERENCES vehiculo(id) ON DELETE RESTRICT,
  creador_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
  estado estado_turno NOT NULL DEFAULT 'pendiente',
  canal canal_turno NOT NULL DEFAULT 'interno',
  inicio TIMESTAMPTZ NOT NULL,
  finaliza_en TIMESTAMPTZ NOT NULL,
  notas TEXT,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX turno_empresa_id_inicio_idx ON turno (empresa_id, inicio);
CREATE INDEX turno_bahia_id_inicio_idx ON turno (bahia_id, inicio);

-- detalle_turno (snapshots at booking)
CREATE TABLE detalle_turno (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id UUID NOT NULL REFERENCES turno(id) ON DELETE CASCADE,
  servicio_id UUID NOT NULL REFERENCES servicio(id) ON DELETE RESTRICT,
  nombre_snapshot TEXT NOT NULL,
  duracion_min INT NOT NULL,
  precio_snapshot NUMERIC(10,2) NOT NULL,
  modo_precio_snapshot modo_precio NOT NULL DEFAULT 'fijo',
  orden INT NOT NULL DEFAULT 0
);

-- ocupacion_bahia (authoritative + block patch)
CREATE TABLE ocupacion_bahia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bahia_id UUID NOT NULL REFERENCES bahia(id) ON DELETE CASCADE,
  turno_id UUID REFERENCES turno(id) ON DELETE RESTRICT,
  tipo tipo_ocupacion NOT NULL,
  motivo TEXT,
  creado_por_usuario_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
  inicio TIMESTAMPTZ NOT NULL,
  fin TIMESTAMPTZ NOT NULL,
  periodo TSTZRANGE GENERATED ALWAYS AS (tstzrange(inicio, fin, '[)')) STORED,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ocupacion_bahia_tipo_turno_chk CHECK (
    (tipo = 'turno' AND turno_id IS NOT NULL) OR (tipo = 'bloqueo' AND turno_id IS NULL)
  ),
  CONSTRAINT ocupacion_bahia_bloqueo_motivo_chk CHECK (
    tipo <> 'bloqueo' OR (motivo IS NOT NULL AND btrim(motivo) <> '')
  )
);

CREATE INDEX ocupacion_bahia_bahia_id_inicio_fin_idx ON ocupacion_bahia (bahia_id, inicio, fin);

ALTER TABLE ocupacion_bahia
  ADD CONSTRAINT ocupacion_bahia_no_overlap
  EXCLUDE USING gist (bahia_id WITH =, periodo WITH &&)
  WHERE (activo);

-- evento_turno
CREATE TABLE evento_turno (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id UUID NOT NULL REFERENCES turno(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
  estado_prev estado_turno,
  estado_nuevo estado_turno NOT NULL,
  detalle TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- operacion_api
CREATE TABLE operacion_api (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  operacion TEXT NOT NULL,
  respuesta JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, idempotency_key)
);
