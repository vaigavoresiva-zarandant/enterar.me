import { NextResponse } from "next/server";
import { listTenants, listPlans, listSectors, listSubscriptions } from "@/lib/directus";

export async function GET() {
  const [tenants, plans, sectors, subs] = await Promise.all([
    listTenants({ limit: 1000 }),
    listPlans(),
    listSectors(),
    listSubscriptions({ limit: 1000 }),
  ]);

  const months = lastNMonths(6);
  const tenantsByMonth = months.map((label) => {
    const value = tenants.filter((t) =>
      t.date_created?.startsWith(label.slice(0, 7)),
    ).length;
    return { label, value };
  });

  const mrr = months.map((label) => {
    const active = subs.filter(
      (s) =>
        s.status === "activa" &&
        new Date(s.current_period_start) <= new Date(label + "-01"),
    );
    const value = active.reduce((acc, s) => acc + (s.amount ?? 0), 0);
    return { label, value };
  });

  const planDistribution = plans.map((p) => ({
    label: p.name,
    value: tenants.filter((t) => t.plan_id === p.id).length,
  }));

  return NextResponse.json({
    tenantsByMonth,
    mrr,
    planDistribution,
    sectorsTotal: sectors.length,
    tenantsTotal: tenants.length,
  });
}

function lastNMonths(n: number): string[] {
  const fmt = new Intl.DateTimeFormat("es-ES", { month: "short", year: "2-digit" });
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const label = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
    void fmt;
    out.push(label);
  }
  return out;
}
