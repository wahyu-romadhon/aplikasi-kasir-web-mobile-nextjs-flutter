import {
  LayoutDashboard,
  Package,
  Tags,
  Boxes,
  ReceiptText,
  History,
  QrCode,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const navItems: NavItem[] = [
  { href: "/", label: "Beranda", icon: LayoutDashboard },
  { href: "/products", label: "Produk", icon: Package },
  { href: "/categories", label: "Kategori", icon: Tags },
  { href: "/stock", label: "Stok", icon: Boxes },
  { href: "/transactions", label: "Transaksi", icon: ReceiptText },
  { href: "/shifts", label: "Shift", icon: History },
  { href: "/payment-methods", label: "Pembayaran", icon: QrCode },
  { href: "/reports", label: "Laporan", icon: BarChart3 },
];
