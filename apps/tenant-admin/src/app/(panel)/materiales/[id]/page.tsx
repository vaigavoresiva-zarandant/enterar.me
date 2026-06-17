"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, Package, MapPin, User, TrendingDown, TrendingUp,
  Plus, Minus, RefreshCw, Boxes,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/error-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMaterial, useMaterialMovimientos } from "@/hooks/use-materiales";
import type { MovimientoStock, MovimientoTipo } from "@/types/directus";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const MOV_COLOR: Record<MovimientoTipo, "success" | "destructive" | "warning" | "accent"> = {
  entrada: "success",
  salida: "destructive",
  ajuste: "warning",
  transferencia: "accent",
};

const MOV_ICON: Record<MovimientoTipo, React.ElementType> = {
  entrada: TrendingUp,
  salida: TrendingDown,
  ajuste: RefreshCw,
  transferencia: Plus,
};

const MOV_BADGE_CLASS: Record<MovimientoTipo, string> = {
  entrada: "bg-success/15 text-success",
  salida: "bg-destructive/15 text-destructive",
  ajuste: "bg-warning/15 text-warning-foreground",
  transferencia: "bg-brand-teal/15 text-brand-teal",
};

export default function MaterialDetallePage() {
  const params = useParams();
  const id = params.id as string;
  const matQ = useMaterial(id);
  const movsQ = useMaterialMovimientos(id);
  const [nuevoMov, setNuevoMov] = React.useState(false);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/materiales">
              <ArrowLeft className="h-4 w-4" /> Volver a materiales
            </Link>
          </Button>
          {matQ.isLoading ? (
            <Skeleton className="h-8 w-64" />
          ) : (
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Package className="h-6 w-6 text-brand-purple" />
              {matQ.data?.name || "Material"}
              {matQ.data ? (
                <Badge variant={matQ.data.tipo === "fungible" ? "yellow" : "purple"}>
                  {matQ.data.tipo === "fungible" ? "Fungible" : "No fungible"}
                </Badge>
              ) : null}
            </h1>
          )}
        </div>
        <Button variant="brand" onClick={() => setNuevoMov(true)}>
          <Plus className="h-4 w-4" /> Registrar movimiento
        </Button>
      </header>

      {matQ.isError ? (
        <ErrorState onRetry={() => matQ.refetch()} />
      ) : matQ.isLoading ? (
        <Skeleton className="h-32" />
      ) : matQ.data ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Metric label="Stock actual" value={`${matQ.data.stock_total} ${matQ.data.unit}`} icon={Boxes} />
          <Metric label="Stock mínimo" value={`${matQ.data.stock_min ?? 0} ${matQ.data.unit}`} icon={Boxes} />
          <Metric label="Costo unitario" value={formatCurrency(matQ.data.cost)} icon={Package} />
          <Metric label="Valor en stock" value={formatCurrency((matQ.data.cost ?? 0) * matQ.data.stock_total)} icon={TrendingUp} />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Asignación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Usuario externo" icon={User}>
              {matQ.data?.user_externo?.name || "—"}
            </Row>
            <Row label="Ubicación" icon={MapPin}>
              {matQ.data?.ubicacion?.name || "—"}
            </Row>
            <Row label="SKU" icon={Package}>
              <span className="font-mono">{matQ.data?.sku || "—"}</span>
            </Row>
            <Row label="Unidad" icon={Package}>
              {matQ.data?.unit}
            </Row>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Trazabilidad — Movimientos de stock</CardTitle>
            <CardDescription>
              Cada movimiento queda registrado con ubicación + momento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {movsQ.isError ? (
              <ErrorState onRetry={() => movsQ.refetch()} />
            ) : movsQ.isLoading ? (
              <Skeleton className="h-48" />
            ) : !movsQ.data || movsQ.data.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aún no hay movimientos. Registra el primero para iniciar la trazabilidad.
              </p>
            ) : (
              <Timeline movimientos={movsQ.data} />
            )}
          </CardContent>
        </Card>
      </div>

      {nuevoMov ? (
        <NuevoMovimientoModal
          onClose={() => setNuevoMov(false)}
          materialId={id}
          unit={matQ.data?.unit || "ud"}
        />
      ) : null}
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-purple/10">
            <Icon className="h-5 w-5 text-brand-purple" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

function Timeline({ movimientos }: { movimientos: MovimientoStock[] }) {
  return (
    <ol className="relative max-h-96 overflow-y-auto border-l-2 border-muted pl-5">
      {movimientos.map((m) => {
        const Icon = MOV_ICON[m.tipo];
        return (
          <li key={m.id} className="mb-5 last:mb-0">
            <span className={`absolute -left-[11px] flex h-5 w-5 items-center justify-center rounded-full ${MOV_BADGE_CLASS[m.tipo]}`}>
              <Icon className="h-3 w-3" />
            </span>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">
                  <Badge variant={MOV_COLOR[m.tipo]} className="mr-2 capitalize">{m.tipo}</Badge>
                  {m.cantidad} {m.material?.unit}
                </p>
                {m.notas ? <p className="text-xs text-muted-foreground">{m.notas}</p> : null}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p className="font-medium text-foreground">{m.ubicacion?.name || "Sin ubicación"}</p>
                <p>{formatDateTime(m.created_at)}</p>
                {m.referencia ? <p className="font-mono text-[10px]">{m.referencia}</p> : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function NuevoMovimientoModal({
  onClose, materialId, unit,
}: {
  onClose: () => void;
  materialId: string;
  unit: string;
}) {
  const [tipo, setTipo] = React.useState<MovimientoTipo>("entrada");
  const [cantidad, setCantidad] = React.useState(0);
  const [notas, setNotas] = React.useState("");
  const [referencia, setReferencia] = React.useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    toast.success(`Movimiento registrado: ${tipo} ${cantidad} ${unit}`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-background p-6 shadow-xl sm:rounded-2xl">
        <h2 className="mb-4 text-lg font-semibold">Registrar movimiento</h2>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as MovimientoTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="salida">Salida</SelectItem>
                <SelectItem value="ajuste">Ajuste</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Cantidad ({unit})</Label>
            <Input type="number" step="0.01" value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} required />
          </div>
          <div className="space-y-1.5">
            <Label>Referencia</Label>
            <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Albarán, factura…" />
          </div>
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Observaciones" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="brand">Registrar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
