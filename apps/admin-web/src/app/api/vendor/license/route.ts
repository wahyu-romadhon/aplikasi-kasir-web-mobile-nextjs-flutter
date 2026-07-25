import { NextResponse } from "next/server";
import { getSuperAdminUser } from "@/lib/superadmin";
import { supabaseAdmin } from "@/lib/supabase/admin";

const DAY = 86_400_000;

export async function POST(req: Request) {
  const user = await getSuperAdminUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { license_id, action, days } = await req.json();
  if (!license_id || !action) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const { data: lic } = await supabaseAdmin
    .from("licenses")
    .select("id, valid_until")
    .eq("id", license_id)
    .single();
  if (!lic) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let update: Record<string, unknown>;
  if (action === "extend") {
    const n = Number(days) || 30;
    const base = Math.max(Date.now(), new Date(lic.valid_until).getTime());
    update = { status: "active", valid_until: new Date(base + n * DAY).toISOString() };
  } else if (action === "trial") {
    const n = Number(days) || 3;
    update = { status: "trial", valid_until: new Date(Date.now() + n * DAY).toISOString() };
  } else if (action === "suspend") {
    update = { status: "suspended" };
  } else {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("licenses").update(update).eq("id", license_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
