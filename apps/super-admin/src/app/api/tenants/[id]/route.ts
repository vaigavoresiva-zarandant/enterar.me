import { NextRequest, NextResponse } from "next/server";
import { getTenant, updateTenant, countUsersByTenant, countLocationsByTenant } from "@/lib/directus";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const tenant = await getTenant(id);
  if (!tenant) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  const [users_count, locations_count] = await Promise.all([
    countUsersByTenant(id),
    countLocationsByTenant(id),
  ]);
  return NextResponse.json({ ...tenant, users_count, locations_count });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const patch = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const updated = await updateTenant(id, patch);
  if (!updated) {
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  }
  return NextResponse.json(updated);
}
