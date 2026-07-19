-- ==============================================
-- BOOTSTRAP OWNER + TOKO + LISENSI TRIAL
-- Jalankan SETELAH:
--   1) Migration 00001_initial_schema.sql sudah dieksekusi.
--   2) User owner sudah dibuat via Authentication → Users → Add user
--      (catat USER_ID / UID dari user tersebut).
--
-- Cara pakai (di SQL Editor Supabase):
--   Langkah A — buat toko, salin id yang dikembalikan:
--       insert into stores (name) values ('Toko Saya') returning id;
--   Langkah B — ganti <USER_ID_DARI_AUTH> dan <STORE_ID> di bawah, lalu jalankan.
-- ==============================================

-- Buat toko + jadikan user pertama sebagai owner
insert into stores (name) values ('Toko Saya') returning id;
-- salin id toko dari hasil di atas, lalu:
insert into profiles (id, store_id, full_name, role)
values ('<USER_ID_DARI_AUTH>', '<STORE_ID>', 'Nama Owner', 'owner');
-- buat lisensi trial 14 hari:
insert into licenses (store_id, license_key, status, valid_until)
values ('<STORE_ID>', 'TRIAL-' || substr(gen_random_uuid()::text,1,8), 'trial', now() + interval '14 days');
