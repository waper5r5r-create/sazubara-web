-- Applied through the Supabase migration admin_users (2026-11-28).
-- Kakao (Supabase Auth) accounts allowed into /admin. api/admin/_gate.js checks the login token against this list.
-- Add the owner with: insert into public.admin_users (user_id, note) values ('<auth user id>', 'owner');
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated, public;
grant select on public.admin_users to service_role;
