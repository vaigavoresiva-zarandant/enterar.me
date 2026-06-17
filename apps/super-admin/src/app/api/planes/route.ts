import { NextResponse } from "next/server";
import { listPlans, createPlan } from "@/lib/directus";

export async function GET() {
  const plans = await listPlans();
  return NextResponse.json(plans);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const created = await createPlan(body);
  if (!created) {
    return NextResponse.json({ error: "No se pudo crear el plan" }, { status: 500 });
  }
  return NextResponse.json(created, { status: 201 });
}
