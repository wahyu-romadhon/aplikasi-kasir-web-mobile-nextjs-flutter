import { createClient } from "@/lib/supabase/server";

/** Daftar email super-admin (vendor) dari env, lowercase. */
export function superAdminEmails(): string[] {
  return (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  return superAdminEmails().includes(email.toLowerCase());
}

/** Untuk API route: pastikan pemanggil super-admin, kembalikan user atau null. */
export async function getSuperAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isSuperAdmin(user.email)) return null;
  return user;
}
