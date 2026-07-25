"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, Pencil, Trash2, ImageIcon, X } from "lucide-react";
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
import { formatRupiah } from "@/lib/format";
import { compressImage, uploadProductImage } from "@/lib/image";

type Category = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  price: number;
  cost_price: number;
  stock: number;
  sku: string | null;
  barcode: string | null;
  is_active: boolean;
  category_id: string | null;
  image_url: string | null;
};

const emptyForm = {
  name: "",
  category_id: "",
  price: "",
  cost_price: "",
  stock: "0",
  sku: "",
  barcode: "",
  is_active: true,
};

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ProductsManager({
  storeId,
  initial,
  categories,
  productLimit,
  planLabel,
}: {
  storeId: string;
  initial: Product[];
  categories: Category[];
  productLimit?: number | null;
  planLabel?: string;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<Product[]>(initial);
  const atLimit = productLimit != null && rows.length >= productLimit;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Gambar
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const categoryName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? map.get(id) ?? "-" : "-");
  }, [categories]);

  async function reload() {
    const { data } = await supabase
      .from("products")
      .select("id, name, price, cost_price, stock, sku, barcode, is_active, category_id, image_url")
      .order("name");
    setRows(data ?? []);
  }

  function resetImage() {
    setImageUrl(null);
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function openCreate() {
    if (atLimit) {
      toast.error(`Batas produk akun ${planLabel} tercapai (${productLimit})`, {
        description: "Upgrade ke langganan berbayar untuk menambah lebih banyak produk.",
      });
      return;
    }
    setEditing(null);
    setForm(emptyForm);
    resetImage();
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      category_id: p.category_id ?? "",
      price: String(p.price),
      cost_price: String(p.cost_price),
      stock: String(p.stock),
      sku: p.sku ?? "",
      barcode: p.barcode ?? "",
      is_active: p.is_active,
    });
    setImageUrl(p.image_url);
    setImageFile(null);
    setImagePreview(p.image_url);
    setOpen(true);
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, { maxSize: 500, quality: 0.7 });
      setImageFile(compressed);
      setImagePreview(URL.createObjectURL(compressed));
      const kb = Math.round(compressed.size / 1024);
      toast.success(`Gambar siap (${kb} KB)`);
    } catch (err) {
      toast.error("Gagal memproses gambar", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Harga jual tidak valid");
      return;
    }
    if (!editing && productLimit != null && rows.length >= productLimit) {
      toast.error(`Batas produk akun ${planLabel} tercapai (${productLimit})`);
      return;
    }
    setSaving(true);
    try {
      let finalImageUrl = imageUrl;
      if (imageFile) {
        finalImageUrl = await uploadProductImage(imageFile);
      }
      const payload = {
        store_id: storeId,
        name: form.name.trim(),
        category_id: form.category_id || null,
        price,
        cost_price: Number(form.cost_price) || 0,
        stock: parseInt(form.stock, 10) || 0,
        sku: form.sku.trim() || null,
        barcode: form.barcode.trim() || null,
        is_active: form.is_active,
        image_url: finalImageUrl,
      };
      const { error } = editing
        ? await supabase.from("products").update(payload).eq("id", editing.id)
        : await supabase.from("products").insert(payload);
      if (error) throw new Error(error.message);
      toast.success(editing ? "Produk diperbarui" : "Produk ditambahkan");
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

  async function handleDelete(p: Product) {
    if (!window.confirm(`Hapus produk "${p.name}"?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) {
      toast.error("Gagal menghapus", { description: error.message });
      return;
    }
    toast.success("Produk dihapus");
    reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold">Produk</h1>
          <p className="text-sm text-muted-foreground">
            Kelola daftar produk, harga, stok, dan gambar.
          </p>
        </div>
        <Button onClick={openCreate} disabled={atLimit}>
          <Plus />
          Tambah Produk
        </Button>
      </div>

      {productLimit != null && (
        <div
          className={
            "rounded-xl border px-4 py-3 text-sm " +
            (atLimit
              ? "border-warning/30 bg-warning/10"
              : "border-border bg-muted/40")
          }
        >
          Akun <strong>{planLabel}</strong> dibatasi maksimal{" "}
          <strong>{productLimit} produk</strong> — terpakai {rows.length}/{productLimit}.
          {atLimit && " Batas tercapai. Upgrade ke langganan berbayar untuk menambah lagi."}
        </div>
      )}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Daftar Produk ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada produk. Klik “Tambah Produk”.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produk</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-right">Harga Jual</TableHead>
                    <TableHead className="text-right">Modal</TableHead>
                    <TableHead className="text-right">Stok</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Thumb url={p.image_url} />
                          <span className="font-medium">{p.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {categoryName(p.category_id)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRupiah(p.price)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatRupiah(p.cost_price)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.stock}</TableCell>
                      <TableCell>
                        {p.is_active ? (
                          <Badge className="bg-primary-light text-primary">Aktif</Badge>
                        ) : (
                          <Badge className="bg-muted text-muted-foreground">Nonaktif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(p)}>
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-danger hover:text-danger"
                            onClick={() => handleDelete(p)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
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
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Produk" : "Tambah Produk"}</DialogTitle>
              <DialogDescription>Isi detail produk di bawah ini.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Gambar */}
              <div className="space-y-2">
                <Label>Gambar Produk</Label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-input bg-muted/40 text-muted-foreground transition-colors hover:border-ring"
                  >
                    {imagePreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imagePreview} alt="" className="size-full object-cover" />
                    ) : (
                      <ImageIcon className="size-6" />
                    )}
                  </button>
                  <div className="space-y-1 text-sm">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                    >
                      {imagePreview ? "Ganti Gambar" : "Pilih Gambar"}
                    </Button>
                    {imagePreview && (
                      <button
                        type="button"
                        onClick={resetImage}
                        className="ml-2 inline-flex items-center gap-1 text-xs text-danger"
                      >
                        <X className="size-3" /> Hapus
                      </button>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Otomatis dikompres kecil (WebP).
                    </p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="p-name">Nama Produk</Label>
                <Input
                  id="p-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="mis. Es Teh Manis"
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="p-category">Kategori</Label>
                <select
                  id="p-category"
                  className={selectClass}
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                >
                  <option value="">— Tanpa kategori —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="p-price">Harga Jual (Rp)</Label>
                  <Input
                    id="p-price"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="0"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-cost">Harga Modal (Rp)</Label>
                  <Input
                    id="p-cost"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={form.cost_price}
                    onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="p-stock">Stok</Label>
                  <Input
                    id="p-stock"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-sku">SKU (opsional)</Label>
                  <Input
                    id="p-sku"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="mis. ES-001"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Produk aktif (tampil di kasir)
              </label>
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

function Thumb({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <ImageIcon className="size-4" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="size-10 rounded-md border border-border object-cover" />
  );
}
