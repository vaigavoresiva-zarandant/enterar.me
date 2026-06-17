"use client";

import * as React from "react";
import {
  Building2, Plus, Trash2, Webhook, KeyRound, Globe, Clock, Coins, Users as UsersIcon, Loader2, Save,
} from "lucide-react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function ConfiguracionPage() {
  const [webhooks, setWebhooks] = React.useState([
    { id: "w1", url: "https://erp.miempresa.com/hooks/enterarme", event: "tarea.completada", active: true },
    { id: "w2", url: "https://n8n.miempresa.com/webhook/stock", event: "stock.bajo_minimo", active: false },
  ]);
  const [tokens, setTokens] = React.useState([
    { id: "t1", label: "App móvil técnicos", token: "tk_app_••••7d3a", lastUsed: "2025-12-01" },
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Datos del tenant, integraciones, usuarios internos y preferencias.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Datos del tenant */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-brand-purple" /> Datos del tenant
            </CardTitle>
            <CardDescription>Información general de la organización.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input defaultValue="Mi Empresa S.L." />
            </div>
            <div className="space-y-1.5">
              <Label>Slug (subdominio)</Label>
              <Input defaultValue="miempresa" disabled />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Input defaultValue="Pro" disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Input defaultValue="Activa" disabled />
              </div>
            </div>
            <Button variant="brand" onClick={() => toast.success("Datos guardados")}>
              <Save className="h-4 w-4" /> Guardar
            </Button>
          </CardContent>
        </Card>

        {/* Preferencias */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-brand-purple" /> Preferencias
            </CardTitle>
            <CardDescription>Idioma, zona horaria y moneda.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label><Globe className="inline h-3 w-3 mr-1" /> Idioma</Label>
              <Select defaultValue="es">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="pt">Português</SelectItem>
                  <SelectItem value="ca">Català</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label><Clock className="inline h-3 w-3 mr-1" /> Zona horaria</Label>
              <Select defaultValue="Europe/Madrid">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Europe/Madrid">Europe/Madrid (CET)</SelectItem>
                  <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                  <SelectItem value="America/Mexico_City">America/Mexico_City</SelectItem>
                  <SelectItem value="America/Bogota">America/Bogota</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label><Coins className="inline h-3 w-3 mr-1" /> Moneda</Label>
              <Select defaultValue="EUR">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">Euro (€)</SelectItem>
                  <SelectItem value="USD">US Dollar ($)</SelectItem>
                  <SelectItem value="GBP">British Pound (£)</SelectItem>
                  <SelectItem value="MXN">Mexican Peso ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Modo oscuro por defecto</Label>
                <p className="text-xs text-muted-foreground">Aplica a nuevos usuarios.</p>
              </div>
              <Switch defaultChecked={false} />
            </div>
            <Button variant="brand" onClick={() => toast.success("Preferencias guardadas")}>
              <Save className="h-4 w-4" /> Guardar preferencias
            </Button>
          </CardContent>
        </Card>

        {/* Webhooks */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-4 w-4 text-brand-purple" /> Webhooks
              </CardTitle>
              <CardDescription>Recibe eventos en tus sistemas externos.</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4" /> Nuevo webhook
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs">{w.url}</TableCell>
                    <TableCell><Badge variant="purple">{w.event}</Badge></TableCell>
                    <TableCell>
                      <Switch
                        checked={w.active}
                        onCheckedChange={(v) => setWebhooks((arr) => arr.map((x) => x.id === w.id ? { ...x, active: v } : x))}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* API tokens */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-brand-purple" /> API tokens
              </CardTitle>
              <CardDescription>Para integraciones server-to-server.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => toast.success("Token generado (mostrar una sola vez)")}>
              <Plus className="h-4 w-4" /> Generar token
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Etiqueta</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Último uso</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.label}</TableCell>
                    <TableCell className="font-mono text-xs">{t.token}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.lastUsed}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setTokens((arr) => arr.filter((x) => x.id !== t.id))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Usuarios internos */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UsersIcon className="h-4 w-4 text-brand-purple" /> Usuarios internos
              </CardTitle>
              <CardDescription>Equipo del tenant con acceso al panel.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => toast.info("Alta de usuario interno (demo)")}>
              <Plus className="h-4 w-4" /> Nuevo usuario
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { id: "u1", name: "Ana Pérez", email: "ana@miempresa.com", role: "admin", status: "active" },
                  { id: "u2", name: "Luis Gómez", email: "luis@miempresa.com", role: "manager", status: "active" },
                  { id: "u3", name: "Carla Ruiz", email: "carla@miempresa.com", role: "worker", status: "inactive" },
                ].map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "admin" ? "purple" : u.role === "manager" ? "accent" : "secondary"}>
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.status === "active" ? "success" : "secondary"}>
                        {u.status === "active" ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost">Editar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
