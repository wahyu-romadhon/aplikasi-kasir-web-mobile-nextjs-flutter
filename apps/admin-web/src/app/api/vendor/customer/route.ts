import { NextResponse } from "next/server";
import crypto from "crypto";
import { getSuperAdminUser, superAdminEmails } from "@/lib/superadmin";
import { supabaseAdmin } from "@/lib/supabase/admin";

const DAY = 86_400_000;

/** Ambil profil owner (id + email) sebuah toko. */
async function getOwner(storeId: string) {
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("store_id", storeId)
    .eq("role", "owner")
    .maybeSingle();
  if (!prof) return null;
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(prof.id);
  return { id: prof.id, email: u.user?.email ?? "" };
}

export async function POST(req: Request) {
  const admin = await getSuperAdminUser();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { store_name, owner_name, owner_email, owner_password, trial_days, license_type } =
    await req.json();
  if (!store_name?.trim() || !owner_email?.trim() || !owner_password) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const status = license_type === "active" ? "active" : "trial";
  const days = Number(trial_days) > 0 ? Number(trial_days) : status === "active" ? 30 : 3;

  // 1. Buat user owner.
  const { data: created, error: uErr } = await supabaseAdmin.auth.admin.createUser({
    email: owner_email.trim(),
    password: owner_password,
    email_confirm: true,
  });
  if (uErr || !created.user) {
    return NextResponse.json(
      { error: uErr?.message ?? "gagal_buat_user" },
      { status: 400 },
    );
  }
  const uid = created.user.id;

  // 2. Buat toko.
  const { data: store, error: sErr } = await supabaseAdmin
    .from("stores")
    .insert({ name: store_name.trim() })
    .select("id")
    .single();
  if (sErr || !store) {
    await supabaseAdmin.auth.admin.deleteUser(uid); // rollback user
    return NextResponse.json({ error: sErr?.message ?? "gagal_buat_toko" }, { status: 500 });
  }

  // 3. Profil owner.
  const { error: pErr } = await supabaseAdmin.from("profiles").insert({
    id: uid,
    store_id: store.id,
    full_name: owner_name?.trim() || "Owner",
    role: "owner",
    is_active: true,
  });
  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  // 4. Lisensi trial.
  const prefix = status === "active" ? "LIC-" : "TRIAL-";
  const licenseKey = prefix + crypto.randomUUID().slice(0, 8);
  const { error: lErr } = await supabaseAdmin.from("licenses").insert({
    store_id: store.id,
    license_key: licenseKey,
    status,
    valid_until: new Date(Date.now() + days * DAY).toISOString(),
  });
  if (lErr) {
    return NextResponse.json({ error: lErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, store_id: store.id, license_key: licenseKey });
}

// ── Edit pelanggan ──────────────────────────────────────────────
export async function PATCH(req: Request) {
  const admin = await getSuperAdminUser();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { store_id, store_name, owner_name, owner_email, owner_password } = await req.json();
  if (!store_id || !store_name?.trim()) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const owner = await getOwner(store_id);
  if (!owner) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { error: sErr } = await supabaseAdmin
    .from("stores")
    .update({ name: store_name.trim() })
    .eq("id", store_id);
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  await supabaseAdmin
    .from("profiles")
    .update({ full_name: owner_name?.trim() || "Owner" })
    .eq("id", owner.id);

  const authUpdate: { email?: string; password?: string } = {};
  if (owner_email?.trim() && owner_email.trim() !== owner.email) authUpdate.email = owner_email.trim();
  if (owner_password) authUpdate.password = owner_password;
  if (Object.keys(authUpdate).length) {
    const { error: aErr } = await supabaseAdmin.auth.admin.updateUserById(owner.id, authUpdate);
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// ── Hapus pelanggan (toko + owner + semua datanya) ──────────────
export async function DELETE(req: Request) {
  const admin = await getSuperAdminUser();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { store_id } = await req.json();
  if (!store_id) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const owner = await getOwner(store_id);
  // Jangan hapus toko milik super-admin sendiri.
  if (owner && superAdminEmails().includes(owner.email.toLowerCase())) {
    return NextResponse.json({ error: "tidak_bisa_hapus_vendor" }, { status: 400 });
  }

  // Hapus semua profil toko (owner/kasir) → cascade dari auth.users.
  const { data: profs } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("store_id", store_id);
  for (const p of profs ?? []) {
    await supabaseAdmin.auth.admin.deleteUser(p.id);
  }
  // Hapus toko → cascade produk/transaksi/lisensi/dll.
  const { error } = await supabaseAdmin.from("stores").delete().eq("id", store_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
