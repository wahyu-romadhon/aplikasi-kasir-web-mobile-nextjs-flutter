const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/** Format angka ke Rupiah, mis. 15000 → "Rp 15.000". */
export function formatRupiah(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  return rupiah.format(Number.isFinite(n as number) ? (n as number) : 0);
}

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatTanggal(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return dateFmt.format(new Date(value));
}
