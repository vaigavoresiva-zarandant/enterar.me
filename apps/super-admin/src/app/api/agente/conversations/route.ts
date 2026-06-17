import { NextResponse } from "next/server";
import { listConversationsGlobal } from "@/lib/directus";
import { listConversations as listAiConversations } from "@/lib/ai";

export async function GET() {
  // Preferimos el servicio IA; si no responde, fallback a Directus
  try {
    const list = await listAiConversations(30);
    if (list && list.length > 0) {
      return NextResponse.json({ data: list });
    }
  } catch {
    // ignore
  }
  const convs = await listConversationsGlobal(30);
  return NextResponse.json({
    data: convs.map((c) => ({
      id: c.id,
      title: c.title ?? "Sin título",
      date_updated: c.date_updated ?? c.date_created,
    })),
  });
}
