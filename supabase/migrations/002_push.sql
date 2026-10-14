-- =====================================================================
--  BukuKas Pro — Notifikasi Push dari server (Edge Function + pg_cron)
-- =====================================================================

-- Langganan push per perangkat
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  tz text not null default 'Asia/Jakarta',
  ua text,
  created_at timestamptz not null default now(),
  last_ok timestamptz,
  unique (user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
create policy "own_all" on public.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Catatan notifikasi yang sudah terkirim (agar tidak dobel). Hanya server yang mengakses.
create table if not exists public.push_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_id text not null,
  sent_on date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, alert_id, sent_on)
);
alter table public.push_log enable row level security;

-- Konfigurasi rahasia (kunci VAPID, cron secret) dibaca dari Supabase Vault, hanya oleh service_role
create or replace function public.get_push_config()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(name, decrypted_secret), '{}'::jsonb)
  from vault.decrypted_secrets
  where name like 'bukukas_%';
$$;
revoke execute on function public.get_push_config() from public, anon, authenticated;
grant execute on function public.get_push_config() to service_role;

create extension if not exists pg_cron;
create extension if not exists pg_net;
