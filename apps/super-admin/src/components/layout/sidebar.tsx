"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Package,
  Bot,
  BarChart3,
  Settings,
  Wallet,
  ChevronLeft,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/branding/wordmark";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/ui-store";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tenants", label: "Tenants", icon: Building2 },
  { href: "/planes", label: "Planes", icon: CreditCard },
  { href: "/suscripciones", label: "Suscripciones", icon: Wallet },
  { href: "/marketplace", label: "Marketplace", icon: Package },
  { href: "/agente", label: "Agente IA", icon: Bot },
  { href: "/informes", label: "Informes", icon: BarChart3 },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleCollapse, setSidebarOpen } = useUiStore();

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-300 lg:flex",
        sidebarCollapsed ? "w-[68px]" : "w-64",
      )}
    >
      <div className="flex h-16 items-center justify-between border-b px-4">
        <Link href="/" className="flex items-center">
          {sidebarCollapsed ? (
            <img
              src="/logo.svg"
              alt="ENTERAR.ME"
              className="h-8 w-auto"
            />
          ) : (
            <Wordmark size="sm" />
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleCollapse}
          aria-label="Colapsar sidebar"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform",
              sidebarCollapsed && "rotate-180",
            )}
          />
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto scroll-area p-3">
        <ul className="space-y-1">
          {nav.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    sidebarCollapsed && "justify-center px-0",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-foreground",
                    )}
                  />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t p-3">
        <div
          className={cn(
            "rounded-md bg-muted/40 p-3 text-xs text-muted-foreground",
            sidebarCollapsed && "hidden",
          )}
        >
          <p className="font-semibold text-foreground">Super Admin</p>
          <p className="mt-1">Panel de gestión de plataforma ENTERAR.ME</p>
        </div>
      </div>
    </aside>
  );
}

/** Sidebar mobile, dentro del Sheet del header */
export function MobileSidebarContent() {
  const pathname = usePathname();
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b px-4">
        <Wordmark size="sm" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {nav.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
