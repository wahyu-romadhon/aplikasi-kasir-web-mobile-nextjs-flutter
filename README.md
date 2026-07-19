# 🧾 KasirKu — Aplikasi Kasir (POS) Full-Stack

Aplikasi kasir (Point of Sale) modern dengan arsitektur **offline-first**, terdiri dari:

| Komponen | Teknologi | Untuk Siapa | Fungsi Utama |
|---|---|---|---|
| **App Kasir (Mobile)** | Flutter + SQLite | Pelayan / Kasir | Transaksi harian, cetak struk, cek stok (read-only) |
| **Dashboard Admin (Web)** | Next.js 14 (App Router) | Owner / Admin | Laporan omzet, kelola produk & stok, kelola user, lisensi |
| **Backend** | Supabase (PostgreSQL + Auth + RLS) | — | Database pusat, autentikasi, keamanan role |
| **Custom Logic API** | Next.js API Routes | — | Validasi lisensi, webhook pembayaran (Midtrans), export laporan |

> ⚠️ **Prinsip keamanan utama**: Kasir **TIDAK BOLEH** melihat total uang masuk, omzet, laporan penjualan, profit, atau data kasir lain. Aturan ini di-enforce di **level database (RLS)**, bukan cuma disembunyikan di UI.

---

## 📁 Struktur Monorepo

Semua ada dalam **satu folder root** seperti yang direncanakan:

```
kasirku/
├── README.md                  ← file ini
├── .gitignore
│
├── apps/
│   ├── kasir-mobile/          ← Flutter (app kasir untuk pelayan)
│   │   ├── lib/
│   │   │   ├── main.dart
│   │   │   ├── core/
│   │   │   │   ├── constants/
│   │   │   │   │   ├── app_colors.dart        ← design system: warna
│   │   │   │   │   ├── app_typography.dart    ← design system: font
│   │   │   │   │   └── app_spacing.dart       ← design system: jarak
│   │   │   │   ├── database/
│   │   │   │   │   ├── local_db.dart          ← SQLite setup
│   │   │   │   │   └── sync_service.dart      ← sinkronisasi SQLite ↔ Supabase
│   │   │   │   ├── supabase/
│   │   │   │   │   └── supabase_client.dart
│   │   │   │   └── license/
│   │   │   │       └── license_service.dart   ← cek lisensi ke Next.js API
│   │   │   ├── features/
│   │   │   │   ├── auth/          ← login kasir
│   │   │   │   ├── pos/           ← layar transaksi utama
│   │   │   │   ├── receipt/       ← cetak struk (bluetooth thermal)
│   │   │   │   ├── stock/         ← cek stok (READ ONLY)
│   │   │   │   ├── history/       ← riwayat transaksi (device ini, hari ini)
│   │   │   │   └── shift/         ← buka/tutup kasir (modal awal, setor)
│   │   │   └── shared/
│   │   │       └── widgets/       ← komponen UI reusable
│   │   ├── pubspec.yaml
│   │   └── .env                   ← JANGAN di-commit
│   │
│   └── admin-web/                 ← Next.js (dashboard admin/owner)
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/login/page.tsx
│       │   │   ├── (dashboard)/
│       │   │   │   ├── page.tsx               ← overview omzet
│       │   │   │   ├── products/page.tsx      ← kelola produk
│       │   │   │   ├── stock/page.tsx         ← kelola stok
│       │   │   │   ├── reports/page.tsx       ← laporan penjualan
│       │   │   │   ├── users/page.tsx         ← kelola kasir & role
│       │   │   │   └── settings/page.tsx      ← pengaturan toko & langganan
│       │   │   ├── api/
│       │   │   │   ├── license/verify/route.ts    ← dipanggil Flutter
│       │   │   │   ├── webhooks/midtrans/route.ts ← callback pembayaran
│       │   │   │   └── reports/export/route.ts    ← export PDF/Excel
│       │   │   ├── layout.tsx
│       │   │   └── globals.css    ← design system (CSS variables)
│       │   ├── components/ui/     ← komponen (shadcn/ui)
│       │   ├── lib/
│       │   │   ├── supabase/
│       │   │   │   ├── client.ts  ← browser client
│       │   │   │   ├── server.ts  ← server client
│       │   │   │   └── admin.ts   ← service-role client (API routes saja!)
│       │   │   └── utils.ts
│       │   └── middleware.ts      ← proteksi route dashboard
│       ├── package.json
│       ├── tailwind.config.ts
│       └── .env.local             ← JANGAN di-commit
│
└── supabase/
    ├── migrations/
    │   └── 00001_initial_schema.sql   ← skema tabel + RLS (lihat bawah)
    └── seed.sql                       ← data contoh untuk development
```

---

## 🏗️ Arsitektur Sistem

```
┌──────────────────┐                    ┌──────────────────────┐
│  Flutter (Kasir)  │                    │  Next.js (Admin Web)  │
│                   │                    │                       │
│  SQLite (lokal)   │                    │                       │
│   │ offline-first │                    │                       │
│   ▼               │                    │                       │
│  SyncService ─────┼──── langsung ────► │                       │
└───────┬───────────┘        │          └───────────┬───────────┘
        │                    ▼                      │
        │            ┌──────────────┐               │
        │            │   SUPABASE    │ ◄────────────┘
        │            │  - PostgreSQL │      (langsung, SDK)
        │            │  - Auth       │
        │            │  - RLS        │ ◄─────────────┐
        │            └──────────────┘                │
        │                                            │
        │  (logic sensitif saja)          ┌──────────┴──────────┐
        └───────────────────────────────► │  Next.js API Routes  │
              /api/license/verify         │  - Validasi lisensi   │
                                          │  - Webhook Midtrans   │
                                          │  - Export laporan     │
                                          └──────────────────────┘
```

**Aturan alur data:**
1. **Data operasional** (produk, transaksi, stok, auth) → Flutter & Next.js connect **langsung ke Supabase** via SDK, dilindungi RLS.
2. **Logic sensitif** (lisensi, pembayaran) → lewat **Next.js API Routes** (pakai service-role key yang tidak pernah ada di device user).
3. **Offline-first**: transaksi disimpan ke **SQLite dulu** (instan, tanpa internet), lalu di-sync ke Supabase saat online.

---

## ✅ Prasyarat (Install Dulu)

| Tool | Versi Minimal | Cek Dengan |
|---|---|---|
| Flutter SDK | 3.19+ | `flutter --version` |
| Node.js | 18+ (disarankan 20 LTS) | `node -v` |
| npm / pnpm | terbaru | `npm -v` |
| Git | terbaru | `git --version` |
| Android Studio / emulator | terbaru | untuk run app kasir |
| Akun Supabase | gratis | https://supabase.com |
| VS Code + ekstensi Flutter & Dart | — | — |

---

## 🚀 Setup Langkah demi Langkah

### LANGKAH 1 — Clone / Buat Struktur Folder

```bash
mkdir kasirku && cd kasirku
mkdir -p apps supabase/migrations
```

Buat project Flutter & Next.js:

```bash
# Flutter
cd apps
flutter create kasir_mobile --org com.kasirku --project-name kasir_mobile
mv kasir_mobile kasir-mobile

# Next.js (jawab: TypeScript=Yes, ESLint=Yes, Tailwind=Yes, App Router=Yes, src/=Yes)
npx create-next-app@latest admin-web
cd ..
```

---

### LANGKAH 2 — Setup Supabase (Backend)

1. Buka https://supabase.com → **New Project** → beri nama `kasirku` → catat **Database Password**.
2. Setelah project jadi, buka **Project Settings → API**, catat:
   - `Project URL` → misal `https://xxxx.supabase.co`
   - `anon public` key → untuk Flutter & Next.js client
   - `service_role` key → **HANYA** untuk Next.js API routes (JANGAN pernah taruh di Flutter/browser!)
3. Buka **SQL Editor** → jalankan seluruh skema di bawah ini:

#### 📄 `supabase/migrations/00001_initial_schema.sql`

```sql
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
```

4. Buka **Authentication → Providers** → pastikan **Email** aktif.
5. Buat user pertama (owner) via **Authentication → Users → Add user**, lalu di SQL Editor:

```sql
-- Buat toko + jadikan user pertama sebagai owner
insert into stores (name) values ('Toko Saya') returning id;
-- salin id toko dari hasil di atas, lalu:
insert into profiles (id, store_id, full_name, role)
values ('<USER_ID_DARI_AUTH>', '<STORE_ID>', 'Nama Owner', 'owner');
-- buat lisensi trial 14 hari:
insert into licenses (store_id, license_key, status, valid_until)
values ('<STORE_ID>', 'TRIAL-' || substr(gen_random_uuid()::text,1,8), 'trial', now() + interval '14 days');
```

---

### LANGKAH 3 — Setup Next.js Admin Dashboard

```bash
cd apps/admin-web
npm install @supabase/supabase-js @supabase/ssr
npm install recharts date-fns lucide-react
npx shadcn@latest init         # pilih default
npx shadcn@latest add button card table input dialog select badge tabs
```

#### 📄 `apps/admin-web/.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...anon...
SUPABASE_SERVICE_ROLE_KEY=eyJ...service_role...   # RAHASIA! server-only
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxx            # nanti saat integrasi bayar
LICENSE_SIGNING_SECRET=ganti-dengan-string-acak-panjang
```

#### 📄 `src/lib/supabase/client.ts` (browser)

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

#### 📄 `src/lib/supabase/server.ts` (server components)

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );
}
```

#### 📄 `src/lib/supabase/admin.ts` (⚠️ API routes ONLY)

```ts
import { createClient } from "@supabase/supabase-js";

// Bypass RLS — JANGAN PERNAH import ini di komponen client!
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

#### 📄 `src/middleware.ts` (proteksi dashboard + cek role)

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value }) => res.cookies.set(name, value)),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isDashboard = !req.nextUrl.pathname.startsWith("/login")
    && !req.nextUrl.pathname.startsWith("/api");

  if (!user && isDashboard) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (user && isDashboard) {
    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    // Dashboard admin HANYA untuk owner/admin — kasir ditolak:
    if (!profile || !["owner", "admin"].includes(profile.role)) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/login?error=forbidden", req.url));
    }
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

#### 📄 `src/app/api/license/verify/route.ts` (dipanggil Flutter)

```ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import crypto from "crypto";

export async function POST(req: Request) {
  const { license_key, device_id } = await req.json();
  if (!license_key) {
    return NextResponse.json({ valid: false, reason: "missing_key" }, { status: 400 });
  }

  const { data: lic } = await supabaseAdmin
    .from("licenses")
    .select("status, valid_until, plan, store_id")
    .eq("license_key", license_key)
    .single();

  if (!lic) return NextResponse.json({ valid: false, reason: "not_found" });

  const expired = new Date(lic.valid_until) < new Date();
  const valid = ["trial", "active"].includes(lic.status) && !expired;

  // Signature agar Flutter bisa verifikasi respons tidak dipalsukan
  const payload = `${license_key}:${device_id}:${lic.valid_until}:${valid}`;
  const signature = crypto
    .createHmac("sha256", process.env.LICENSE_SIGNING_SECRET!)
    .update(payload)
    .digest("hex");

  return NextResponse.json({
    valid,
    status: expired ? "expired" : lic.status,
    plan: lic.plan,
    valid_until: lic.valid_until,
    signature,
  });
}
```

#### 📄 `src/app/api/webhooks/midtrans/route.ts` (skeleton)

```ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import crypto from "crypto";

export async function POST(req: Request) {
  const body = await req.json();
  const { order_id, status_code, gross_amount, signature_key, transaction_status } = body;

  // Verifikasi signature Midtrans (WAJIB — jangan percaya webhook mentah)
  const expected = crypto.createHash("sha512")
    .update(order_id + status_code + gross_amount + process.env.MIDTRANS_SERVER_KEY!)
    .digest("hex");
  if (expected !== signature_key) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  }

  if (["settlement", "capture"].includes(transaction_status)) {
    const { data: pay } = await supabaseAdmin
      .from("payments")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("midtrans_order_id", order_id)
      .select("license_id").single();

    if (pay) {
      await supabaseAdmin.from("licenses")
        .update({
          status: "active",
          valid_until: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        })
        .eq("id", pay.license_id);
    }
  }
  return NextResponse.json({ ok: true });
}
```

Jalankan:

```bash
npm run dev
# buka http://localhost:3000
```

---

### LANGKAH 4 — Setup Flutter (App Kasir)

#### 📄 `apps/kasir-mobile/pubspec.yaml` — tambahkan dependencies:

```yaml
dependencies:
  flutter:
    sdk: flutter
  supabase_flutter: ^2.5.0
  sqflite: ^2.3.0
  path: ^1.9.0
  path_provider: ^2.1.0
  flutter_dotenv: ^5.1.0
  connectivity_plus: ^6.0.0
  uuid: ^4.4.0
  intl: ^0.19.0
  crypto: ^3.0.3
  # Cetak struk thermal bluetooth:
  esc_pos_utils_plus: ^2.0.3
  print_bluetooth_thermal: ^1.1.0
  # State management (pilih salah satu, contoh pakai riverpod):
  flutter_riverpod: ^2.5.0

flutter:
  assets:
    - .env
```

```bash
cd apps/kasir-mobile
flutter pub get
```

#### 📄 `apps/kasir-mobile/.env`

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...anon...
LICENSE_API_URL=http://10.0.2.2:3000/api/license/verify
# 10.0.2.2 = localhost dari dalam emulator Android.
# Saat production ganti dengan domain Next.js kamu, mis: https://admin.kasirku.com/api/license/verify
```

#### 📄 `lib/main.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/constants/app_colors.dart';
import 'core/constants/app_typography.dart';
import 'features/auth/login_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: ".env");
  await Supabase.initialize(
    url: dotenv.env['SUPABASE_URL']!,
    anonKey: dotenv.env['SUPABASE_ANON_KEY']!,
  );
  runApp(const ProviderScope(child: KasirApp()));
}

class KasirApp extends StatelessWidget {
  const KasirApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'KasirKu',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: const LoginScreen(),
    );
  }
}
```

#### 📄 `lib/core/database/local_db.dart` (SQLite — offline first)

```dart
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class LocalDb {
  static Database? _db;

  static Future<Database> get instance async {
    if (_db != null) return _db!;
    final path = join(await getDatabasesPath(), 'kasirku.db');
    _db = await openDatabase(path, version: 1, onCreate: _createTables);
    return _db!;
  }

  static Future<void> _createTables(Database db, int version) async {
    // Cache produk (dari view products_kasir — TANPA cost_price)
    await db.execute('''
      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT, barcode TEXT,
        price REAL NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        category_id TEXT, image_url TEXT,
        is_active INTEGER NOT NULL DEFAULT 1
      )
    ''');
    // Transaksi lokal — antrean sync
    await db.execute('''
      CREATE TABLE transactions (
        local_id TEXT PRIMARY KEY,
        shift_id TEXT,
        subtotal REAL NOT NULL,
        tax REAL NOT NULL DEFAULT 0,
        discount REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL,
        paid REAL NOT NULL,
        change REAL NOT NULL DEFAULT 0,
        payment_method TEXT NOT NULL DEFAULT 'cash',
        created_at TEXT NOT NULL,
        is_synced INTEGER NOT NULL DEFAULT 0
      )
    ''');
    await db.execute('''
      CREATE TABLE transaction_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        local_tx_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        price REAL NOT NULL,
        qty INTEGER NOT NULL,
        subtotal REAL NOT NULL
      )
    ''');
  }
}
```

#### 📄 `lib/core/database/sync_service.dart` (SQLite → Supabase)

```dart
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'local_db.dart';

class SyncService {
  final _supabase = Supabase.instance.client;

  /// Panggil: setelah tiap transaksi, saat app dibuka, dan saat internet kembali.
  Future<void> syncPendingTransactions() async {
    final conn = await Connectivity().checkConnectivity();
    if (conn.contains(ConnectivityResult.none)) return;

    final db = await LocalDb.instance;
    final pending = await db.query('transactions', where: 'is_synced = 0');

    for (final tx in pending) {
      try {
        final items = await db.query('transaction_items',
            where: 'local_tx_id = ?', whereArgs: [tx['local_id']]);

        final inserted = await _supabase.from('transactions').upsert({
          'local_id': tx['local_id'],       // dedup: kolom UNIQUE di server
          'store_id': _storeId,
          'cashier_id': _supabase.auth.currentUser!.id,
          'shift_id': tx['shift_id'],
          'subtotal': tx['subtotal'],
          'tax': tx['tax'],
          'discount': tx['discount'],
          'total': tx['total'],
          'paid': tx['paid'],
          'change': tx['change'],
          'payment_method': tx['payment_method'],
          'created_at': tx['created_at'],
        }, onConflict: 'local_id').select('id').single();

        await _supabase.from('transaction_items').insert(items.map((i) => {
          'transaction_id': inserted['id'],
          'product_id': i['product_id'],
          'product_name': i['product_name'],
          'price': i['price'],
          'qty': i['qty'],
          'subtotal': i['subtotal'],
        }).toList());

        await db.update('transactions', {'is_synced': 1},
            where: 'local_id = ?', whereArgs: [tx['local_id']]);
      } catch (_) {
        // gagal → biarkan is_synced = 0, dicoba lagi nanti
      }
    }
  }

  /// Ambil produk terbaru dari server → cache ke SQLite
  Future<void> pullProducts() async {
    final conn = await Connectivity().checkConnectivity();
    if (conn.contains(ConnectivityResult.none)) return;

    // Pakai VIEW products_kasir → kasir TIDAK menerima cost_price
    final rows = await _supabase.from('products_kasir').select();
    final db = await LocalDb.instance;
    final batch = db.batch();
    batch.delete('products');
    for (final r in rows) {
      batch.insert('products', {
        'id': r['id'], 'name': r['name'], 'sku': r['sku'],
        'barcode': r['barcode'], 'price': r['price'], 'stock': r['stock'],
        'category_id': r['category_id'], 'image_url': r['image_url'],
        'is_active': (r['is_active'] as bool) ? 1 : 0,
      });
    }
    await batch.commit(noResult: true);
  }

  String get _storeId => /* ambil dari profil user setelah login */ '';
}
```

#### 📄 `lib/core/license/license_service.dart`

```dart
import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:http/http.dart' as http;

class LicenseService {
  /// Return true bila lisensi valid. Panggil saat app start & tiap buka shift.
  Future<bool> verify(String licenseKey, String deviceId) async {
    try {
      final res = await http.post(
        Uri.parse(dotenv.env['LICENSE_API_URL']!),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'license_key': licenseKey, 'device_id': deviceId}),
      );
      if (res.statusCode != 200) return false;
      final data = jsonDecode(res.body);
      return data['valid'] == true;
    } catch (_) {
      // Offline grace period: izinkan tetap jalan beberapa hari
      // berdasarkan hasil verifikasi terakhir yang disimpan lokal.
      return _lastKnownValid();
    }
  }

  bool _lastKnownValid() {
    // TODO: baca cache hasil verifikasi terakhir (shared_preferences)
    return true;
  }
}
```

> Tambahkan `http: ^1.2.0` dan `shared_preferences: ^2.2.0` di pubspec bila memakai kode di atas.

Jalankan:

```bash
cd apps/kasir-mobile
flutter run          # pastikan emulator Android sudah nyala
```

---

## 🎨 Design System

Konsisten di **kedua platform** — warna & spacing sama, biar terasa satu produk.

### Palet Warna

| Token | Hex | Kegunaan |
|---|---|---|
| `primary` | `#0F6E56` (teal gelap) | Tombol utama, header, aksen brand |
| `primaryLight` | `#E1F5EE` | Background badge/chip aktif |
| `secondary` | `#D85A30` (coral) | Aksi sekunder, highlight admin |
| `success` | `#3B6D11` | Transaksi berhasil, status lunas |
| `warning` | `#BA7517` | Stok menipis, lisensi hampir habis |
| `danger` | `#A32D2D` | Void, hapus, error, stok habis |
| `surface` | `#FFFFFF` | Kartu, sheet |
| `background` | `#F7F6F2` | Latar layar |
| `textPrimary` | `#1F2421` | Teks utama |
| `textSecondary` | `#5F5E5A` | Teks pendukung, label |
| `border` | `#E3E1D9` | Garis pemisah, outline input |

### Tipografi

| Style | Ukuran | Weight | Pakai untuk |
|---|---|---|---|
| Display | 28 | 700 | Total bayar di layar kasir |
| H1 | 22 | 600 | Judul halaman |
| H2 | 18 | 600 | Judul section/kartu |
| Body | 15 | 400 | Teks umum |
| Caption | 12 | 400 | Label kecil, timestamp |
| Mono | 14 | 500 | Harga, angka di tabel (pakai font mono/tabular) |

Font rekomendasi: **Inter** (web) & **Inter/Roboto** (Flutter). Angka uang selalu pakai `tabular figures` supaya rata.

### Spacing & Radius

- Skala spacing: `4 / 8 / 12 / 16 / 24 / 32` px — jangan pakai nilai di luar ini.
- Radius: `8px` untuk tombol & input, `12px` untuk kartu.
- Touch target minimum di app kasir: **48×48px** (kasir kerja cepat, tombol harus besar).

### Prinsip UI Kasir (Mobile)

1. **Grid produk besar** — foto + nama + harga, tap sekali langsung masuk keranjang.
2. **Angka besar** — total belanja pakai Display 28px, terbaca dari jarak 1 meter.
3. **Maksimal 2 langkah ke bayar** — pilih produk → tap "Bayar" → selesai.
4. **Numpad bawaan** untuk input uang diterima + tombol cepat (Rp 50.000, Rp 100.000, "Uang pas").
5. **Feedback jelas** — sukses = layar hijau + ringkasan; gagal = merah + alasan.

#### 📄 `lib/core/constants/app_colors.dart`

```dart
import 'package:flutter/material.dart';

class AppColors {
  static const primary = Color(0xFF0F6E56);
  static const primaryLight = Color(0xFFE1F5EE);
  static const secondary = Color(0xFFD85A30);
  static const success = Color(0xFF3B6D11);
  static const warning = Color(0xFFBA7517);
  static const danger = Color(0xFFA32D2D);
  static const surface = Color(0xFFFFFFFF);
  static const background = Color(0xFFF7F6F2);
  static const textPrimary = Color(0xFF1F2421);
  static const textSecondary = Color(0xFF5F5E5A);
  static const border = Color(0xFFE3E1D9);
}
```

#### 📄 `lib/core/constants/app_typography.dart`

```dart
import 'package:flutter/material.dart';
import 'app_colors.dart';

ThemeData buildAppTheme() {
  return ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: AppColors.background,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      primary: AppColors.primary,
      error: AppColors.danger,
    ),
    textTheme: const TextTheme(
      displaySmall: TextStyle(fontSize: 28, fontWeight: FontWeight.w700),
      headlineSmall: TextStyle(fontSize: 22, fontWeight: FontWeight.w600),
      titleMedium: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
      bodyMedium: TextStyle(fontSize: 15, color: AppColors.textPrimary),
      bodySmall: TextStyle(fontSize: 12, color: AppColors.textSecondary),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        minimumSize: const Size(48, 48),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    ),
    cardTheme: CardThemeData(
      color: AppColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.border),
      ),
    ),
  );
}
```

#### 📄 `apps/admin-web/src/app/globals.css` — tambahkan token:

```css
:root {
  --primary: #0F6E56;
  --primary-light: #E1F5EE;
  --secondary: #D85A30;
  --success: #3B6D11;
  --warning: #BA7517;
  --danger: #A32D2D;
  --surface: #FFFFFF;
  --background: #F7F6F2;
  --text-primary: #1F2421;
  --text-secondary: #5F5E5A;
  --border: #E3E1D9;
  --radius-control: 8px;
  --radius-card: 12px;
}
```

---

## 🔐 Matriks Hak Akses (WAJIB DIPATUHI)

| Fitur | Kasir | Admin | Owner |
|---|:---:|:---:|:---:|
| Login app kasir | ✅ | ✅ | ✅ |
| Transaksi / jual | ✅ | ✅ | ✅ |
| Cetak struk | ✅ | ✅ | ✅ |
| Lihat stok (read-only, tanpa harga modal) | ✅ | ✅ | ✅ |
| Riwayat transaksi **milik sendiri** | ✅ | ✅ | ✅ |
| Buka/tutup shift (modal awal & setor) | ✅ | ✅ | ✅ |
| **Lihat total omzet / uang masuk** | ❌ | ✅ | ✅ |
| **Lihat laporan penjualan & grafik** | ❌ | ✅ | ✅ |
| **Lihat harga modal / profit** | ❌ | ✅ | ✅ |
| **Lihat transaksi kasir lain** | ❌ | ✅ | ✅ |
| **Lihat expected_cash (kas seharusnya)** | ❌ | ✅ | ✅ |
| Void / batalkan transaksi | ❌ | ✅ | ✅ |
| Tambah/edit produk & harga | ❌ | ✅ | ✅ |
| Kelola stok (tambah/adjust) | ❌ | ✅ | ✅ |
| Kelola user & role | ❌ | ✅ | ✅ |
| Akses dashboard admin web | ❌ | ✅ | ✅ |
| Pengaturan toko & langganan | ❌ | ❌ | ✅ |

Enforcement 3 lapis:
1. **Database (RLS)** — utama. Walau API di-hit langsung, data sensitif tidak keluar.
2. **View `products_kasir`** — kasir tidak pernah menerima kolom `cost_price`.
3. **Middleware Next.js** — kasir tidak bisa login ke dashboard admin sama sekali.

---

## 🔄 Alur Sinkronisasi Offline-First

```
[Kasir transaksi]
      │
      ▼
SQLite (is_synced = 0)  ← transaksi TERSIMPAN walau internet mati
      │
      ▼ (ada internet? cek connectivity_plus)
SyncService.syncPendingTransactions()
      │
      ▼
Supabase upsert (onConflict: local_id → tidak double)
      │
      ▼
SQLite update is_synced = 1
```

Kapan sync dipanggil:
- Setiap selesai transaksi (jika online)
- Saat app dibuka
- Saat status internet berubah dari offline → online (listen `connectivity_plus`)
- Timer periodik tiap 5 menit saat app aktif

Kapan `pullProducts()` dipanggil:
- Saat login / buka shift
- Pull-to-refresh di layar produk

---

## 💳 Alur Lisensi & Pembayaran

```
1. Owner daftar → otomatis dapat lisensi TRIAL 14 hari
2. Flutter tiap start → POST /api/license/verify → valid? lanjut : layar "berlangganan"
3. Owner bayar dari dashboard admin (Midtrans Snap)
4. Midtrans kirim webhook → /api/webhooks/midtrans
5. Webhook terverifikasi → status lisensi jadi ACTIVE + perpanjang valid_until
6. App kasir otomatis aktif lagi pada verifikasi berikutnya
```

Grace period offline: jika device offline, app tetap bisa jalan memakai hasil verifikasi terakhir (disimpan lokal) maksimal **7 hari**, setelah itu wajib online untuk verifikasi.

---

## ▶️ Menjalankan Semuanya (Ringkasan)

```bash
# Terminal 1 — Admin web
cd apps/admin-web
npm run dev                    # http://localhost:3000

# Terminal 2 — App kasir
cd apps/kasir-mobile
flutter run                    # emulator Android harus sudah jalan

# Supabase: sudah berjalan di cloud, tidak perlu dijalankan lokal.
```

Checklist pertama kali:
- [ ] SQL schema sudah dijalankan di Supabase SQL Editor tanpa error
- [ ] User owner + store + license trial sudah dibuat (Langkah 2 poin 5)
- [ ] `.env.local` (Next.js) dan `.env` (Flutter) sudah terisi
- [ ] `npm run dev` jalan → bisa login di `/login` sebagai owner
- [ ] `flutter run` jalan → bisa login sebagai kasir
- [ ] Coba matikan internet emulator → transaksi tetap bisa → nyalakan → data muncul di dashboard

---

## 🗺️ Roadmap Pengembangan (Urutan yang Disarankan)

**Fase 1 — MVP (fokus di sini dulu):**
1. Auth (login kasir & admin) + profil + role
2. Admin: CRUD produk & kategori
3. Kasir: layar transaksi (pilih produk → bayar → simpan ke SQLite)
4. Sync SQLite → Supabase
5. Admin: laporan penjualan sederhana (tabel + total per hari)

**Fase 2 — Operasional lengkap:**
6. Cetak struk bluetooth thermal
7. Buka/tutup shift + rekonsiliasi kas
8. Manajemen stok + notifikasi stok menipis
9. Void transaksi (admin only) + alasan

**Fase 3 — Monetisasi:**
10. Halaman langganan di dashboard + Midtrans Snap
11. Webhook pembayaran + aktivasi lisensi otomatis
12. Layar "masa trial habis" di app kasir

**Fase 4 — Rilis:**
13. Closed testing Play Store (14 hari, 12 tester — syarat akun personal)
14. Rilis publik + landing page (bisa satu project dengan admin-web)

---

## 🧯 Troubleshooting Umum

| Masalah | Penyebab & Solusi |
|---|---|
| Flutter tidak bisa hit `localhost:3000` | Dari emulator Android, pakai `10.0.2.2:3000`, bukan `localhost` |
| `permission denied for table ...` di Supabase | RLS aktif tapi policy belum cocok — cek role user di tabel `profiles` |
| Kasir bisa lihat data yang seharusnya tidak boleh | Pastikan query kasir pakai view `products_kasir`, dan cek ulang policy RLS |
| Transaksi dobel setelah sync | Pastikan upsert memakai `onConflict: 'local_id'` dan kolom `local_id` UNIQUE |
| `.env` tidak terbaca di Flutter | Pastikan `.env` terdaftar di `assets:` pada `pubspec.yaml` |
| Webhook Midtrans tidak masuk saat dev | Midtrans butuh URL publik — pakai `ngrok http 3000` saat testing |
| Build Next.js error `cookies()` | Pastikan pakai `await cookies()` (Next.js 15) atau sesuaikan versi |

---

## 🔒 Aturan Keamanan (Jangan Dilanggar)

1. `SUPABASE_SERVICE_ROLE_KEY` **hanya** boleh ada di `.env.local` Next.js (server). Jangan pernah masuk ke Flutter, browser, atau git.
2. Semua file `.env*` masuk `.gitignore`.
3. Validasi lisensi & pembayaran **selalu** di server (API routes), tidak pernah dipercayakan ke app.
4. Setiap tabel baru **wajib** langsung diberi RLS policy sebelum dipakai.
5. Harga & total transaksi divalidasi ulang di sisi server bila memungkinkan (jangan percaya angka dari client mentah-mentah).

---

*Dibuat sebagai blueprint lengkap proyek KasirKu. Selamat coding! 🚀*
