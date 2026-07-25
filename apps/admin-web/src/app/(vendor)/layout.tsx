import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/superadmin";
import { LogoutButton } from "@/components/logout-button";

export default async function VendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isSuperAdmin(user.email)) redirect("/?error=forbidden");

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-[#1F2421] text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-sm font-bold text-white">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">KasirKu · Super Admin</p>
              <p className="text-xs text-white/60">Panel Vendor</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="size-4" />
              Dashboard Toko
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
