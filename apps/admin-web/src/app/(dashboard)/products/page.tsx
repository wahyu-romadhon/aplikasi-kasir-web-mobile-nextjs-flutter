import { createClient } from "@/lib/supabase/server";
import { ProductsManager } from "@/components/products-manager";

export default async function ProductsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("store_id")
    .eq("id", user!.id)
    .single();

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, price, cost_price, stock, sku, barcode, is_active, category_id")
      .order("name"),
    supabase.from("categories").select("id, name").order("name"),
  ]);

  return (
    <ProductsManager
      storeId={profile!.store_id}
      initial={products ?? []}
      categories={categories ?? []}
    />
  );
}
