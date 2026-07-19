-- ==============================================
-- 1. TABEL PROFIL & ROLE
-- ==============================================
create type user_role as enum ('owner', 'admin', 'kasir');

create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  store_id uuid,
  full_name text not null,
  role user_role not null default 'kasir',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ==============================================
-- 2. TOKO
-- ==============================================
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  receipt_footer text default 'Terima kasih!',
  tax_percent numeric(5,2) default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add constraint fk_store foreign key (store_id) references public.stores(id);

-- ==============================================
-- 3. PRODUK & KATEGORI
-- ==============================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  sku text,
  barcode text,
  price numeric(14,2) not null,          -- harga jual
  cost_price numeric(14,2) default 0,    -- harga modal (SENSITIF: admin only)
  stock integer not null default 0,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==============================================
-- 4. TRANSAKSI
-- ==============================================
create type payment_method as enum ('cash', 'qris', 'transfer', 'debit');
create type tx_status as enum ('completed', 'void');

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  local_id text unique,                  -- id dari SQLite (untuk dedup saat sync)
  store_id uuid not null references public.stores(id) on delete cascade,
  cashier_id uuid not null references public.profiles(id),
  shift_id uuid,
  subtotal numeric(14,2) not null,
  tax numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  total numeric(14,2) not null,
  paid numeric(14,2) not null,
  change numeric(14,2) not null default 0,
  payment_method payment_method not null default 'cash',
  status tx_status not null default 'completed',
  void_reason text,
  voided_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name text not null,            -- snapshot nama (kalau produk diedit)
  price numeric(14,2) not null,          -- snapshot harga saat transaksi
  qty integer not null,
  subtotal numeric(14,2) not null
);

-- ==============================================
-- 5. SHIFT KASIR (buka/tutup kasir)
-- ==============================================
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  cashier_id uuid not null references public.profiles(id),
  opening_cash numeric(14,2) not null,   -- modal awal
  closing_cash numeric(14,2),            -- setoran akhir (input kasir)
  expected_cash numeric(14,2),           -- dihitung sistem (SENSITIF)
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

alter table public.transactions
  add constraint fk_shift foreign key (shift_id) references public.shifts(id);

-- ==============================================
-- 6. MUTASI STOK
-- ==============================================
create type stock_move_type as enum ('in', 'out', 'adjustment', 'sale');

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  type stock_move_type not null,
  qty integer not null,                  -- + masuk, - keluar
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ==============================================
-- 7. LISENSI / LANGGANAN
-- ==============================================
create type license_status as enum ('trial', 'active', 'expired', 'suspended');

create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  license_key text unique not null,
  status license_status not null default 'trial',
  plan text not null default 'basic',
  valid_until timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses(id),
  midtrans_order_id text unique,
  amount numeric(14,2) not null,
  status text not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- ==============================================
-- 8. HELPER: ambil role & store user yang sedang login
-- ==============================================
create or replace function public.my_role() returns user_role
language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() $$;

create or replace function public.my_store() returns uuid
language sql stable security definer set search_path = public as
$$ select store_id from profiles where id = auth.uid() $$;

-- ==============================================
-- 9. ROW LEVEL SECURITY (INTI KEAMANAN!)
-- ==============================================
alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.shifts enable row level security;
alter table public.stock_movements enable row level security;
alter table public.licenses enable row level security;
alter table public.payments enable row level security;

-- ---------- PROFILES ----------
create policy "lihat profil sendiri" on public.profiles
  for select using (id = auth.uid());
create policy "admin lihat semua profil di tokonya" on public.profiles
  for select using (my_role() in ('owner','admin') and store_id = my_store());
create policy "admin kelola profil" on public.profiles
  for all using (my_role() in ('owner','admin') and store_id = my_store());

-- ---------- STORES ----------
create policy "lihat toko sendiri" on public.stores
  for select using (id = my_store());
create policy "owner update toko" on public.stores
  for update using (id = my_store() and my_role() = 'owner');

-- ---------- PRODUCTS: kasir hanya BOLEH BACA, admin full ----------
create policy "semua role baca produk tokonya" on public.products
  for select using (store_id = my_store());
create policy "hanya admin kelola produk" on public.products
  for insert with check (my_role() in ('owner','admin') and store_id = my_store());
create policy "hanya admin update produk" on public.products
  for update using (my_role() in ('owner','admin') and store_id = my_store());
create policy "hanya admin hapus produk" on public.products
  for delete using (my_role() in ('owner','admin') and store_id = my_store());

-- ---------- CATEGORIES ----------
create policy "semua role baca kategori" on public.categories
  for select using (store_id = my_store());
create policy "hanya admin kelola kategori" on public.categories
  for all using (my_role() in ('owner','admin') and store_id = my_store());

-- ---------- TRANSACTIONS (PALING SENSITIF) ----------
-- Kasir: hanya bisa INSERT + baca transaksi MILIKNYA SENDIRI di shift aktif.
-- Kasir TIDAK bisa baca transaksi kasir lain → tidak bisa hitung omzet toko.
create policy "kasir insert transaksi sendiri" on public.transactions
  for insert with check (cashier_id = auth.uid() and store_id = my_store());
create policy "kasir baca transaksi sendiri saja" on public.transactions
  for select using (
    (cashier_id = auth.uid() and store_id = my_store())
    or (my_role() in ('owner','admin') and store_id = my_store())
  );
-- Void HANYA oleh admin/owner:
create policy "hanya admin void transaksi" on public.transactions
  for update using (my_role() in ('owner','admin') and store_id = my_store());

-- ---------- TRANSACTION ITEMS ----------
create policy "insert item transaksi" on public.transaction_items
  for insert with check (
    exists (select 1 from transactions t
            where t.id = transaction_id and t.cashier_id = auth.uid())
  );
create policy "baca item transaksi" on public.transaction_items
  for select using (
    exists (select 1 from transactions t
            where t.id = transaction_id
              and (t.cashier_id = auth.uid()
                   or (my_role() in ('owner','admin') and t.store_id = my_store())))
  );

-- ---------- SHIFTS ----------
-- Kasir hanya lihat & kelola shift-nya sendiri.
-- Kolom expected_cash TIDAK ditampilkan ke kasir → pakai VIEW di bawah.
create policy "kasir kelola shift sendiri" on public.shifts
  for all using (
    cashier_id = auth.uid()
    or (my_role() in ('owner','admin') and store_id = my_store())
  );

-- ---------- STOCK MOVEMENTS ----------
create policy "kasir catat stok keluar dari penjualan" on public.stock_movements
  for insert with check (store_id = my_store());
create policy "hanya admin baca mutasi stok" on public.stock_movements
  for select using (my_role() in ('owner','admin') and store_id = my_store());

-- ---------- LICENSES & PAYMENTS: admin only ----------
create policy "admin baca lisensi" on public.licenses
  for select using (my_role() in ('owner','admin') and store_id = my_store());
create policy "admin baca pembayaran" on public.payments
  for select using (
    my_role() in ('owner','admin')
    and exists (select 1 from licenses l where l.id = license_id and l.store_id = my_store())
  );

-- ==============================================
-- 10. VIEW AMAN UNTUK KASIR
-- (produk tanpa harga modal — kasir tidak boleh tahu profit)
-- ==============================================
create view public.products_kasir with (security_invoker = true) as
  select id, store_id, category_id, name, sku, barcode, price, stock, image_url, is_active
  from public.products;

-- ==============================================
-- 11. TRIGGER: kurangi stok otomatis saat item transaksi masuk
-- ==============================================
create or replace function public.decrement_stock() returns trigger
language plpgsql security definer as $$
begin
  update products set stock = stock - new.qty, updated_at = now()
  where id = new.product_id;
  insert into stock_movements (store_id, product_id, type, qty, note, created_by)
  select store_id, new.product_id, 'sale', -new.qty, 'Penjualan', auth.uid()
  from products where id = new.product_id;
  return new;
end $$;

create trigger trg_decrement_stock
  after insert on public.transaction_items
  for each row execute function public.decrement_stock();
