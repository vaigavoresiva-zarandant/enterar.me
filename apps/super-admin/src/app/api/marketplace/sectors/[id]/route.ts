import { NextRequest, NextResponse } from "next/server";
import { getSector, updateSector, deleteSector } from "@/lib/directus";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sector = await getSector(id);
  if (!sector) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(sector);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const patch = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const updated = await updateSector(id, patch);
  if (!updated) return NextResponse.json({ error: "Error" }, { status: 500 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ok = await deleteSector(id);
  if (!ok) return NextResponse.json({ error: "Error" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
