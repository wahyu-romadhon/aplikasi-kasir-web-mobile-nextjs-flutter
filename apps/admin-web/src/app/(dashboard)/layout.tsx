import { redirect } from "next/navigation";
import { Store } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
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
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            K
          </div>
          <span className="font-semibold">KasirKu</span>
        </div>
        <div className="flex-1 p-3">
          <SidebarNav />
        </div>
        <div className="border-t border-border p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Store className="size-3.5" />
            <span className="truncate">{store?.name ?? "Toko"}</span>
          </div>
        </div>
      </aside>

      {/* Konten */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{profile.full_name}</p>
            <p className="text-xs text-muted-foreground capitalize">{profile.role}</p>
          </div>
          <LogoutButton />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
