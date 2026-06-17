"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Plan } from "@/types/directus";

export function usePlanes() {
  return useQuery({
    queryKey: ["planes"],
    queryFn: async () => {
      const res = await fetch("/api/planes");
      if (!res.ok) throw new Error("Error cargando planes");
      return (await res.json()) as Plan[];
    },
    staleTime: 60_000,
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Plan>) => {
      const res = await fetch("/api/planes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Error creando plan");
      return (await res.json()) as Plan;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planes"] }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Plan> }) => {
      const res = await fetch(`/api/planes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Error actualizando plan");
      return (await res.json()) as Plan;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planes"] }),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/planes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error eliminando plan");
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planes"] }),
  });
}
