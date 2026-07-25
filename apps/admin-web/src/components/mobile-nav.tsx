"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Store, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "@/components/nav-items";
import { LogoutButton } from "@/components/logout-button";

export function MobileNav({
  storeName,
  isSuperAdmin,
}: {
  storeName: string;
  isSuperAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  // Kunci scroll body saat drawer terbuka.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const drawer = (
    <div className="fixed inset-0 z-100 md:hidden">
      <button
        aria-label="Tutup menu"
        className="absolute inset-0 bg-black/50"
        onClick={() => setOpen(false)}
      />
      <div className="absolute inset-y-0 left-0 flex w-72 max-w-[82%] flex-col bg-surface shadow-2xl">
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            K
          </div>
          <span className="font-semibold">KasirKu</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Tutup"
            className="ml-auto flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            );
          })}
          {isSuperAdmin && (
            <div className="mt-2 border-t border-border pt-2">
              <Link
                href="/vendor"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-secondary hover:bg-muted"
              >
                <ShieldCheck className="size-5" />
                Panel Vendor
              </Link>
            </div>
          )}
        </nav>

        <div className="shrink-0 space-y-3 border-t border-border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Store className="size-3.5" />
            <span className="truncate">{storeName}</span>
          </div>
          <LogoutButton />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buka menu"
        className="flex size-9 items-center justify-center rounded-lg text-foreground hover:bg-muted md:hidden"
      >
        <Menu className="size-5" />
      </button>
      {mounted && open && createPortal(drawer, document.body)}
    </>
  );
}
