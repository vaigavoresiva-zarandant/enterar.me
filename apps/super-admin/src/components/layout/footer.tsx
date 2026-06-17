import Link from "next/link";
import { Wordmark } from "@/components/branding/wordmark";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t bg-background">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-4 sm:flex-row lg:px-6">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Wordmark size="sm" showLogo={false} />
          <span>· Super Admin · © {year}</span>
        </div>
        <nav className="flex items-center gap-4 text-xs text-muted-foreground">
          <Link href="/informes" className="hover:text-foreground">
            Informes
          </Link>
          <Link href="/configuracion" className="hover:text-foreground">
            Configuración
          </Link>
          <a
            href="https://docs.enterarme.me"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            Documentación
          </a>
        </nav>
      </div>
    </footer>
  );
}
