"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Building2, CreditCard, KeyRound, User as UserIcon } from "lucide-react";

const MOCK_TENANT = {
  name: "Mi Empresa S.L.",
  slug: "miempresa",
  plan: "pro",
  status: "activa",
  next_invoice_date: "2025-12-01T00:00:00Z",
  currency: "EUR",
  language: "es",
  timezone: "Europe/Madrid",
};

export default function PerfilPage() {
  const { data: session } = useSession();
  const name = (session?.user?.name as string) || "Usuario";
  const email = (session?.user?.email as string) || "—";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Perfil</h1>
        <p className="text-sm text-muted-foreground">
          Tu cuenta, tu organización y tu suscripción.
        </p>
      </header>

      {MOCK_TENANT.status === "suspendida" ? (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 text-warning" />
          <div className="flex-1">
            <p className="font-medium text-warning-foreground">
              Suscripción suspendida
            </p>
            <p className="text-sm text-muted-foreground">
              Algunas funciones del panel están limitadas. Regulariza tu pago para
              reactivar el acceso completo.
            </p>
          </div>
          <Button variant="warning" size="sm">Regularizar pago</Button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-brand-purple" />
              Datos personales
            </CardTitle>
            <CardDescription>Tu usuario logado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input defaultValue={name} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input defaultValue={email} disabled />
            </div>
            <Separator />
            <div className="space-y-1.5">
              <Label>Contraseña actual</Label>
              <Input type="password" placeholder="••••••••" />
            </div>
            <div className="space-y-1.5">
              <Label>Nueva contraseña</Label>
              <Input type="password" placeholder="••••••••" />
            </div>
            <Button variant="brand">Guardar cambios</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-brand-purple" />
              Organización
            </CardTitle>
            <CardDescription>Datos del tenant.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{MOCK_TENANT.name}</p>
                <p className="text-xs text-muted-foreground">
                  {MOCK_TENANT.slug}.app.enterarme.me
                </p>
              </div>
              <Badge variant="purple">{MOCK_TENANT.plan.toUpperCase()}</Badge>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Plan" value={MOCK_TENANT.plan} />
              <Field label="Estado" value={MOCK_TENANT.status} />
              <Field label="Moneda" value={MOCK_TENANT.currency} />
              <Field label="Idioma" value={MOCK_TENANT.language} />
              <Field label="Zona horaria" value={MOCK_TENANT.timezone} />
              <Field
                label="Próxima factura"
                value={new Date(MOCK_TENANT.next_invoice_date).toLocaleDateString(
                  "es-ES",
                )}
              />
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
              <CreditCard className="h-4 w-4 text-brand-purple" />
              <span className="text-muted-foreground">
                Facturación a través de Stripe · próxima factura el{" "}
                {new Date(MOCK_TENANT.next_invoice_date).toLocaleDateString("es-ES")}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-brand-purple" />
              Tokens de API
            </CardTitle>
            <CardDescription>
              Para integraciones con sistemas externos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { label: "Webhook entrante", token: "wh_in_••••7f3a" },
                { label: "API token (lectura)", token: "tk_r_••••b91c" },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{row.label}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {row.token}
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Copiar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-medium capitalize">{value}</p>
    </div>
  );
}
