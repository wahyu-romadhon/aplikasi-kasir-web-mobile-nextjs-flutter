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
