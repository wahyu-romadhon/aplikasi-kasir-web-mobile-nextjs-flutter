"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Wallet, Receipt, TrendingUp, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatRupiah, formatTanggal } from "@/lib/format";

type DayRow = { key: string; count: number; total: number };

const METHOD_LABEL: Record<string, string> = {
  cash: "Tunai",
  qris: "QRIS",
  transfer: "Transfer",
  debit: "Debit",
};

function compact(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + " M";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + " jt";
  if (n >= 1e3) return Math.round(n / 1e3) + " rb";
  return String(Math.round(n));
}

export function ReportsView({
  days,
  totalOmzet,
  txCount,
  avg,
  today,
  chart,
  table,
  methods,
}: {
  days: number;
  totalOmzet: number;
  txCount: number;
  avg: number;
  today: { count: number; total: number };
  chart: { key: string; label: string; total: number }[];
  table: DayRow[];
  methods: { method: string; total: number }[];
}) {
  const stats = [
    {
      label: "Omzet Hari Ini",
      value: formatRupiah(today.total),
      sub: `${today.count} transaksi`,
      icon: Wallet,
      tint: "bg-primary-light text-primary",
    },
    {
      label: `Omzet ${days} Hari`,
      value: formatRupiah(totalOmzet),
      sub: `${txCount} transaksi`,
      icon: TrendingUp,
      tint: "bg-[#EAF3E1] text-success",
    },
    {
      label: "Rata-rata / Transaksi",
      value: formatRupiah(avg),
      sub: `dari ${txCount} transaksi`,
      icon: Receipt,
      tint: "bg-[#F6E9E2] text-secondary",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold">Laporan Penjualan</h1>
        <p className="text-sm text-muted-foreground">
          Ringkasan omzet {days} hari terakhir.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(({ label, value, sub, icon: Icon, tint }) => (
          <Card key={label} className="shadow-sm">
            <CardContent className="flex items-center gap-4 py-5">
              <div className={`flex size-11 items-center justify-center rounded-xl ${tint}`}>
                <Icon className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="truncate text-xl font-semibold tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Omzet Harian (14 hari terakhir)</CardTitle>
        </CardHeader>
        <CardContent>
          {txCount === 0 ? (
            <EmptyState />
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E3E1D9" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "#5F5E5A" }}
                  />
                  <YAxis
                    tickFormatter={(v) => compact(Number(v))}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tick={{ fontSize: 12, fill: "#5F5E5A" }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(15,110,86,0.06)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as { label: string; total: number };
                      return (
                        <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-md">
                          <div className="font-medium">{p.label}</div>
                          <div className="tabular-nums text-primary">
                            {formatRupiah(p.total)}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="total" fill="#0F6E56" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {methods.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {methods.map(({ method, total }) => (
            <Badge key={method} className="bg-primary-light text-primary">
              {METHOD_LABEL[method] ?? method}: {formatRupiah(total)}
            </Badge>
          ))}
        </div>
      )}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Rincian per Hari</CardTitle>
        </CardHeader>
        <CardContent>
          {table.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="text-right">Transaksi</TableHead>
                    <TableHead className="text-right">Omzet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {table.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="font-medium">{formatTanggal(r.key)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRupiah(r.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
      <CalendarDays className="size-8" />
      <p className="text-sm">Belum ada transaksi pada periode ini.</p>
      <p className="text-xs">Transaksi dari app kasir akan muncul di sini setelah tersinkron.</p>
    </div>
  );
}
