"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

type Category = { id: string; name: string; created_at: string };

export function CategoriesManager({
  storeId,
  initial,
  categoryLimit,
  planLabel,
}: {
  storeId: string;
  initial: Category[];
  categoryLimit?: number | null;
  planLabel?: string;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<Category[]>(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const atLimit = categoryLimit != null && rows.length >= categoryLimit;

  async function reload() {
    const { data } = await supabase
      .from("categories")
      .select("id, name, created_at")
      .order("name");
    setRows(data ?? []);
  }

  function openCreate() {
    if (atLimit) {
      toast.error(`Batas kategori akun ${planLabel} tercapai (${categoryLimit})`, {
        description: "Upgrade ke langganan berbayar untuk menambah lebih banyak.",
      });
      return;
    }
    setEditing(null);
    setName("");
    setOpen(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setName(c.name);
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!editing && categoryLimit != null && rows.length >= categoryLimit) {
      toast.error(`Batas kategori akun ${planLabel} tercapai (${categoryLimit})`);
      return;
    }
    setSaving(true);
    const { error } = editing
      ? await supabase.from("categories").update({ name: trimmed }).eq("id", editing.id)
      : await supabase.from("categories").insert({ store_id: storeId, name: trimmed });
    setSaving(false);
    if (error) {
      toast.error("Gagal menyimpan", { description: error.message });
      return;
    }
    toast.success(editing ? "Kategori diperbarui" : "Kategori ditambahkan");
    setOpen(false);
    reload();
  }

  async function handleDelete(c: Category) {
    // Cegah hapus kategori yang masih dipakai produk.
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("category_id", c.id);
    if ((count ?? 0) > 0) {
      toast.error("Tidak bisa dihapus", {
        description: `Masih ada ${count} produk memakai kategori "${c.name}". Pindahkan atau hapus produk itu dulu.`,
      });
      return;
    }

    if (!window.confirm(`Hapus kategori "${c.name}"?`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) {
      toast.error("Gagal menghapus", { description: error.message });
      return;
    }
    toast.success("Kategori dihapus");
    reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold">Kategori</h1>
          <p className="text-sm text-muted-foreground">
            Kelompokkan produk agar mudah dicari.
          </p>
        </div>
        <Button onClick={openCreate} disabled={atLimit}>
          <Plus />
          Tambah Kategori
        </Button>
      </div>

      {categoryLimit != null && (
        <div
          className={
            "rounded-xl border px-4 py-3 text-sm " +
            (atLimit
              ? "border-warning/30 bg-warning/10"
              : "border-border bg-muted/40")
          }
        >
          Akun <strong>{planLabel}</strong> dibatasi maksimal{" "}
          <strong>{categoryLimit} kategori</strong> — terpakai {rows.length}/{categoryLimit}.
          {atLimit && " Batas tercapai. Upgrade untuk menambah lagi."}
        </div>
      )}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Daftar Kategori ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada kategori. Klik “Tambah Kategori”.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(c)}>
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-danger hover:text-danger"
                          onClick={() => handleDelete(c)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Kategori" : "Tambah Kategori"}</DialogTitle>
              <DialogDescription>
                Nama kategori untuk mengelompokkan produk.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="cat-name">Nama Kategori</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="mis. Minuman"
                autoFocus
                required
              />
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
