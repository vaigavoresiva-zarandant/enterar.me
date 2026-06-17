"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Loader2, Lock, Mail } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/theme-toggle";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [tenantSlug, setTenantSlug] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fromQuery = params.get("tenant");
    if (fromQuery) setTenantSlug(fromQuery);
    else {
      const host = window.location.hostname;
      const parts = host.split(".");
      if (parts.length >= 3 && !["www", "admin", "api", "ai", "app"].includes(parts[0])) {
        setTenantSlug(parts[0]);
      }
    }
  }, [params]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
        tenant_slug: tenantSlug,
      });
      if (!res || res.error) {
        setError("Credenciales incorrectas o tenant inválido.");
        setLoading(false);
        return;
      }
      router.push("/agente");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-muted/40 to-background p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <LogoMark className="h-16 w-16 drop-shadow-sm" />
        <Wordmark size="lg" />
        <p className="max-w-sm text-sm text-muted-foreground">
          Trazabilidad inteligente para tu organización: ubicación + momento.
        </p>
      </div>

      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-brand-purple" />
            Acceso al panel
          </CardTitle>
          <CardDescription>
            Inicia sesión con tu cuenta de empresa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="tenant">Organización (slug)</Label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="tenant"
                  className="pl-8"
                  placeholder="miempresa"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  required
                  autoComplete="organization"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Se usa el subdominio <code className="rounded bg-muted px-1">{tenantSlug || "miempresa"}.app.enterarme.me</code>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  className="pl-8"
                  placeholder="admin@miempresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              variant="brand"
              className="w-full"
              disabled={loading || !tenantSlug}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Entrando…
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 max-w-md text-center text-xs text-muted-foreground">
        ¿No recuerdas tu organización? Contacta con tu admin o escribe a{" "}
        <a className="font-medium text-brand-purple hover:underline" href="mailto:soporte@enterarme.me">
          soporte@enterarme.me
        </a>
        .
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
      <LoginInner />
    </React.Suspense>
  );
}
