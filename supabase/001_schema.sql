-- THE COACH — esquema del servidor compartido.
-- Los datos de la app se guardan como documentos JSON por colección. Nadie accede a las tablas
-- directamente (RLS sin políticas): todo pasa por funciones RPC que comprueban sesión y permisos.
create extension if not exists pgcrypto with schema extensions;

create sequence if not exists tc_rev_seq;

create table if not exists tc_docs (
  coll text not null,
  id text not null,
  comp_id text,
  team_id text,
  data jsonb not null default '{}'::jsonb,
  rev bigint not null default nextval('tc_rev_seq'),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (coll, id)
);
create index if not exists tc_docs_rev on tc_docs (rev);
create index if not exists tc_docs_comp on tc_docs (comp_id);
create index if not exists tc_docs_team on tc_docs (team_id);
create index if not exists tc_docs_email on tc_docs ((lower(data->>'email'))) where coll = 'users';
create index if not exists tc_docs_coach on tc_docs ((data->>'coachId')) where coll = 'teams';

create table if not exists tc_secrets (
  user_id text primary key,
  hash text not null,
  fails int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists tc_sessions (
  token text primary key,
  user_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists tc_sessions_user on tc_sessions (user_id);
create table if not exists tc_config (key text primary key, value text);

alter table tc_docs enable row level security;
alter table tc_secrets enable row level security;
alter table tc_sessions enable row level security;
alter table tc_config enable row level security;
revoke all on tc_docs, tc_secrets, tc_sessions, tc_config from anon, authenticated;
