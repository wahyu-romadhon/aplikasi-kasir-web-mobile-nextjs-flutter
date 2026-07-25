import { Package, Tags, BadgeCheck, Boxes } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTanggal } from "@/lib/format";

export default async function OverviewPage() {
  const supabase = await createClient();

  const [products, categories, activeProducts, license] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("categories").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase
      .from("licenses")
      .select("status, valid_until")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const stats = [
    { label: "Total Produk", value: products.count ?? 0, icon: Package, tint: "bg-primary-light text-primary" },
    { label: "Produk Aktif", value: activeProducts.count ?? 0, icon: Boxes, tint: "bg-[#EAF3E1] text-success" },
    { label: "Kategori", value: categories.count ?? 0, icon: Tags, tint: "bg-[#F6E9E2] text-secondary" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold">Beranda</h1>
        <p className="text-sm text-muted-foreground">Ringkasan toko Anda.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, tint }) => (
          <Card key={label} className="shadow-sm">
            <CardContent className="flex items-center gap-4 py-5">
              <div className={`flex size-11 items-center justify-center rounded-xl ${tint}`}>
                <Icon className="size-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-semibold tabular-nums">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardContent className="flex items-center justify-between py-5">
          <div className="flex items-center gap-4">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary-light text-primary">
              <BadgeCheck className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status Lisensi</p>
              {license.data ? (
                <p className="text-sm">
                  Berlaku sampai{" "}
                  <span className="font-medium">{formatTanggal(license.data.valid_until)}</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada lisensi</p>
              )}
            </div>
          </div>
          {license.data && (
            <Badge
              className={
                license.data.status === "expired"
                  ? "bg-danger/10 text-danger"
                  : "bg-primary-light text-primary"
              }
            >
              {license.data.status}
            </Badge>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
