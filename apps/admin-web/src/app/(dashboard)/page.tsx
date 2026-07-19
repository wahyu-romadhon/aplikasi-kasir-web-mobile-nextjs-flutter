import { Package, Tags, BadgeCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTanggal } from "@/lib/format";

export default async function OverviewPage() {
  const supabase = await createClient();

  const [products, categories, license] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("categories").select("*", { count: "exact", head: true }),
    supabase
      .from("licenses")
      .select("status, valid_until")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const stats = [
    { label: "Total Produk", value: products.count ?? 0, icon: Package },
    { label: "Kategori", value: categories.count ?? 0, icon: Tags },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold">Beranda</h1>
        <p className="text-sm text-muted-foreground">Ringkasan toko Anda.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lisensi
            </CardTitle>
            <BadgeCheck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-1">
            {license.data ? (
              <>
                <Badge
                  className={
                    license.data.status === "expired"
                      ? "bg-danger/10 text-danger"
                      : "bg-primary-light text-primary"
                  }
                >
                  {license.data.status}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  Berlaku s/d {formatTanggal(license.data.valid_until)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada lisensi</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
