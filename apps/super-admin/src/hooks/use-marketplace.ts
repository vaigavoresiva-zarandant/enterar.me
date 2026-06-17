"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Sector, MarketplaceTemplate, TemplateType } from "@/types/directus";

export function useSectors() {
  return useQuery({
    queryKey: ["sectors"],
    queryFn: async () => {
      const res = await fetch("/api/marketplace/sectors");
      if (!res.ok) throw new Error("Error cargando sectores");
      return (await res.json()) as Sector[];
    },
    staleTime: 60_000,
  });
}

export function useSector(id: string | null) {
  return useQuery({
    queryKey: ["sector", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/marketplace/sectors/${id}`);
      if (!res.ok) throw new Error("Error cargando sector");
      return (await res.json()) as Sector;
    },
  });
}

export function useCreateSector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Sector>) => {
      const res = await fetch("/api/marketplace/sectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Error creando sector");
      return (await res.json()) as Sector;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sectors"] }),
  });
}

export function useUpdateSector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Sector> }) => {
      const res = await fetch(`/api/marketplace/sectors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Error actualizando sector");
      return (await res.json()) as Sector;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["sectors"] });
      qc.invalidateQueries({ queryKey: ["sector", data.id] });
    },
  });
}

export function useDeleteSector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/marketplace/sectors/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Error eliminando sector");
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sectors"] }),
  });
}

export function useTemplatesBySector(sectorId: string | null) {
  return useQuery({
    queryKey: ["templates", "sector", sectorId],
    enabled: !!sectorId,
    queryFn: async () => {
      const res = await fetch(`/api/marketplace/templates?sector=${sectorId}`);
      if (!res.ok) throw new Error("Error cargando plantillas");
      return (await res.json()) as MarketplaceTemplate[];
    },
  });
}

export function useTemplates(params: { type?: TemplateType | "all"; sector?: string | "all" } = {}) {
  const qs = new URLSearchParams();
  if (params.type && params.type !== "all") qs.set("type", params.type);
  if (params.sector && params.sector !== "all") qs.set("sector", params.sector);
  return useQuery({
    queryKey: ["templates", params],
    queryFn: async () => {
      const res = await fetch(`/api/marketplace/templates?${qs.toString()}`);
      if (!res.ok) throw new Error("Error cargando plantillas");
      return (await res.json()) as MarketplaceTemplate[];
    },
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<MarketplaceTemplate>) => {
      const res = await fetch("/api/marketplace/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Error creando plantilla");
      return (await res.json()) as MarketplaceTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<MarketplaceTemplate>;
    }) => {
      const res = await fetch(`/api/marketplace/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Error actualizando plantilla");
      return (await res.json()) as MarketplaceTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/marketplace/templates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Error eliminando plantilla");
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}
