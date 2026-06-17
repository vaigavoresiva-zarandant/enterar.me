import { NextRequest, NextResponse } from "next/server";
import { listSubscriptions } from "@/lib/directus";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const plan = searchParams.get("plan") || undefined;
  const status = searchParams.get("status") || undefined;
  const subs = await listSubscriptions({ plan, status });
  return NextResponse.json(subs);
}
