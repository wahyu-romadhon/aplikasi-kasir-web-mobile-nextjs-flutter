import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.OWNER_EMAIL;
const password = process.env.OWNER_PASSWORD;
const fullName = process.env.OWNER_NAME || "Owner";

if (!url || !key || !email || !password) {
  console.error("❌ Butuh env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OWNER_EMAIL, OWNER_PASSWORD");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

// 1. Buat (atau ambil) user owner di Auth
let userId;
const { data: created, error: cErr } = await sb.auth.admin.createUser({
  email, password, email_confirm: true,
});
if (cErr) {
  const { data: list } = await sb.auth.admin.listUsers();
  const found = list.users.find((u) => u.email === email);
  if (!found) { console.error("❌ createUser:", cErr.message); process.exit(1); }
  userId = found.id;
  console.log("ℹ️  user sudah ada, dipakai:", userId);
} else {
  userId = created.user.id;
  console.log("✅ user owner dibuat:", userId);
}

// 2. Toko (pakai yang ada kalau sudah ada)
let storeId;
const { data: existingStore } = await sb.from("stores").select("id").limit(1).maybeSingle();
if (existingStore) {
  storeId = existingStore.id;
  console.log("ℹ️  pakai toko yang ada:", storeId);
} else {
  const { data: store, error } = await sb.from("stores").insert({ name: "Toko Saya" }).select("id").single();
  if (error) { console.error("❌ insert store:", error.message); process.exit(1); }
  storeId = store.id;
  console.log("✅ toko dibuat:", storeId);
}

// 3. Profil owner (upsert by id)
{
  const { error } = await sb.from("profiles").upsert({
    id: userId, store_id: storeId, full_name: fullName, role: "owner", is_active: true,
  });
  if (error) { console.error("❌ upsert profile:", error.message); process.exit(1); }
  console.log("✅ profil owner disimpan (role: owner)");
}

// 4. Lisensi trial 14 hari (kalau belum ada)
{
  const { data: existing } = await sb.from("licenses").select("id").eq("store_id", storeId).limit(1).maybeSingle();
  if (existing) {
    console.log("ℹ️  lisensi sudah ada, dilewati");
  } else {
    const licenseKey = "TRIAL-" + crypto.randomUUID().slice(0, 8);
    const validUntil = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
    const { error } = await sb.from("licenses").insert({
      store_id: storeId, license_key: licenseKey, status: "trial", valid_until: validUntil,
    });
    if (error) { console.error("❌ insert license:", error.message); process.exit(1); }
    console.log(`✅ lisensi trial: ${licenseKey} (s/d ${validUntil.slice(0, 10)})`);
  }
}

console.log("\n🎉 Bootstrap selesai. Login admin pakai email owner di atas.");
