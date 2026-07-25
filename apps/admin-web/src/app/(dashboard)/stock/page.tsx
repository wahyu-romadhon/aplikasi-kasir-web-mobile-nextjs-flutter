import { createClient } from "@/lib/supabase/server";
import { StockManager, LOW_STOCK_THRESHOLD } from "@/components/stock-manager";

export default async function StockPage() {
  const supabase = await createClient();

  const [{ data: products }, { data: movements }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, stock, store_id, is_active")
      .order("stock", { ascending: true }),
    supabase
      .from("stock_movements")
      .select("id, product_id, type, qty, note, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const rows = products ?? [];
  const names = Object.fromEntries(rows.map((p) => [p.id, p.name]));
  const lowCount = rows.filter((p) => p.stock <= LOW_STOCK_THRESHOLD).length;

  return (
    <StockManager
      initial={rows}
      movements={movements ?? []}
      productNames={names}
      lowCount={lowCount}
    />
  );
}
