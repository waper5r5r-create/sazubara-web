-- Applied through the Supabase migration verified_story_reader_reviews.
create table if not exists public.report_reviews (id uuid primary key default gen_random_uuid(), concept_id text not null references public.report_concepts(id) on delete cascade, reviewer_hash text not null, text text not null check (char_length(text) between 10 and 500), created_at timestamptz not null default now(), unique (concept_id, reviewer_hash));
alter table public.report_reviews enable row level security;
revoke all on public.report_reviews from anon, authenticated, public;
grant select, insert on public.report_reviews to service_role;
create index if not exists report_reviews_recent_idx on public.report_reviews (concept_id, created_at desc);
