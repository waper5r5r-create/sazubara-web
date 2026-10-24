-- 로그인 계정과 기기를 잇는 표: 같은 계정에 묶인 기기끼리 구매 내역을 함께 쓴다.
create table if not exists public.account_devices (
  user_id uuid not null,
  device_id text not null references public.devices(device_id) on delete cascade,
  linked_at timestamptz not null default now(),
  primary key (user_id, device_id)
);
create index if not exists account_devices_device_idx on public.account_devices(device_id);

-- 기기마다 그 기기에만 저장되는 비밀 키의 해시. 기기 ID는 초대 링크로 공개되므로, 계정 연결에는 이 키가 필요하다.
create table if not exists public.device_secrets (
  device_id text primary key references public.devices(device_id) on delete cascade,
  secret_hash text not null,
  created_at timestamptz not null default now()
);

-- 서버(서비스 키)만 읽고 쓴다. 공개 키로는 접근할 수 없도록 RLS만 켜고 정책은 두지 않는다.
alter table public.account_devices enable row level security;
alter table public.device_secrets enable row level security;
