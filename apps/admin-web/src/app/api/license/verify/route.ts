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
