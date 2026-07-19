import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum ada di env.");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const tables = [
  "profiles", "stores", "categories", "products",
  "transactions", "transaction_items", "shifts",
  "stock_movements", "licenses", "payments",
];

console.log("🔎 Cek tabel di schema public:\n");
let missing = 0;
for (const t of tables) {
  const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
  if (error) {
    console.log(`  ❌ ${t.padEnd(20)} → ${error.message}`);
    missing++;
  } else {
    console.log(`  ✅ ${t.padEnd(20)} (rows: ${count ?? 0})`);
  }
}

// View aman kasir
console.log("\n🔎 Cek view aman kasir:");
{
  const { error } = await sb.from("products_kasir").select("*", { head: true, count: "exact" });
  console.log(error ? `  ❌ products_kasir → ${error.message}` : "  ✅ products_kasir (view ada)");
  if (error) missing++;
}

// Cek data seed owner
console.log("\n🔎 Cek data awal (seed):");
{
  const { data: stores } = await sb.from("stores").select("id, name");
  console.log(`  • stores   : ${stores?.length ?? 0} → ${stores?.map(s => s.name).join(", ") || "(kosong)"}`);

  const { data: owners } = await sb.from("profiles").select("id, full_name, role").eq("role", "owner");
  console.log(`  • owner    : ${owners?.length ?? 0} → ${owners?.map(o => o.full_name).join(", ") || "(belum ada owner)"}`);

  const { data: lics } = await sb.from("licenses").select("license_key, status, valid_until");
  console.log(`  • licenses : ${lics?.length ?? 0} → ${lics?.map(l => `${l.status} s/d ${l.valid_until?.slice(0,10)}`).join(", ") || "(kosong)"}`);
}

// Cek jumlah user auth
console.log("\n🔎 Cek user Auth:");
{
  const { data, error } = await sb.auth.admin.listUsers();
  if (error) console.log(`  ❌ ${error.message}`);
  else console.log(`  • auth users: ${data.users.length} → ${data.users.map(u => u.email).join(", ") || "(kosong)"}`);
}

console.log(`\n${missing === 0 ? "✅ Semua tabel & view lengkap." : `⚠️  ${missing} objek bermasalah.`}`);
