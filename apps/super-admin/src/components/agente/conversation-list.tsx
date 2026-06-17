"use client";

import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { formatDateTime } from "@/lib/utils";

interface ConversationItem {
  id: string;
  title?: string;
  date_updated?: string;
}

export function ConversationList({
  onSelect,
  selectedId,
}: {
  onSelect?: (id: string) => void;
  selectedId?: string | null;
}) {
  const q = useQuery({
    queryKey: ["agente", "conversations"],
    queryFn: async () => {
      const res = await fetch("/api/agente/conversations");
      if (!res.ok) return [];
      const data = (await res.json()) as { data?: ConversationItem[] };
      return data.data ?? [];
    },
    staleTime: 15_000,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Conversaciones</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto scroll-area p-2">
        {q.isLoading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !q.data || q.data.length === 0 ? (
          <div className="p-2">
            <EmptyState
              icon={<MessageSquare className="h-5 w-5" />}
              title="Sin conversaciones"
              description="Inicia una nueva conversación con el agente."
              className="py-6"
            />
          </div>
        ) : (
          <ul className="space-y-1">
            {q.data.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => onSelect?.(c.id)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    selectedId === c.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="truncate font-medium">
                    {c.title || "Sin título"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(c.date_updated)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
