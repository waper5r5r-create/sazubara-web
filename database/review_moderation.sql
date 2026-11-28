-- Applied through the Supabase migration review_ratings_and_moderation (2026-11-28).
-- Reviews now cover every paid product (not only report_concepts rows), carry a 1-5 rating,
-- and can be hidden or answered by the admin. Review text itself is never edited by the admin.
alter table public.report_reviews drop constraint if exists report_reviews_concept_id_fkey;
alter table public.report_reviews
  add column if not exists rating smallint not null check (rating between 1 and 5),
  add column if not exists status text not null default 'visible' check (status in ('visible','hidden')),
  add column if not exists hidden_reason text,
  add column if not exists hidden_at timestamptz,
  add column if not exists reply text check (reply is null or char_length(reply) between 1 and 500),
  add column if not exists replied_at timestamptz;
grant update, delete on public.report_reviews to service_role;
create index if not exists report_reviews_visible_idx on public.report_reviews (concept_id, status, created_at desc);

-- Every hide, unhide and delete is logged with its reason. No review text is kept here,
-- so deleting a review for personal information really removes it.
create table if not exists public.review_moderation_log (
  id bigint generated always as identity primary key,
  review_id uuid not null,
  concept_id text not null,
  rating smallint,
  action text not null check (action in ('hide','unhide','delete','reply')),
  reason text,
  created_at timestamptz not null default now()
);
alter table public.review_moderation_log enable row level security;
revoke all on public.review_moderation_log from anon, authenticated, public;
grant select, insert on public.review_moderation_log to service_role;
