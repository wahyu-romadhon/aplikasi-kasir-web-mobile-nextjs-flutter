# CLAUDE.md — Aturan Project KasirKu

File ini dibaca otomatis oleh Claude Code setiap sesi. Patuhi semua aturan di bawah.

## Sumber Kebenaran
- **README.md adalah blueprint utama.** Semua struktur folder, skema database, kode fondasi, design system, dan urutan pengerjaan mengikuti README.md. Jangan menyimpang tanpa konfirmasi user.

## Arsitektur (Ringkas)
- `apps/kasir-mobile` → Flutter (app kasir untuk pelayan), offline-first dengan SQLite, sync ke Supabase.
- `apps/admin-web` → Next.js 14 App Router + TypeScript + Tailwind + shadcn/ui (dashboard owner/admin + API routes).
- Backend: Supabase (PostgreSQL + Auth + RLS). Logic sensitif (lisensi, webhook Midtrans) di Next.js API routes.

## Aturan Keamanan (WAJIB, JANGAN DILANGGAR)
1. Kasir TIDAK BOLEH bisa melihat: omzet/total uang masuk, laporan penjualan, harga modal (`cost_price`), profit, transaksi kasir lain, `expected_cash`. Enforcement utama di RLS database, bukan cuma di UI.
2. Query produk dari sisi kasir HARUS memakai view `products_kasir` (tanpa `cost_price`), jangan tabel `products` langsung.
3. `SUPABASE_SERVICE_ROLE_KEY` hanya boleh di server (Next.js API routes / `lib/supabase/admin.ts`). Jangan pernah di kode Flutter atau komponen client.
4. Semua file `.env*` masuk `.gitignore`. Jangan pernah commit secrets.
5. Setiap tabel baru wajib langsung diberi RLS policy.
6. Void transaksi hanya untuk role admin/owner.
7. Validasi lisensi & pembayaran selalu di server, jangan dipercayakan ke client.

## Design System (WAJIB dipakai)
- Warna, tipografi, spacing mengikuti bagian "Design System" di README.md.
- Flutter: pakai `AppColors` dan `buildAppTheme()` dari `lib/core/constants/`. Jangan hardcode warna.
- Next.js: pakai CSS variables di `globals.css` (--primary, --danger, dst) dan komponen shadcn/ui.
- Spacing hanya dari skala: 4/8/12/16/24/32 px. Radius: 8px (kontrol), 12px (kartu).
- Touch target minimum di app kasir: 48x48px.

## Urutan Pengerjaan (kerjakan bertahap, satu fase selesai & teruji dulu)
1. Struktur monorepo + setup kedua project (README Langkah 1).
2. Admin (Next.js): login + halaman kelola produk & kategori.
3. Kasir (Flutter): login + layar transaksi (SQLite dulu) + sync ke Supabase.
4. Admin: laporan penjualan sederhana.
5. Fase 2 dst mengikuti roadmap README (struk, shift, stok, void, diskon, lisensi/Midtrans).

## Konvensi Kode
- Flutter: state management pakai Riverpod. Struktur folder sesuai README (`core/`, `features/`, `shared/`).
- Next.js: App Router, server components secara default, `"use client"` hanya bila perlu. Supabase client sesuai `lib/supabase/{client,server,admin}.ts`.
- Bahasa UI aplikasi: Indonesia. Nama variabel/fungsi: Inggris.
- Format uang: Rupiah, pakai `intl` (Flutter) / `Intl.NumberFormat("id-ID")` (Next.js), tabular figures untuk angka.

## Yang TIDAK Boleh Dilakukan Claude Code Tanpa Konfirmasi
- Mengubah skema database / RLS policy yang sudah ada.
- Menambah dependency besar di luar yang tertulis di README.
- Menghapus atau menimpa file `.env`.
- Push ke remote git.

## Catatan Environment
- Emulator Android mengakses localhost Next.js via `http://10.0.2.2:3000`.
- Testing webhook Midtrans lokal butuh `ngrok http 3000`.
- Setup akun Supabase, pengisian `.env`, dan eksekusi SQL di dashboard Supabase dilakukan manual oleh user — minta user melakukannya saat sampai di langkah itu, jangan di-skip atau diasumsikan sudah ada.
