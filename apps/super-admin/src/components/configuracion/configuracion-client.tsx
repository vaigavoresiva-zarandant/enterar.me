"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Copy, Eye, EyeOff, RefreshCw, Webhook, Plug, Key, User } from "lucide-react";
import { toast } from "sonner";
import { initials } from "@/lib/utils";

export function ConfiguracionClient() {
  const { data: session } = useSession();
  const [showToken, setShowToken] = useState(false);
  const [ollamaUrl, setOllamaUrl] = useState("https://tu-ollama.up.railway.app");
  const [ollamaKey, setOllamaKey] = useState("");
  const [ollamaModel, setOllamaModel] = useState("enterarme-agent");

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  const fakeServiceToken = "sadm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

  return (
    <Tabs defaultValue="cuenta" className="w-full">
      <TabsList className="flex h-auto flex-wrap gap-1">
        <TabsTrigger value="cuenta" className="gap-2">
          <User className="h-4 w-4" /> Cuenta
        </TabsTrigger>
        <TabsTrigger value="api" className="gap-2">
          <Key className="h-4 w-4" /> API tokens
        </TabsTrigger>
        <TabsTrigger value="webhooks" className="gap-2">
          <Webhook className="h-4 w-4" /> Webhooks
        </TabsTrigger>
        <TabsTrigger value="integraciones" className="gap-2">
          <Plug className="h-4 w-4" /> Integraciones
        </TabsTrigger>
      </TabsList>

      {/* Cuenta */}
      <TabsContent value="cuenta">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Perfil del super admin</CardTitle>
            <CardDescription>
              Información básica de tu cuenta de administración de plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-brand-red/10 text-brand-red text-lg">
                  {initials(session?.user?.name ?? "Admin")}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-semibold">
                  {session?.user?.name ?? "Admin"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {session?.user?.email}
                </p>
                <Badge variant="purple" className="mt-1">
                  {session?.user?.role ?? "Super Admin"}
                </Badge>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input defaultValue={session?.user?.name ?? ""} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input defaultValue={session?.user?.email ?? ""} disabled />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                variant="brand"
                onClick={() => toast.success("Perfil guardado")}
              >
                Guardar cambios
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* API tokens */}
      <TabsContent value="api">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Token de servicio</CardTitle>
            <CardDescription>
              Token server-to-server para llamadas a Directus desde los frontends.
              NO compartas este token. Se usa solo en el backend.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>SERVICE_TOKEN</Label>
              <div className="flex gap-2">
                <Input
                  type={showToken ? "text" : "password"}
                  value={fakeServiceToken}
                  readOnly
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowToken((v) => !v)}
                  aria-label={showToken ? "Ocultar" : "Mostrar"}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(fakeServiceToken, "Token")}
                  aria-label="Copiar"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => toast.success("Token regenerado (mock)")}
            >
              <RefreshCw className="h-4 w-4" />
              Regenerar token
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Webhooks */}
      <TabsContent value="webhooks">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Webhooks</CardTitle>
            <CardDescription>
              Endpoints que ENTERAR.ME notificará ante eventos de plataforma
              (alta de tenant, cambio de plan, baja, etc.).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">https://mi-crm.com/webhooks/enterarme</span>
                <Badge variant="success">Activo</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Eventos: tenant.created, tenant.suspended, subscription.updated
              </p>
            </div>
            <Button variant="outline" onClick={() => toast.info("Formulario de webhook (mock)")}>
              <Webhook className="h-4 w-4" />
              Añadir webhook
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Integraciones */}
      <TabsContent value="integraciones">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Integración Ollama (Railway)</CardTitle>
            <CardDescription>
              Configuración del servicio IA que da capacidades al agente global.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL de Ollama</Label>
              <Input
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="https://tu-ollama.up.railway.app"
              />
            </div>
            <div className="space-y-2">
              <Label>API Key (Railway)</Label>
              <Input
                type="password"
                value={ollamaKey}
                onChange={(e) => setOllamaKey(e.target.value)}
                placeholder="••••••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Input
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button
                variant="brand"
                onClick={() => toast.success("Integración guardada")}
              >
                Guardar integración
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
