-- =====================================================================
--  BukuKas Pro — Skema Database Supabase
--  Jalankan seluruh file ini di: Supabase Dashboard → SQL Editor → New query → Run
--  Aman dijalankan ulang (memakai IF NOT EXISTS / DROP POLICY IF EXISTS).
--  Setiap pengguna hanya bisa melihat & mengubah datanya sendiri (Row Level Security).
-- =====================================================================


-- ---------- USAHA ----------
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'umum',
  currency text not null default 'IDR',
  address text,
  phone text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- AKUN / DOMPET (Kas, Bank, E-Wallet) ----------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  type text not null default 'kas',
  opening_balance numeric not null default 0,
  color text,
  created_at timestamptz not null default now()
);

-- ---------- KATEGORI ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  type text not null check (type in ('in','out')),
  icon text,
  color text,
  created_at timestamptz not null default now()
);

-- ---------- KONTAK (pelanggan / supplier) ----------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  type text not null default 'pelanggan',
  phone text,
  address text,
  note text,
  created_at timestamptz not null default now()
);

-- ---------- PRODUK / STOK ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  sku text,
  group_name text,
  unit text default 'pcs',
  buy_price numeric not null default 0,
  sell_price numeric not null default 0,
  stock numeric not null default 0,
  min_stock numeric not null default 0,
  track_stock boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_moves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  date date not null default current_date,
  qty numeric not null,
  kind text not null default 'adjust',   -- in | out | sale | adjust
  note text,
  transaction_id uuid,
  created_at timestamptz not null default now()
);

-- ---------- HUTANG & PIUTANG ----------
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('hutang','piutang')),
  contact_id uuid references public.contacts(id) on delete set null,
  contact_name text,
  amount numeric not null default 0,
  paid numeric not null default 0,
  date date not null default current_date,
  due_date date,
  category_id uuid references public.categories(id) on delete set null,
  source text default 'manual',          -- manual | sale | purchase
  note text,
  created_at timestamptz not null default now()
);

-- ---------- TRANSAKSI ----------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  date date not null default current_date,
  type text not null check (type in ('in','out','transfer')),
  amount numeric not null default 0,
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  to_account_id uuid references public.accounts(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  debt_id uuid references public.debts(id) on delete set null,
  ref text,                              -- sale | purchase | debt | null
  items jsonb,                           -- rincian barang untuk penjualan/pembelian
  cost numeric default 0,                -- HPP (modal barang terjual)
  note text,
  created_at timestamptz not null default now()
);

-- ---------- CATATAN HARIAN / PRODUKSI ----------
create table if not exists public.production_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  date date not null default current_date,
  vals jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

-- ---------- ANGGARAN BULANAN ----------
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  amount numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- INDEX ----------
create index if not exists idx_tx_biz_date on public.transactions(business_id, date desc);
create index if not exists idx_logs_biz_date on public.production_logs(business_id, date desc);
create index if not exists idx_moves_biz on public.stock_moves(business_id, date desc);
create index if not exists idx_debts_biz on public.debts(business_id);
create index if not exists idx_prod_biz on public.products(business_id);

-- ---------- ROW LEVEL SECURITY ----------
alter table public.businesses enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.contacts enable row level security;
alter table public.products enable row level security;
alter table public.stock_moves enable row level security;
alter table public.debts enable row level security;
alter table public.transactions enable row level security;
alter table public.production_logs enable row level security;
alter table public.budgets enable row level security;
create policy "own_all" on public.businesses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_all" on public.accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_all" on public.categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_all" on public.contacts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_all" on public.products for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_all" on public.stock_moves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_all" on public.debts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_all" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_all" on public.production_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_all" on public.budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
