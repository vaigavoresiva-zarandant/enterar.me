"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Menu, Moon, Sun, LogOut, User as UserIcon, Settings as SettingsIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { MobileSidebarContent } from "@/components/layout/sidebar";
import { useTheme } from "next-themes";
import { useUiStore } from "@/stores/ui-store";
import { initials } from "@/lib/utils";
import Link from "next/link";

export function Header() {
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const [sheetOpen, setSheetOpen] = useState(false);

  const name = session?.user?.name || session?.user?.email || "Admin";
  const email = session?.user?.email ?? "";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur lg:px-6">
      {/* Mobile menu */}
      <Sheet open={sheetOpen} onOpenChange={(o) => { setSheetOpen(o); setSidebarOpen(o); }}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <MobileSidebarContent />
        </SheetContent>
      </Sheet>

      <div className="flex-1">
        <p className="text-sm text-muted-foreground">
          Panel del Super Admin · <span className="font-medium text-foreground">ENTERAR.ME</span>
        </p>
      </div>

      {/* Theme toggle */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Cambiar tema"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        <Sun className="h-5 w-5 dark:hidden" />
        <Moon className="hidden h-5 w-5 dark:block" />
      </Button>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-10 gap-2 px-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-brand-red/10 text-brand-red">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:inline">
              {name}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col">
            <span className="text-sm font-medium">{name}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/configuracion" className="cursor-pointer">
              <UserIcon className="h-4 w-4" />
              <span>Mi cuenta</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/configuracion" className="cursor-pointer">
              <SettingsIcon className="h-4 w-4" />
              <span>Configuración</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:text-destructive"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4" />
            <span>Cerrar sesión</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
