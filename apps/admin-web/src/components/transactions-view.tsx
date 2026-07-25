"use client";

import { useState } from "react";
import { Ban, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatRupiah } from "@/lib/format";

type Tx = {
  id: string;
  created_at: string;
  cashier_id: string | null;
  total: number;
  payment_method: string;
  status: string;
  void_reason: string | null;
};
type Item = { product_name: string; price: number; qty: number; subtotal: number };

const METHOD_LABEL: Record<string, string> = {
  cash: "Tunai",
  qris: "QRIS",
  transfer: "Transfer",
  debit: "Debit",
};

function formatWaktu(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function TransactionsView({
  initial,
  cashierNames,
}: {
  initial: Tx[];
  cashierNames: Record<string, string>;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<Tx[]>(initial);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Tx | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [reason, setReason] = useState("");
  const [voiding, setVoiding] = useState(false);

  async function openDetail(tx: Tx) {
    setSelected(tx);
    setItems(null);
    setReason("");
    setOpen(true);
    const { data } = await supabase
      .from("transaction_items")
      .select("product_name, price, qty, subtotal")
      .eq("transaction_id", tx.id);
    setItems(data ?? []);
  }

  async function doVoid() {
    if (!selected) return;
    if (!reason.trim()) {
      toast.error("Isi alasan void dulu");
      return;
    }
    setVoiding(true);
    try {
      const res = await fetch("/api/transactions/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_id: selected.id, reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Gagal void");
      }
      setRows((prev) =>
        prev.map((r) =>
          r.id === selected.id ? { ...r, status: "void", void_reason: reason.trim() } : r,
        ),
      );
      toast.success("Transaksi di-void, stok dikembalikan");
      setOpen(false);
    } catch (err) {
      toast.error("Gagal void", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setVoiding(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold">Riwayat Transaksi</h1>
        <p className="text-sm text-muted-foreground">
          100 transaksi terakhir. Klik untuk detail atau void.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Transaksi ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <Receipt className="size-8" />
              <p className="text-sm">Belum ada transaksi.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Kasir</TableHead>
                    <TableHead>Metode</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap">{formatWaktu(t.created_at)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.cashier_id ? cashierNames[t.cashier_id] ?? "-" : "-"}
                      </TableCell>
                      <TableCell>{METHOD_LABEL[t.payment_method] ?? t.payment_method}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRupiah(t.total)}
                      </TableCell>
                      <TableCell>
                        {t.status === "void" ? (
                          <Badge className="bg-danger/10 text-danger">Void</Badge>
                        ) : (
                          <Badge className="bg-primary-light text-primary">Selesai</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(t)}>
                          Detail
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detail Transaksi</DialogTitle>
            <DialogDescription>
              {selected ? formatWaktu(selected.created_at) : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {items === null ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Memuat…</p>
            ) : (
              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produk</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((it, i) => (
                      <TableRow key={i}>
                        <TableCell>{it.product_name}</TableCell>
                        <TableCell className="text-center tabular-nums">{it.qty}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatRupiah(it.subtotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-lg font-semibold tabular-nums">
                {selected ? formatRupiah(selected.total) : ""}
              </span>
            </div>

            {selected?.status === "void" ? (
              <div className="rounded-lg bg-danger/5 p-3 text-sm">
                <Badge className="bg-danger/10 text-danger">Void</Badge>
                <p className="mt-2 text-muted-foreground">
                  Alasan: {selected.void_reason ?? "-"}
                </p>
              </div>
            ) : (
              <div className="space-y-2 border-t border-border pt-3">
                <label htmlFor="void-reason" className="text-sm font-medium text-danger">
                  Void transaksi
                </label>
                <textarea
                  id="void-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Alasan void (mis. salah input, barang batal)…"
                  rows={2}
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={doVoid}
                  disabled={voiding}
                >
                  <Ban />
                  {voiding ? "Memproses…" : "Void Transaksi (kembalikan stok)"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
