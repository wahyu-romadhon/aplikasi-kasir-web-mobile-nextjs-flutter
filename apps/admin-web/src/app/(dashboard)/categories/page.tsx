import { createClient } from "@/lib/supabase/server";
import { CategoriesManager } from "@/components/categories-manager";

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

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, created_at")
    .order("name");

  return (
    <CategoriesManager storeId={profile!.store_id} initial={categories ?? []} />
  );
}
