"use client";

import Link from "next/link";
import { Building2, TrendingUp, Package, Bot, ArrowUpRight, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  TenantsGrowthChart,
  MrrChart,
  PlanDistributionChart,
} from "@/components/dashboard/charts";
import { PlanBadge } from "@/components/planes/plan-badge";
import { formatDate, formatCurrency, formatCompact } from "@/lib/utils";
import type { KpiSnapshot, Tenant, PlanCode } from "@/types/directus";

interface DashboardClientProps {
  kpis: KpiSnapshot;
  tenantsSeries: Array<{ label: string; value: number }>;
  mrrSeries: Array<{ label: string; value: number; secondary?: number }>;
  planDistribution: Array<{ label: string; value: number }>;
  recentTenants: Tenant[];
  totalSectors: number;
}

export function DashboardClient({
  kpis,
  tenantsSeries,
  mrrSeries,
  planDistribution,
  recentTenants,
  totalSectors,
}: DashboardClientProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Visión global de la plataforma ENTERAR.ME
          </p>
        </div>
        <Button asChild variant="brand">
          <Link href="/tenants/new">
            <Building2 className="h-4 w-4" />
            Crear tenant
          </Link>
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Tenants activos"
          value={formatCompact(kpis.tenants_active)}
          hint={`${kpis.tenants_total} totales`}
          icon={Building2}
          accent="red"
          delay={0}
        />
        <KpiCard
          label="MRR estimado"
          value={formatCurrency(kpis.mrr_estimate)}
          hint={`ARR ${formatCurrency(kpis.arr_estimate)}`}
          icon={TrendingUp}
          accent="purple"
          delay={0.05}
        />
        <KpiCard
          label="Sectores marketplace"
          value={totalSectors}
          hint={`${kpis.sectors_published} publicados`}
          icon={Package}
          accent="yellow"
          delay={0.1}
        />
        <KpiCard
          label="Conversaciones hoy"
          value={formatCompact(kpis.conversations_today)}
          hint="Agente global"
          icon={Bot}
          accent="teal"
          delay={0.15}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Alta de tenants</CardTitle>
              <CardDescription>Últimos 6 meses</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/informes">
                Ver más
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <TenantsGrowthChart data={tenantsSeries} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">MRR mensual</CardTitle>
              <CardDescription>Ingresos recurrentes estimados</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/suscripciones">
                Ver más
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <MrrChart data={mrrSeries} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Distribución por plan</CardTitle>
            <CardDescription>Tenants activos por tipo de plan</CardDescription>
          </CardHeader>
          <CardContent>
            <PlanDistributionChart data={planDistribution} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Tenants recientes</CardTitle>
              <CardDescription>Últimas altas en la plataforma</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/tenants">
                Ver todos
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentTenants.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                Aún no hay tenants. Crea el primero.
              </div>
            ) : (
              <ul className="divide-y">
                {recentTenants.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-red/10 text-brand-red">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <Link
                      href={`/tenants/${t.id}`}
                      className="min-w-0 flex-1"
                    >
                      <p className="truncate text-sm font-medium hover:text-primary">
                        {t.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.admin_email ?? t.slug}
                      </p>
                    </Link>
                    {t.plan?.code && <PlanBadge code={t.plan.code as PlanCode} />}
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {formatDate(t.date_created)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CTA agente */}
      <Card className="overflow-hidden border-brand-purple/20">
        <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-purple/10 text-brand-purple">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">¿Necesitas un informe a medida?</p>
              <p className="text-sm text-muted-foreground">
                Pregunta al agente IA global sobre cualquier métrica de la plataforma.
              </p>
            </div>
          </div>
          <Button asChild variant="brand">
            <Link href="/agente">
              <Bot className="h-4 w-4" />
              Abrir agente
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
