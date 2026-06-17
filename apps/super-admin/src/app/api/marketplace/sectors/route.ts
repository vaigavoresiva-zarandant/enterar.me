import { NextResponse } from "next/server";
import { listSectors, createSector } from "@/lib/directus";

export async function GET() {
  const sectors = await listSectors();
  return NextResponse.json(sectors);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const created = await createSector(body);
  if (!created) {
    return NextResponse.json({ error: "No se pudo crear el sector" }, { status: 500 });
  }
  return NextResponse.json(created, { status: 201 });
}
