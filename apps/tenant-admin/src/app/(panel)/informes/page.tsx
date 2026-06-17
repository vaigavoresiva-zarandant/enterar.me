"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  BarChart3, Download, FileText, Loader2, Sparkles, Calendar, Filter,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/empty-state";
import { useUbicaciones } from "@/hooks/use-ubicaciones";
import { useUsuariosExternos } from "@/hooks/use-usuarios-externos";
import { useMateriales } from "@/hooks/use-materiales";
import { useGenerarInforme, INFORME_TIPOS } from "@/hooks/use-informes";
import type { InformeFiltros, InformeResult } from "@/types/directus";

const CHART_COLORS = ["#4c2eec", "#1cddbe", "#fcbf28", "#f64151", "#333333"];

export default function InformesPage() {
  const { data: session } = useSession();
  const tenantSlug = (session as any)?.tenantSlug || "demo";
  const token = (session as any)?.accessToken || "";

  const [filtros, setFiltros] = React.useState<InformeFiltros>({
    tipo: "stock",
  });
  const [resultado, setResultado] = React.useState<InformeResult | null>(null);

  const ubicacionesQ = useUbicaciones();
  const usuariosQ = useUsuariosExternos();
  const materialesQ = useMateriales();
  const generar = useGenerarInforme();

  async function handleGenerar() {
    setResultado(null);
    try {
      const res = await generar.mutateAsync({
        filtros,
        tenantSlug,
        token,
      });
      setResultado(res);
      toast.success("Informe generado");
    } catch (e) {
      // El hook ya muestra toast de error
    }
  }

  function exportCSV() {
    if (!resultado) return;
    const headers = resultado.rows.length
      ? Object.keys(resultado.rows[0])
      : [];
    const csv = [
      headers.join(","),
      ...resultado.rows.map((r) =>
        headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `informe-${resultado.tipo}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    toast.info("Exportando PDF… (usa el diálogo del navegador)");
    setTimeout(() => window.print(), 100);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Informes</h1>
          <p className="text-sm text-muted-foreground">
            Genera informes con la IA o por cálculo directo. Exporta a CSV o PDF.
          </p>
        </div>
      </header>

      <ReportBuilder
        filtros={filtros}
        onChange={setFiltros}
        onGenerate={handleGenerar}
        generating={generar.isPending}
        ubicaciones={ubicacionesQ.data || []}
        usuarios={usuariosQ.data || []}
        materiales={materialesQ.data || []}
      />

      {!resultado && !generar.isPending ? (
        <EmptyState
          icon={BarChart3}
          title="Aún no hay informe"
          description="Selecciona tipo y filtros y pulsa «Generar»."
        />
      ) : generar.isPending ? (
        <Skeleton className="h-72" />
      ) : resultado ? (
        <ReportCharts resultado={resultado} onCSV={exportCSV} onPDF={exportPDF} />
      ) : null}
    </div>
  );
}

function ReportBuilder({
  filtros, onChange, onGenerate, generating, ubicaciones, usuarios, materiales,
}: {
  filtros: InformeFiltros;
  onChange: (f: InformeFiltros) => void;
  onGenerate: () => void;
  generating: boolean;
  ubicaciones: { id: string; name: string }[];
  usuarios: { id: string; name: string }[];
  materiales: { id: string; name: string }[];
}) {
  const tipoInfo = INFORME_TIPOS.find((t) => t.value === filtros.tipo);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Filter className="h-4 w-4 text-brand-purple" />
          Configuración del informe
        </CardTitle>
        <CardDescription>{tipoInfo?.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 lg:col-span-2">
            <Label>Tipo de informe</Label>
            <Select
              value={filtros.tipo}
              onValueChange={(v) => onChange({ ...filtros, tipo: v as InformeFiltros["tipo"] })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INFORME_TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label} — <span className="text-xs text-muted-foreground">{t.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label><Calendar className="inline h-3 w-3 mr-1" /> Desde</Label>
            <Input
              type="date"
              value={filtros.from?.slice(0, 10) || ""}
              onChange={(e) =>
                onChange({ ...filtros, from: e.target.value ? new Date(e.target.value).toISOString() : undefined })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label><Calendar className="inline h-3 w-3 mr-1" /> Hasta</Label>
            <Input
              type="date"
              value={filtros.to?.slice(0, 10) || ""}
              onChange={(e) =>
                onChange({ ...filtros, to: e.target.value ? new Date(e.target.value).toISOString() : undefined })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Ubicación</Label>
            <Select
              value={filtros.ubicacion_id || "all"}
              onValueChange={(v) => onChange({ ...filtros, ubicacion_id: v === "all" ? undefined : v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {ubicaciones.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Usuario externo</Label>
            <Select
              value={filtros.user_externo_id || "all"}
              onValueChange={(v) => onChange({ ...filtros, user_externo_id: v === "all" ? undefined : v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {usuarios.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Material</Label>
            <Select
              value={filtros.material_id || "all"}
              onValueChange={(v) => onChange({ ...filtros, material_id: v === "all" ? undefined : v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {materiales.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="brand" onClick={onGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generar
          </Button>
          <Badge variant="purple" className="gap-1">
            <Sparkles className="h-3 w-3" /> IA · skill generar-informe
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportCharts({
  resultado, onCSV, onPDF,
}: {
  resultado: InformeResult;
  onCSV: () => void;
  onPDF: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm">
              Informe de {resultado.tipo} · generado {new Date(resultado.generated_at).toLocaleString("es-ES")}
            </CardTitle>
            <CardDescription className="mt-1">{resultado.summary}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onCSV}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={onPDF}>
              <FileText className="h-4 w-4" /> PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {resultado.kpis.map((kpi, i) => (
              <div key={i} className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="text-xl font-bold">{kpi.value}</p>
                {kpi.trend != null ? (
                  <p className={`text-xs ${kpi.trend >= 0 ? "text-success" : "text-destructive"}`}>
                    {kpi.trend >= 0 ? "▲" : "▼"} {Math.abs(kpi.trend)}%
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="charts">
        <TabsList>
          <TabsTrigger value="charts">Gráficas</TabsTrigger>
          <TabsTrigger value="table">Tabla</TabsTrigger>
        </TabsList>
        <TabsContent value="charts" className="space-y-4">
          {resultado.chart.map((c, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="text-sm">Gráfica {i + 1}</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  {c.type === "bar" ? (
                    <BarChart data={c.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          color: "hsl(var(--popover-foreground))",
                          borderRadius: 8,
                        }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {c.data.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : c.type === "line" ? (
                    <LineChart data={c.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          color: "hsl(var(--popover-foreground))",
                          borderRadius: 8,
                        }}
                      />
                      <Line dataKey="value" stroke="#4c2eec" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  ) : (
                    <PieChart>
                      <Pie data={c.data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={80} label>
                        {c.data.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  )}
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="table">
          <Card>
            <CardContent className="p-0">
              {resultado.rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Sin datos tabulares.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(resultado.rows[0]).map((h) => (
                        <TableHead key={h}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultado.rows.map((r, i) => (
                      <TableRow key={i}>
                        {Object.keys(r).map((k) => (
                          <TableCell key={k}>{String(r[k] ?? "—")}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
