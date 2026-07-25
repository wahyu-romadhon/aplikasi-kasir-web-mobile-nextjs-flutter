-- ==============================================
-- METODE PEMBAYARAN TOKO (QRIS statis / e-wallet)
-- Pemilik toko upload gambar QRIS; kasir menampilkannya ke pembeli.
-- ==============================================
create table public.store_payment_methods (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  label text not null,                 -- mis. "QRIS Merchant", "GoPay", "DANA"
  image_url text not null,             -- gambar QRIS di Storage
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.store_payment_methods enable row level security;

-- Semua role di toko BOLEH BACA (kasir perlu menampilkan QRIS)
create policy "baca metode bayar toko" on public.store_payment_methods
  for select using (store_id = my_store());

-- Hanya admin/owner yang mengelola (tambah/edit/hapus)
create policy "admin kelola metode bayar" on public.store_payment_methods
  for all using (my_role() in ('owner','admin') and store_id = my_store())
  with check (my_role() in ('owner','admin') and store_id = my_store());
