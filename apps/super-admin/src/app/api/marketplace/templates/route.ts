import { NextRequest, NextResponse } from "next/server";
import { listTemplates, createTemplate } from "@/lib/directus";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || undefined;
  const sector = searchParams.get("sector") || undefined;
  const templates = await listTemplates({ type, sector });
  return NextResponse.json(templates);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const created = await createTemplate(body);
  if (!created) {
    return NextResponse.json({ error: "No se pudo crear la plantilla" }, { status: 500 });
  }
  return NextResponse.json(created, { status: 201 });
}
