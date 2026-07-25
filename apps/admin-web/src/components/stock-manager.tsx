"use client";

import { useState } from "react";
import { AlertTriangle, PackagePlus, ArrowDownUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatTanggal } from "@/lib/format";

export const LOW_STOCK_THRESHOLD = 5;

type Product = { id: string; name: string; stock: number; store_id: string; is_active: boolean };
type Movement = {
  id: string;
  product_id: string;
  type: string;
  qty: number;
  note: string | null;
  created_at: string;
};

const MOVE_LABEL: Record<string, string> = {
  in: "Masuk",
  out: "Keluar",
  adjustment: "Opname",
  sale: "Penjualan",
};

type Mode = "in" | "out" | "adjustment";

export function StockManager({
  initial,
  movements,
  productNames,
  lowCount,
}: {
  initial: Product[];
  movements: Movement[];
  productNames: Record<string, string>;
  lowCount: number;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<Product[]>(initial);
  const [moves, setMoves] = useState<Movement[]>(movements);
  const [names, setNames] = useState(productNames);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Product | null>(null);
  const [mode, setMode] = useState<Mode>("in");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const low = rows.filter((p) => p.stock <= LOW_STOCK_THRESHOLD);

  function openAdjust(p: Product) {
    setTarget(p);
    setMode("in");
    setQty("");
    setNote("");
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    const n = parseInt(qty, 10);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Jumlah tidak valid");
      return;
    }
    const current = target.stock;
    let newStock: number;
    if (mode === "in") newStock = current + n;
    else if (mode === "out") newStock = Math.max(0, current - n);
    else newStock = n; // opname = set absolut
    const delta = newStock - current;

    setSaving(true);
    try {
      const { error: e1 } = await supabase
        .from("products")
        .update({ stock: newStock })
        .eq("id", target.id);
      if (e1) throw new Error(e1.message);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: mv, error: e2 } = await supabase
        .from("stock_movements")
        .insert({
          store_id: target.store_id,
          product_id: target.id,
          type: mode,
          qty: delta,
          note: note.trim() || MOVE_LABEL[mode],
          created_by: user?.id ?? null,
        })
        .select("id, product_id, type, qty, note, created_at")
        .single();
      if (e2) throw new Error(e2.message);

      setRows((prev) =>
        prev
          .map((p) => (p.id === target.id ? { ...p, stock: newStock } : p))
          .sort((a, b) => a.stock - b.stock),
      );
      if (mv) setMoves((prev) => [mv, ...prev].slice(0, 20));
      setNames((prev) => ({ ...prev, [target.id]: target.name }));
      toast.success("Stok disesuaikan");
      setOpen(false);
    } catch (err) {
      toast.error("Gagal menyesuaikan stok", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold">Kelola Stok</h1>
        <p className="text-sm text-muted-foreground">
          Sesuaikan stok (barang masuk, keluar, opname) dan pantau stok menipis.
        </p>
      </div>

      {lowCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          <AlertTriangle className="size-5 text-warning" />
          <span>
            <strong>{lowCount} produk</strong> stoknya menipis (≤ {LOW_STOCK_THRESHOLD}). Segera
            tambah stok.
          </span>
        </div>
      )}

      {low.length > 0 && (
        <Card className="border-warning/30 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-warning">Stok Menipis</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {low.map((p) => (
              <Badge key={p.id} className="bg-warning/10 text-warning">
                {p.name}: {p.stock}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Semua Produk ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Stok</TableHead>
                  <TableHead className="w-32 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => {
                  const isLow = p.stock <= LOW_STOCK_THRESHOLD;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            isLow
                              ? "rounded-md bg-warning/10 px-2 py-0.5 font-semibold tabular-nums text-warning"
                              : "tabular-nums"
                          }
                        >
                          {p.stock}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openAdjust(p)}>
                          <ArrowDownUp />
                          Sesuaikan
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Mutasi Stok Terakhir</CardTitle>
        </CardHeader>
        <CardContent>
          {moves.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Belum ada mutasi.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Produk</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Catatan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {moves.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatTanggal(m.created_at)}
                      </TableCell>
                      <TableCell>{names[m.product_id] ?? "-"}</TableCell>
                      <TableCell>{MOVE_LABEL[m.type] ?? m.type}</TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${
                          m.qty < 0 ? "text-danger" : "text-success"
                        }`}
                      >
                        {m.qty > 0 ? `+${m.qty}` : m.qty}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{m.note ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>Sesuaikan Stok</DialogTitle>
              <DialogDescription>
                {target?.name} — stok sekarang: <strong>{target?.stock}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["in", "Tambah"],
                    ["out", "Kurangi"],
                    ["adjustment", "Opname"],
                  ] as [Mode, string][]
                ).map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors " +
                      (mode === m
                        ? "border-primary bg-primary-light text-primary"
                        : "border-input text-muted-foreground hover:bg-muted")
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="qty">
                  {mode === "adjustment" ? "Stok sebenarnya (hasil hitung)" : "Jumlah"}
                </Label>
                <Input
                  id="qty"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">Catatan (opsional)</Label>
                <Input
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="mis. kulakan, barang rusak, stok opname"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                <PackagePlus />
                {saving ? "Menyimpan…" : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
