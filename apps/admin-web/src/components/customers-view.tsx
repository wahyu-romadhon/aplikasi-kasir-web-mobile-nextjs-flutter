"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, MoreVertical, Store as StoreIcon, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export type Customer = {
  storeId: string;
  storeName: string;
  createdAt: string;
  ownerName: string;
  ownerEmail: string;
  licenseId: string | null;
  status: string | null;
  plan: string | null;
  validUntil: string | null;
  licenseKey: string | null;
  isVendor: boolean;
};

function daysLeft(validUntil: string | null): number | null {
  if (!validUntil) return null;
  return Math.ceil((new Date(validUntil).getTime() - Date.now()) / 86_400_000);
}

function statusInfo(c: Customer): { label: string; cls: string } {
  if (c.isVendor) return { label: "Vendor", cls: "bg-[#1F2421] text-white" };
  const d = daysLeft(c.validUntil);
  if (c.status === "suspended") return { label: "Suspended", cls: "bg-danger/10 text-danger" };
  if (d != null && d < 0) return { label: "Expired", cls: "bg-danger/10 text-danger" };
  if (c.status === "trial") return { label: "Trial", cls: "bg-[#F6E9E2] text-secondary" };
  return { label: "Aktif", cls: "bg-primary-light text-primary" };
}

const emptyForm = {
  store_name: "",
  owner_name: "",
  owner_email: "",
  owner_password: "",
  license_type: "trial" as "trial" | "active",
  trial_days: "3",
};

const emptyEdit = { store_id: "", store_name: "", owner_name: "", owner_email: "", owner_password: "" };

export function CustomersView({ initial }: { initial: Customer[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(emptyEdit);
  const [editing, setEditing] = useState(false);

  const customers = initial.filter((c) => !c.isVendor);
  const total = customers.length;
  const aktif = customers.filter((c) => statusInfo(c).label === "Aktif").length;
  const trial = customers.filter((c) => statusInfo(c).label === "Trial").length;
  const expired = customers.filter((c) => ["Expired", "Suspended"].includes(statusInfo(c).label)).length;

  async function act(c: Customer, action: string, days?: number) {
    if (!c.licenseId) {
      toast.error("Pelanggan ini belum punya lisensi");
      return;
    }
    setBusy(c.storeId);
    try {
      const res = await fetch("/api/vendor/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ license_id: c.licenseId, action, days }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Gagal");
      }
      toast.success("Lisensi diperbarui");
      router.refresh();
    } catch (err) {
      toast.error("Gagal", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  async function addCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!form.store_name.trim() || !form.owner_email.trim() || !form.owner_password) {
      toast.error("Nama toko, email, dan password wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/vendor/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, trial_days: parseInt(form.trial_days, 10) || 3 }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Gagal");
      }
      toast.success("Pelanggan ditambahkan");
      setOpen(false);
      setForm(emptyForm);
      router.refresh();
    } catch (err) {
      toast.error("Gagal menambah pelanggan", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  function openEdit(c: Customer) {
    setEditForm({
      store_id: c.storeId,
      store_name: c.storeName,
      owner_name: c.ownerName === "-" ? "" : c.ownerName,
      owner_email: c.ownerEmail === "-" ? "" : c.ownerEmail,
      owner_password: "",
    });
    setEditOpen(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditing(true);
    try {
      const res = await fetch("/api/vendor/customer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Gagal");
      }
      toast.success("Data pelanggan diperbarui");
      setEditOpen(false);
      router.refresh();
    } catch (err) {
      toast.error("Gagal memperbarui", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setEditing(false);
    }
  }

  async function deleteCustomer(c: Customer) {
    if (
      !window.confirm(
        `Hapus pelanggan "${c.storeName}"?\nAkun owner, toko, produk, dan transaksinya akan IKUT TERHAPUS permanen.`,
      )
    )
      return;
    setBusy(c.storeId);
    try {
      const res = await fetch("/api/vendor/customer", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: c.storeId }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Gagal");
      }
      toast.success("Pelanggan dihapus");
      router.refresh();
    } catch (err) {
      toast.error("Gagal menghapus", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold">Kelola Pelanggan</h1>
          <p className="text-sm text-muted-foreground">
            Semua toko yang memakai KasirKu beserta status lisensinya.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <UserPlus />
          Tambah Pelanggan
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Pelanggan", value: total, cls: "text-foreground" },
          { label: "Aktif", value: aktif, cls: "text-primary" },
          { label: "Trial", value: trial, cls: "text-secondary" },
          { label: "Expired / Suspend", value: expired, cls: "text-danger" },
        ].map((s) => (
          <Card key={s.label} className="shadow-sm">
            <CardContent className="py-5">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-semibold tabular-nums ${s.cls}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardContent className="pt-6">
          {initial.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <StoreIcon className="size-8" />
              <p className="text-sm">Belum ada pelanggan. Klik “Tambah Pelanggan”.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Toko / Owner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Berlaku s/d</TableHead>
                    <TableHead className="text-right">Sisa</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initial.map((c) => {
                    const info = statusInfo(c);
                    const d = daysLeft(c.validUntil);
                    const soon = d != null && d >= 0 && d <= 7;
                    return (
                      <TableRow key={c.storeId}>
                        <TableCell>
                          <div className="font-medium">{c.storeName}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.ownerName} · {c.ownerEmail}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={info.cls}>{info.label}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.isVendor ? "—" : formatTanggal(c.validUntil)}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.isVendor ? (
                            <span className="text-muted-foreground">∞ Abadi</span>
                          ) : d == null ? (
                            "-"
                          ) : d < 0 ? (
                            <span className="font-semibold text-danger">habis</span>
                          ) : (
                            <span
                              className={
                                soon
                                  ? "rounded-md bg-warning/10 px-2 py-0.5 font-semibold tabular-nums text-warning"
                                  : "tabular-nums"
                              }
                            >
                              {d} hari
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {!c.isVendor && (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Edit data"
                                onClick={() => openEdit(c)}
                              >
                                <Pencil />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      title="Kelola lisensi"
                                      disabled={busy === c.storeId}
                                    />
                                  }
                                >
                                  <MoreVertical />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Lisensi</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => act(c, "extend", 7)}>
                                    Perpanjang 7 hari
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => act(c, "extend", 30)}>
                                    Perpanjang 30 hari
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => act(c, "extend", 365)}>
                                    Perpanjang 1 tahun
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => act(c, "trial", 3)}>
                                    Set Trial 3 hari
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => act(c, "suspend")}>
                                    Suspend
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Hapus pelanggan"
                                className="text-danger hover:text-danger"
                                onClick={() => deleteCustomer(c)}
                              >
                                <Trash2 />
                              </Button>
                            </div>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={addCustomer}>
            <DialogHeader>
              <DialogTitle>Tambah Pelanggan</DialogTitle>
              <DialogDescription>
                Membuat toko + akun owner + lisensi sekaligus.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="c-store">Nama Toko</Label>
                <Input
                  id="c-store"
                  value={form.store_name}
                  onChange={(e) => setForm({ ...form, store_name: e.target.value })}
                  placeholder="mis. Warung Bu Ani"
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-owner">Nama Owner</Label>
                <Input
                  id="c-owner"
                  value={form.owner_name}
                  onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                  placeholder="mis. Bu Ani"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-email">Email Owner (untuk login)</Label>
                <Input
                  id="c-email"
                  type="email"
                  value={form.owner_email}
                  onChange={(e) => setForm({ ...form, owner_email: e.target.value })}
                  placeholder="owner@toko.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-pass">Password</Label>
                <Input
                  id="c-pass"
                  value={form.owner_password}
                  onChange={(e) => setForm({ ...form, owner_password: e.target.value })}
                  placeholder="min. 6 karakter"
                  required
                />
              </div>

              {/* Tipe lisensi + masa berlaku */}
              <div className="space-y-2">
                <Label>Tipe Langganan</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["trial", "Trial"],
                      ["active", "Aktif (berbayar)"],
                    ] as ["trial" | "active", string][]
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          license_type: val,
                          trial_days: val === "trial" ? "3" : "30",
                        })
                      }
                      className={
                        "rounded-lg border px-3 py-2 text-sm font-medium transition-colors " +
                        (form.license_type === val
                          ? "border-primary bg-primary-light text-primary"
                          : "border-input text-muted-foreground hover:bg-muted")
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-days">Masa berlaku (hari)</Label>
                <Input
                  id="c-days"
                  type="number"
                  min="1"
                  value={form.trial_days}
                  onChange={(e) => setForm({ ...form, trial_days: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Membuat…" : "Buat Pelanggan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit pelanggan */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={saveEdit}>
            <DialogHeader>
              <DialogTitle>Edit Pelanggan</DialogTitle>
              <DialogDescription>
                Ubah data toko/owner. Kosongkan password bila tak ingin menggantinya.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="e-store">Nama Toko</Label>
                <Input
                  id="e-store"
                  value={editForm.store_name}
                  onChange={(e) => setEditForm({ ...editForm, store_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-owner">Nama Owner</Label>
                <Input
                  id="e-owner"
                  value={editForm.owner_name}
                  onChange={(e) => setEditForm({ ...editForm, owner_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-email">Email Owner</Label>
                <Input
                  id="e-email"
                  type="email"
                  value={editForm.owner_email}
                  onChange={(e) => setEditForm({ ...editForm, owner_email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-pass">Password Baru (opsional)</Label>
                <Input
                  id="e-pass"
                  value={editForm.owner_password}
                  onChange={(e) => setEditForm({ ...editForm, owner_password: e.target.value })}
                  placeholder="biarkan kosong = tetap"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={editing}>
                {editing ? "Menyimpan…" : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
