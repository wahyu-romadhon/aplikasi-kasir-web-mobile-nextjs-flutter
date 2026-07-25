import Link from "next/link";
import { redirect } from "next/navigation";
import { Store, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/superadmin";
import { SidebarNav } from "@/components/sidebar-nav";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, store_id")
    .eq("id", user.id)
    .single();

  if (!profile || !["owner", "admin"].includes(profile.role)) {
    redirect("/login?error=forbidden");
  }

  const { data: store } = await supabase
    .from("stores")
    .select("name")
    .eq("id", profile.store_id)
    .single();

  return (
    <div className="flex min-h-svh bg-background">
      {/* Sidebar — rail ikon yang mengembang saat hover (w-16 → w-60) */}
      <aside className="hidden w-16 shrink-0 md:block">
        <div className="group fixed inset-y-0 left-0 z-20 flex w-16 flex-col overflow-hidden border-r border-border bg-surface transition-[width] duration-200 ease-out hover:w-60 hover:shadow-xl">
          {/* Logo — tinggi sama dengan header (h-16) agar garis sejajar */}
          <div className="flex h-16 shrink-0 items-center border-b border-border">
            <div className="flex w-16 shrink-0 items-center justify-center">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                K
              </div>
            </div>
            <span className="whitespace-nowrap text-lg font-semibold opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              KasirKu
            </span>
          </div>

          {/* Navigasi */}
          <nav className="flex-1 py-2">
            <SidebarNav />
          </nav>

          {/* Panel Vendor — hanya super-admin */}
          {isSuperAdmin(user.email) && (
            <Link
              href="/vendor"
              title="Panel Vendor"
              className="flex h-11 items-center border-t border-border text-sm font-medium text-secondary transition-colors hover:bg-muted"
            >
              <span className="flex w-16 shrink-0 items-center justify-center">
                <ShieldCheck className="size-5" />
              </span>
              <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                Panel Vendor
              </span>
            </Link>
          )}

          {/* Footer toko */}
          <div className="flex h-12 shrink-0 items-center border-t border-border text-muted-foreground">
            <div className="flex w-16 shrink-0 items-center justify-center">
              <Store className="size-4" />
            </div>
            <span className="truncate whitespace-nowrap text-xs opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {store?.name ?? "Toko"}
            </span>
          </div>
        </div>
      </aside>

      {/* Konten */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-surface/95 px-6 backdrop-blur supports-backdrop-filter:bg-surface/80">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary-light text-sm font-semibold text-primary">
              {(profile.full_name?.[0] ?? "U").toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{profile.full_name}</p>
              <p className="text-xs text-muted-foreground capitalize">{profile.role}</p>
            </div>
          </div>
          <LogoutButton />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
