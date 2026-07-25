import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Bypass RLS — JANGAN PERNAH import ini di komponen client!
// Dibuat LAZY (via Proxy) supaya klien tidak diinstansiasi saat build —
// hanya saat benar-benar dipakai (request time). Ini mencegah build gagal
// dengan "supabaseUrl is required" bila env belum tersedia saat collect page data.
let cached: SupabaseClient | null = null;

function client(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Env Supabase belum di-set (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). " +
        "Set di Vercel → Settings → Environment Variables.",
    );
  }
  cached = createClient(url, key);
  return cached;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const c = client();
    const value = Reflect.get(c as object, prop, receiver);
    return typeof value === "function" ? value.bind(c) : value;
  },
});
