import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Void transaksi — HANYA owner/admin (aturan keamanan CLAUDE.md #6).
 * Menandai status='void' + alasan, lalu mengembalikan stok produk.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, store_id")
    .eq("id", user.id)
    .single();
  if (!profile || !["owner", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { transaction_id, reason } = await req.json();
  if (!transaction_id || !reason?.trim()) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Ambil transaksi & pastikan milik toko admin + masih completed.
  const { data: tx } = await supabaseAdmin
    .from("transactions")
    .select("id, store_id, status")
    .eq("id", transaction_id)
    .single();
  if (!tx || tx.store_id !== profile.store_id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (tx.status !== "completed") {
    return NextResponse.json({ error: "already_void" }, { status: 409 });
  }

  // Kumpulkan qty per produk untuk dikembalikan.
  const { data: items } = await supabaseAdmin
    .from("transaction_items")
    .select("product_id, qty")
    .eq("transaction_id", transaction_id);

  const need = new Map<string, number>();
  for (const it of items ?? []) {
    need.set(it.product_id, (need.get(it.product_id) ?? 0) + Number(it.qty));
  }

  // Tandai void.
  const { error: upErr } = await supabaseAdmin
    .from("transactions")
    .update({ status: "void", void_reason: reason.trim(), voided_by: user.id })
    .eq("id", transaction_id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Kembalikan stok + catat mutasi.
  if (need.size > 0) {
    const ids = Array.from(need.keys());
    const { data: prods } = await supabaseAdmin
      .from("products")
      .select("id, store_id, stock")
      .in("id", ids);
    for (const p of prods ?? []) {
      const qty = need.get(p.id) ?? 0;
      await supabaseAdmin.from("products").update({ stock: Number(p.stock) + qty }).eq("id", p.id);
      await supabaseAdmin.from("stock_movements").insert({
        store_id: p.store_id,
        product_id: p.id,
        type: "in",
        qty,
        note: "Void transaksi",
        created_by: user.id,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
