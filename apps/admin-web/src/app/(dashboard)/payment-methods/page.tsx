import { createClient } from "@/lib/supabase/server";
import { PaymentMethodsManager } from "@/components/payment-methods-manager";

export default async function PaymentMethodsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("store_id")
    .eq("id", user!.id)
    .single();

  const { data: methods, error } = await supabase
    .from("store_payment_methods")
    .select("id, label, image_url, is_active, sort_order")
    .order("sort_order")
    .order("created_at");

  return (
    <PaymentMethodsManager
      storeId={profile!.store_id}
      initial={methods ?? []}
      tableMissing={!!error}
    />
  );
}
