import { createClient } from "@supabase/supabase-js";

// Bypass RLS — JANGAN PERNAH import ini di komponen client!
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
