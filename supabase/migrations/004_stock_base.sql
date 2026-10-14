-- Stok dihitung dari riwayat pergerakan: stok = stock_base + SUM(stock_moves.qty)
-- Penjualan dari beberapa perangkat (termasuk saat offline) tidak saling menimpa.
alter table public.products add column if not exists stock_base numeric;
update public.products p set stock_base = coalesce(p.stock,0) - coalesce((select sum(m.qty) from public.stock_moves m where m.product_id = p.id),0) where p.stock_base is null;
alter table public.products alter column stock_base set default 0;
alter table public.products alter column stock_base set not null;
create index if not exists idx_moves_product on public.stock_moves(product_id);
