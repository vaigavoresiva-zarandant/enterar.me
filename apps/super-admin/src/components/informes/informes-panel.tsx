"use client";

import { useState } from "react";
import { Calendar, Download, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TenantsGrowthChart, MrrChart, PlanDistributionChart } from "@/components/dashboard/charts";
import { downloadBlob, formatCurrency, formatCompact, toCSV } from "@/lib/utils";
import { toast } from "sonner";

interface ReporteData {
  tenantsPorMes: Array<{ label: string; value: number }>;
  mrr: Array<{ label: string; value: number; secondary?: number }>;
  distribucionPlanes: Array<{ label: string; value: number }>;
  topSectores: Array<{ sector: string; tenants: number; mrr: number }>;
  churn: { mes: string; rate: number; bajas: number }[];
}

export function InformesPanel({ data }: { data: ReporteData }) {
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");
  const [metrica, setMetrica] = useState<string>("tenants");

  const exportar = () => {
    const rows = data.tenantsPorMes.map((r) => ({
      mes: r.label,
      tenants_nuevos: r.value,
    }));
    const csv = toCSV(rows);
    downloadBlob(csv, `informe-enterarme-${Date.now()}.csv`);
    toast.success("Informe exportado");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1 text-xs">
                <Calendar className="h-3 w-3" /> Desde
              </Label>
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1 text-xs">
                <Calendar className="h-3 w-3" /> Hasta
              </Label>
              <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1 text-xs">
                <Filter className="h-3 w-3" /> Métrica
              </Label>
              <Select value={metrica} onValueChange={setMetrica}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tenants">Tenants</SelectItem>
                  <SelectItem value="mrr">MRR</SelectItem>
                  <SelectItem value="churn">Churn</SelectItem>
                  <SelectItem value="sectores">Sectores</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={exportar} variant="outline" className="w-full">
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tenants por mes</CardTitle>
          </CardHeader>
          <CardContent>
            <TenantsGrowthChart data={data.tenantsPorMes} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">MRR mensual</CardTitle>
          </CardHeader>
          <CardContent>
            <MrrChart data={data.mrr} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribución por plan</CardTitle>
          </CardHeader>
          <CardContent>
            <PlanDistributionChart data={data.distribucionPlanes} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top sectores</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sector</TableHead>
                  <TableHead className="text-right">Tenants</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topSectores.map((s) => (
                  <TableRow key={s.sector}>
                    <TableCell className="font-medium">{s.sector}</TableCell>
                    <TableCell className="text-right">{formatCompact(s.tenants)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(s.mrr)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Churn últimos 6 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead className="text-right">Tasa churn</TableHead>
                <TableHead className="text-right">Bajas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.churn.map((c) => (
                <TableRow key={c.mes}>
                  <TableCell className="font-medium">{c.mes}</TableCell>
                  <TableCell className="text-right">
                    {(c.rate * 100).toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right">{c.bajas}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
