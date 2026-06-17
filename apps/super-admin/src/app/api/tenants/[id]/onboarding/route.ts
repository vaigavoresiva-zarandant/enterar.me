import { NextRequest, NextResponse } from "next/server";
import { launchOnboarding } from "@/lib/directus";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const res = await launchOnboarding(id);
  return NextResponse.json(res, { status: res.ok ? 200 : 502 });
}
