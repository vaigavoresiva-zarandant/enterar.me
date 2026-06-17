import { NextRequest, NextResponse } from "next/server";
import { updateTemplate, deleteTemplate } from "@/lib/directus";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const patch = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const updated = await updateTemplate(id, patch);
  if (!updated) return NextResponse.json({ error: "Error" }, { status: 500 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ok = await deleteTemplate(id);
  if (!ok) return NextResponse.json({ error: "Error" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
