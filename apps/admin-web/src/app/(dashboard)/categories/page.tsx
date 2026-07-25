import { createClient } from "@/lib/supabase/server";
import { CategoriesManager } from "@/components/categories-manager";
import { isLimitedPlan, limitedLabel, LIMITED_CATEGORY_MAX } from "@/lib/plan-limits";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("store_id")
    .eq("id", user!.id)
    .single();

  const [{ data: categories }, { data: license }] = await Promise.all([
    supabase.from("categories").select("id, name, created_at").order("name"),
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
    <CategoriesManager
      storeId={profile!.store_id}
      initial={categories ?? []}
      categoryLimit={limited ? LIMITED_CATEGORY_MAX : null}
      planLabel={limitedLabel(license?.status, license?.plan)}
    />
  );
}
