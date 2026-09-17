"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Wrench,
  CreditCard,
  Building2,
  Settings,
  BarChart3,
  DollarSign,
  LogOut,
  ChevronLeft,
  Menu,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Bosh", icon: LayoutDashboard },
  { href: "/rentals", label: "Arendalar", icon: ClipboardList },
  { href: "/clients", label: "Mijozlar", icon: Users },
  { href: "/equipment", label: "Jihozlar", icon: Wrench },
  { href: "/payments", label: "To'lovlar", icon: CreditCard },
  { href: "/debts", label: "Qarzlar", icon: DollarSign },
];

const adminNavItems = [
  { href: "/workers", label: "Xodimlar", icon: Users },
  { href: "/categories", label: "Kategoriyalar", icon: Building2 },
  { href: "/settings", label: "Sozlamalar", icon: Settings },
  { href: "/reports", label: "Hisobot", icon: BarChart3 },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, isAdmin } = useAuth();

  const [showMenu, setShowMenu] = React.useState(false);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const allNavItems = isAdmin ? [...navItems, ...adminNavItems] : navItems;

  return (
    /*
      Ustun: header + kontent + pastki navigatsiya.
      Balandlik `--app-height` orqali — Telegram bergan haqiqiy balandlik.
      Kontent `max-w-lg` bilan markazlashtirilgan: Telegram Desktop oynasi
      keng bo'lganda kontent cho'zilib ketmaydi va pastki navigatsiya bilan
      bir tekisda turadi (ilgari navigatsiya markazda, kontent esa butun
      kenglikda edi — shu sabab layout "siljigan" ko'rinardi).
    */
    <div
      className="flex flex-col"
      style={{ minHeight: "var(--app-height)" }}
    >
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-3 pt-[calc(0.75rem+var(--safe-top))]">
        <div className="flex items-center gap-2">
          {/*
            Menyu tugmasi HAR DOIM ko'rinadi. Ilgari `md:hidden` edi: Telegram
            Desktop oynasi keng (>=768px) bo'lganda tugma yo'qolardi, pastki
            navigatsiyada esa faqat 6 ta umumiy bo'lim bor — ya'ni admin
            "Xodimlar", "Sozlamalar", "Kategoriyalar" va "Hisobot" ga
            umuman o'ta olmasdi.
          */}
          <button
            onClick={() => setShowMenu(!showMenu)}
            aria-label="Menyu"
            className="-ml-1 p-1"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-semibold">
            {allNavItems.find((i) => pathname.startsWith(i.href))?.label || "Lesa Lego"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {user.name} ({user.role === "ADMIN" ? "Admin" : "Xodim"})
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Mobile menu dropdown */}
      {showMenu && (
        <div className="fixed inset-0 z-20 bg-black/50" onClick={() => setShowMenu(false)}>
          <div className="fixed left-0 top-14 bottom-16 w-60 max-w-[80vw] overflow-y-auto bg-background border-r p-4 space-y-1" onClick={(e) => e.stopPropagation()}>
            {allNavItems.map((item) => (
              <button
                key={item.href}
                onClick={() => { router.push(item.href); setShowMenu(false); }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  pathname.startsWith(item.href)
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
            <Separator className="my-2" />
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {user?.name} ({user?.role})
            </div>
          </div>
        </div>
      )}

      {/* Main content — pastki navigatsiya balandligi + xavfsiz zona qadar joy */}
      <main className="flex-1 w-full max-w-lg mx-auto pb-[calc(4rem+var(--safe-bottom))]">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t bg-background pb-[var(--safe-bottom)]">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`flex flex-col items-center gap-0.5 py-2 px-3 text-[10px] transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
