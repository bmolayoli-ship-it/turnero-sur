-- Ejecutar esto en Supabase > SQL Editor

create table if not exists profesionales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  especialidad text default 'Kinesiología',
  activo boolean default true,
  created_at timestamp with time zone default now()
);

create table if not exists pacientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  dni text,
  telefono text,
  obra_social text,
  lesion text,
  notas text,
  created_at timestamp with time zone default now()
);

create table if not exists turnos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  hora text not null,
  bloque text,
  profesional_id uuid,
  profesional text,
  paciente_id uuid,
  paciente text not null,
  dni text,
  telefono text,
  obra_social text,
  lesion text,
  notas text,
  estado text default 'Confirmado',
  color text default 'teal',
  created_at timestamp with time zone default now()
);

create table if not exists configuracion (
  id text primary key,
  data jsonb not null,
  updated_at timestamp with time zone default now()
);

insert into profesionales (nombre, especialidad)
select 'Lic. Cecilia', 'Kinesiología'
where not exists (select 1 from profesionales where nombre = 'Lic. Cecilia');

-- Para uso simple, activar RLS y políticas según necesidad.
-- Para prueba rápida privada, se puede dejar RLS desactivado desde Table Editor.
