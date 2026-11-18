-- 결제 확인 실패·브라우저 바뀜 기록 (api/pay-log.js가 씀). 서버 키로만 읽고 쓴다.
create table if not exists public.payment_failures (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  code text not null,
  message text,
  order_id text,
  device_id text,
  item text,
  stage text,
  extra text,
  had_local_device boolean,
  user_agent text
);
create index if not exists payment_failures_created_at on public.payment_failures (created_at desc);
alter table public.payment_failures enable row level security;

-- 최근 기록 보기:
-- select created_at at time zone 'Asia/Seoul', code, message, order_id, item from payment_failures order by created_at desc limit 50;
