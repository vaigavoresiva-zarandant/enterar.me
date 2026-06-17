import { NextRequest, NextResponse } from "next/server";
import { listTenants, createTenant } from "@/lib/directus";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || undefined;
  const status = searchParams.get("status") || undefined;
  const page = Number(searchParams.get("page") ?? 1);
  const tenants = await listTenants({ search, status, page, limit: 20 });
  return NextResponse.json(tenants);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    slug?: string;
    plan_id?: string;
    admin_email?: string;
    sector_id?: string | null;
  };
  if (!body.name || !body.slug || !body.plan_id || !body.admin_email) {
    return NextResponse.json(
      { error: "Faltan campos obligatorios (name, slug, plan_id, admin_email)" },
      { status: 400 },
    );
  }
  const created = await createTenant({
    name: body.name,
    slug: body.slug,
    plan_id: body.plan_id,
    admin_email: body.admin_email,
    sector_id: body.sector_id || null,
  });
  if (!created) {
    return NextResponse.json(
      { error: "No se pudo crear el tenant" },
      { status: 500 },
    );
  }
  return NextResponse.json(created, { status: 201 });
}
