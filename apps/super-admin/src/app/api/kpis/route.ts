import { NextResponse } from "next/server";
import { getKpis } from "@/lib/directus";

export async function GET() {
  const kpis = await getKpis();
  if (kpis) return NextResponse.json(kpis);

  // Fallback con ceros si no hay snapshot en Directus aún
  return NextResponse.json({
    tenants_active: 0,
    tenants_total: 0,
    mrr_estimate: 0,
    arr_estimate: 0,
    sectors_published: 0,
    templates_published: 0,
    conversations_today: 0,
    churn_rate_30d: 0,
  });
}
