-- Applied through the Supabase migration admin_auth_failures (2026-11-28).
-- Wrong admin passwords, by one-way IP hash. api/admin/_gate.js locks a connection after 5 in 15 minutes,
-- and everyone after 30 in 15 minutes.
create table if not exists public.admin_auth_failures (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists admin_auth_failures_recent_idx on public.admin_auth_failures (ip_hash, created_at desc);
alter table public.admin_auth_failures enable row level security;
revoke all on public.admin_auth_failures from anon, authenticated, public;
grant select, insert, delete on public.admin_auth_failures to service_role;
