import { Shell } from "@/components/layout/shell";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { listTenants, listPlans, listSectors, getKpis } from "@/lib/directus";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Cargar datos server-side
  const [kpis, tenants, plans, sectors] = await Promise.all([
    getKpis(),
    listTenants({ limit: 1000 }),
    listPlans(),
    listSectors(),
  ]);

  // Si no hay KPIs reales todavía, calculamos fallback a partir de tenants/planes
  const fallback = {
    tenants_active: tenants.filter((t) => t.status === "activo").length,
    tenants_total: tenants.length,
    mrr_estimate: 0,
    arr_estimate: 0,
    sectors_published: sectors.filter((s) => s.is_published).length,
    templates_published: 0,
    conversations_today: 0,
    churn_rate_30d: 0,
  };
  const data = kpis ?? fallback;

  // Series para gráficas (últimos 6 meses)
  const months = lastNMonths(6);
  const tenantsSeries = months.map((m) => ({
    label: m.label,
    value: tenants.filter((t) => t.date_created?.startsWith(m.key)).length,
  }));
  const mrrSeries = months.map((m) => ({
    label: m.label,
    value: Math.round((data.mrr_estimate || 0) / 6),
    secondary: Math.round((data.mrr_estimate || 0) / 6 * 1.1),
  }));
  const planDistribution = plans.map((p) => ({
    label: p.name,
    value: tenants.filter((t) => t.plan_id === p.id).length,
  }));

  return (
    <Shell>
      <DashboardClient
        kpis={data}
        tenantsSeries={tenantsSeries}
        mrrSeries={mrrSeries}
        planDistribution={planDistribution}
        recentTenants={tenants.slice(0, 5)}
        totalSectors={sectors.length}
      />
    </Shell>
  );
}

function lastNMonths(n: number): Array<{ key: string; label: string }> {
  const out: Array<{ key: string; label: string }> = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const key = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("es-ES", {
      month: "short",
    }).format(x);
    out.push({ key, label });
  }
  return out;
}
