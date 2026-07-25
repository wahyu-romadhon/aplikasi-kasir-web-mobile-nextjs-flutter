"use client";

import { useRef, useState } from "react";
import { Plus, Trash2, QrCode, ImageIcon, Power, PowerOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { compressImage, uploadProductImage } from "@/lib/image";

type Method = {
  id: string;
  label: string;
  image_url: string;
  is_active: boolean;
  sort_order: number;
};

export function PaymentMethodsManager({
  storeId,
  initial,
  tableMissing,
}: {
  storeId: string;
  initial: Method[];
  tableMissing: boolean;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<Method[]>(initial);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function reload() {
    const { data } = await supabase
      .from("store_payment_methods")
      .select("id, label, image_url, is_active, sort_order")
      .order("sort_order")
      .order("created_at");
    setRows(data ?? []);
  }

  function openAdd() {
    setLabel("");
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
    setOpen(true);
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // QRIS harus tetap tajam agar bisa di-scan → kompresi lembut.
      const compressed = await compressImage(file, { maxSize: 800, quality: 0.85 });
      setImageFile(compressed);
      setImagePreview(URL.createObjectURL(compressed));
    } catch (err) {
      toast.error("Gagal memproses gambar", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      toast.error("Nama metode wajib diisi");
      return;
    }
    if (!imageFile) {
      toast.error("Upload gambar QRIS dulu");
      return;
    }
    setSaving(true);
    try {
      const url = await uploadProductImage(imageFile);
      const { error } = await supabase.from("store_payment_methods").insert({
        store_id: storeId,
        label: label.trim(),
        image_url: url,
        sort_order: rows.length,
      });
      if (error) throw new Error(error.message);
      toast.success("Metode pembayaran ditambahkan");
      setOpen(false);
      reload();
    } catch (err) {
      toast.error("Gagal menyimpan", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(m: Method) {
    const { error } = await supabase
      .from("store_payment_methods")
      .update({ is_active: !m.is_active })
      .eq("id", m.id);
    if (error) {
      toast.error("Gagal", { description: error.message });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === m.id ? { ...r, is_active: !r.is_active } : r)));
  }

  async function handleDelete(m: Method) {
    if (!window.confirm(`Hapus metode "${m.label}"?`)) return;
    const { error } = await supabase.from("store_payment_methods").delete().eq("id", m.id);
    if (error) {
      toast.error("Gagal menghapus", { description: error.message });
      return;
    }
    toast.success("Metode dihapus");
    setRows((prev) => prev.filter((r) => r.id !== m.id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold">Metode Pembayaran</h1>
          <p className="text-sm text-muted-foreground">
            Upload QRIS/e-wallet toko. Kasir akan menampilkannya ke pembeli saat bayar.
          </p>
        </div>
        <Button onClick={openAdd} disabled={tableMissing}>
          <Plus />
          Tambah QRIS
        </Button>
      </div>

      {tableMissing && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          Tabel <code>store_payment_methods</code> belum ada. Jalankan migration{" "}
          <code>00002_payment_methods.sql</code> di Supabase dulu, lalu muat ulang halaman ini.
        </div>
      )}

      {rows.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <QrCode className="size-8" />
            <p className="text-sm">Belum ada metode pembayaran. Klik “Tambah QRIS”.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((m) => (
            <Card key={m.id} className="shadow-sm">
              <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base">{m.label}</CardTitle>
                {m.is_active ? (
                  <Badge className="bg-primary-light text-primary">Aktif</Badge>
                ) : (
                  <Badge className="bg-muted text-muted-foreground">Nonaktif</Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.image_url}
                  alt={m.label}
                  className="mx-auto aspect-square w-full max-w-52 rounded-lg border border-border object-contain"
                />
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title={m.is_active ? "Nonaktifkan" : "Aktifkan"}
                    className={m.is_active ? "text-primary" : "text-muted-foreground"}
                    onClick={() => toggleActive(m)}
                  >
                    {m.is_active ? <Power /> : <PowerOff />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Hapus"
                    className="text-danger hover:text-danger"
                    onClick={() => handleDelete(m)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>Tambah QRIS / E-wallet</DialogTitle>
              <DialogDescription>
                Beri nama & upload gambar QRIS. Pakai gambar jelas agar mudah di-scan.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="pm-label">Nama Metode</Label>
                <Input
                  id="pm-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="mis. QRIS Merchant / GoPay / DANA"
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Gambar QRIS</Label>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex aspect-square w-full max-w-52 items-center justify-center overflow-hidden rounded-lg border border-dashed border-input bg-muted/40 text-muted-foreground transition-colors hover:border-ring"
                >
                  {imagePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imagePreview} alt="" className="size-full object-contain" />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <ImageIcon className="size-7" />
                      <span className="text-xs">Pilih gambar QRIS</span>
                    </div>
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan…" : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
