import { createClient } from "@/lib/supabase/server";
import { TransactionsView } from "@/components/transactions-view";

export default async function TransactionsPage() {
  const supabase = await createClient();

  const { data: txs } = await supabase
    .from("transactions")
    .select("id, created_at, cashier_id, total, payment_method, status, void_reason")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = txs ?? [];

  // Peta nama kasir.
  const ids = Array.from(new Set(rows.map((r) => r.cashier_id).filter(Boolean)));
  let cashierNames: Record<string, string> = {};
  if (ids.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids as string[]);
    cashierNames = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name]));
  }

  return <TransactionsView initial={rows} cashierNames={cashierNames} />;
}
