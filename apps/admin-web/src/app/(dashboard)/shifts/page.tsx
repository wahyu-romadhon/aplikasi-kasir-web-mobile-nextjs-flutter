import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRupiah } from "@/lib/format";

function formatWaktu(iso: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function ShiftsPage() {
  const supabase = await createClient();

  const { data: shifts } = await supabase
    .from("shifts")
    .select("id, cashier_id, opening_cash, closing_cash, opened_at, closed_at")
    .order("opened_at", { ascending: false })
    .limit(50);

  const rows = shifts ?? [];
  const shiftIds = rows.map((s) => s.id);
  const cashierIds = Array.from(new Set(rows.map((s) => s.cashier_id).filter(Boolean)));

  // Nama kasir.
  let names: Record<string, string> = {};
  if (cashierIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", cashierIds as string[]);
    names = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name]));
  }

  // Kas tunai per shift (untuk hitung expected_cash — HANYA di sisi admin).
  const cashByShift = new Map<string, number>();
  if (shiftIds.length) {
    const { data: txs } = await supabase
      .from("transactions")
      .select("shift_id, total, payment_method")
      .in("shift_id", shiftIds)
      .eq("status", "completed")
      .eq("payment_method", "cash");
    for (const t of txs ?? []) {
      if (!t.shift_id) continue;
      cashByShift.set(t.shift_id, (cashByShift.get(t.shift_id) ?? 0) + Number(t.total));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold">Rekonsiliasi Shift</h1>
        <p className="text-sm text-muted-foreground">
          Bandingkan setoran kasir dengan kas tunai yang seharusnya (ekspektasi).
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Shift ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada shift. Kasir membuka shift lewat app kasir.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kasir</TableHead>
                    <TableHead>Buka</TableHead>
                    <TableHead>Tutup</TableHead>
                    <TableHead className="text-right">Modal Awal</TableHead>
                    <TableHead className="text-right">Setoran</TableHead>
                    <TableHead className="text-right">Ekspektasi</TableHead>
                    <TableHead className="text-right">Selisih</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => {
                    const opening = Number(s.opening_cash);
                    const cashSales = cashByShift.get(s.id) ?? 0;
                    const expected = opening + cashSales;
                    const closed = s.closed_at != null;
                    const closing = s.closing_cash != null ? Number(s.closing_cash) : null;
                    const selisih = closing != null ? closing - expected : null;
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          {s.cashier_id ? names[s.cashier_id] ?? "-" : "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatWaktu(s.opened_at)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {closed ? (
                            <span className="text-muted-foreground">{formatWaktu(s.closed_at)}</span>
                          ) : (
                            <Badge className="bg-primary-light text-primary">Aktif</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatRupiah(opening)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {closing != null ? formatRupiah(closing) : "-"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatRupiah(expected)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {selisih == null ? (
                            "-"
                          ) : selisih === 0 ? (
                            <span className="text-success">Rp 0 (pas)</span>
                          ) : selisih > 0 ? (
                            <span className="text-success">+{formatRupiah(selisih)}</span>
                          ) : (
                            <span className="font-semibold text-danger">
                              {formatRupiah(selisih)}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
