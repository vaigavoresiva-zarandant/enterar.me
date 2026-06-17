"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { Tenant, TenantStatus } from "@/types/directus";

/** Lista de tenants (server fetch vía route handler) */
export function useTenants(params: {
  search?: string;
  status?: string;
  page?: number;
}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.status && params.status !== "all") qs.set("status", params.status);
  qs.set("page", String(params.page ?? 1));
  return useQuery({
    queryKey: ["tenants", params],
    queryFn: async () => {
      const res = await fetch(`/api/tenants?${qs.toString()}`);
      if (!res.ok) throw new Error("Error cargando tenants");
      return (await res.json()) as Tenant[];
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

/** Detalle de un tenant */
export function useTenant(id: string | null) {
  return useQuery({
    queryKey: ["tenant", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${id}`);
      if (!res.ok) throw new Error("Error cargando tenant");
      return (await res.json()) as Tenant & {
        users_count?: number;
        locations_count?: number;
      };
    },
  });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      slug: string;
      plan_id: string;
      admin_email: string;
      sector_id?: string | null;
    }) => {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "Error creando tenant");
      }
      return (await res.json()) as Tenant;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenants"] }),
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Tenant>;
    }) => {
      const res = await fetch(`/api/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Error actualizando tenant");
      return (await res.json()) as Tenant;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["tenant", data.id] });
    },
  });
}

export function useLaunchOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tenants/${id}/onboarding`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Error lanzando onboarding");
      return (await res.json()) as { ok: boolean; message?: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenants"] }),
  });
}

export function useSuspendTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: TenantStatus;
    }) => {
      const res = await fetch(`/api/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Error cambiando estado");
      return (await res.json()) as Tenant;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenants"] }),
  });
}
