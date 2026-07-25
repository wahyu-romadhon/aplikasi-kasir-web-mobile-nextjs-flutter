import { createClient } from "@/lib/supabase/server";
import { ProductsManager } from "@/components/products-manager";
import { isLimitedPlan, limitedLabel, LIMITED_PRODUCT_MAX } from "@/lib/plan-limits";

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

  const [{ data: products }, { data: categories }, { data: license }] =
    await Promise.all([
      supabase
        .from("products")
        .select(
          "id, name, price, cost_price, stock, sku, barcode, is_active, category_id, image_url",
        )
        .order("name"),
      supabase.from("categories").select("id, name").order("name"),
      supabase
        .from("licenses")
        .select("status, plan")
        .eq("store_id", profile!.store_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const limited = isLimitedPlan(license?.status, license?.plan);

  return (
    <ProductsManager
      storeId={profile!.store_id}
      initial={products ?? []}
      categories={categories ?? []}
      productLimit={limited ? LIMITED_PRODUCT_MAX : null}
      planLabel={limitedLabel(license?.status, license?.plan)}
    />
  );
}
