"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Tags,
  BarChart3,
  ReceiptText,
  Boxes,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Beranda", icon: LayoutDashboard },
  { href: "/products", label: "Produk", icon: Package },
  { href: "/categories", label: "Kategori", icon: Tags },
  { href: "/stock", label: "Stok", icon: Boxes },
  { href: "/transactions", label: "Transaksi", icon: ReceiptText },
  { href: "/shifts", label: "Shift", icon: History },
  { href: "/reports", label: "Laporan", icon: BarChart3 },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={cn(
              "flex h-11 items-center text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span className="flex w-16 shrink-0 items-center justify-center">
              <Icon className="size-5" />
            </span>
            <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
