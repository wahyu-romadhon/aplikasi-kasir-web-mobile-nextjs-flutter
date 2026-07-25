import { createClient } from "@/lib/supabase/server";
import { ReportsView } from "@/components/reports-view";

const DAYS = 30;
const CHART_DAYS = 14;
const JKT_OFFSET_MS = 7 * 3600 * 1000; // WIB = UTC+7 (tanpa DST)

/** Kunci tanggal (YYYY-MM-DD) menurut waktu WIB. */
function jktKey(iso: string): string {
  const d = new Date(new Date(iso).getTime() + JKT_OFFSET_MS);
  return d.toISOString().slice(0, 10);
}

export default async function ReportsPage() {
  const supabase = await createClient();

  const since = new Date(Date.now() - DAYS * 24 * 3600 * 1000).toISOString();
  const { data: txs } = await supabase
    .from("transactions")
    .select("created_at, total, payment_method")
    .eq("status", "completed")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const rows = txs ?? [];

  // Agregasi per hari (WIB).
  const perDay = new Map<string, { count: number; total: number }>();
  const perMethod = new Map<string, number>();
  let totalOmzet = 0;

  for (const t of rows) {
    const total = Number(t.total) || 0;
    totalOmzet += total;
    const key = jktKey(t.created_at as string);
    const d = perDay.get(key) ?? { count: 0, total: 0 };
    d.count += 1;
    d.total += total;
    perDay.set(key, d);
    const m = (t.payment_method as string) ?? "cash";
    perMethod.set(m, (perMethod.get(m) ?? 0) + total);
  }

  const txCount = rows.length;
  const avg = txCount ? totalOmzet / txCount : 0;

  // Kunci "hari ini" WIB.
  const todayKey = new Date(Date.now() + JKT_OFFSET_MS).toISOString().slice(0, 10);
  const today = perDay.get(todayKey) ?? { count: 0, total: 0 };

  // Data grafik: CHART_DAYS hari terakhir, isi 0 untuk hari tanpa transaksi.
  const todayMidnightMs = Date.parse(todayKey + "T00:00:00Z");
  const chart = Array.from({ length: CHART_DAYS }, (_, i) => {
    const ms = todayMidnightMs - (CHART_DAYS - 1 - i) * 24 * 3600 * 1000;
    const key = new Date(ms).toISOString().slice(0, 10);
    const d = perDay.get(key) ?? { count: 0, total: 0 };
    return { key, label: key.slice(8, 10) + "/" + key.slice(5, 7), total: d.total };
  });

  // Tabel: per hari, terbaru dulu.
  const table = Array.from(perDay.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, v]) => ({ key, count: v.count, total: v.total }));

  const methods = Array.from(perMethod.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([method, total]) => ({ method, total }));

  return (
    <ReportsView
      days={DAYS}
      totalOmzet={totalOmzet}
      txCount={txCount}
      avg={avg}
      today={today}
      chart={chart}
      table={table}
      methods={methods}
    />
  );
}
