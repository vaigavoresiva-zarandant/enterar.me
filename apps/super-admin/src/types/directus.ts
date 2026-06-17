// Tipos del schema Directus de ENTERAR.ME (super-admin)
// Reflejan las colecciones que el agente del backend crea en Directus.

export type PlanCode = "free" | "starter" | "pro" | "enterprise";
export type TenantStatus = "activo" | "pendiente" | "suspendido" | "cancelado";
export type SubscriptionStatus =
  | "activa"
  | "trialing"
  | "past_due"
  | "cancelada"
  | "pausada";

export interface Plan {
  id: string;
  code: PlanCode;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  max_users: number;
  max_locations: number;
  max_materials: number;
  max_conversations_per_month: number;
  features: Record<string, unknown> | null;
  is_active: boolean;
  sort: number | null;
  date_created: string | null;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  sector_id: string | null;
  plan_id: string | null;
  admin_email: string | null;
  country: string | null;
  city: string | null;
  timezone: string | null;
  metadata: Record<string, unknown> | null;
  last_activity: string | null;
  date_created: string;
  date_updated: string | null;
  // relaciones
  plan?: Plan | null;
  sector?: Sector | null;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  billing_cycle: "monthly" | "yearly";
  current_period_start: string;
  current_period_end: string;
  amount: number;
  currency: string;
  payment_method: string | null;
  canceled_at: string | null;
  trial_ends_at: string | null;
  date_created: string;
  // relaciones
  tenant?: Pick<Tenant, "id" | "name" | "slug">;
  plan?: Plan;
}

export interface Sector {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  is_published: boolean;
  sort: number | null;
  date_created: string;
  templates_count?: number;
}

export type TemplateType =
  | "addon"
  | "pipeline"
  | "material"
  | "tarea"
  | "usuario";

export interface MarketplaceTemplate {
  id: string;
  sector_id: string;
  type: TemplateType;
  name: string;
  slug: string;
  description: string | null;
  config: Record<string, unknown>;
  is_published: boolean;
  version: string;
  date_created: string;
  date_updated: string | null;
  // relaciones
  sector?: Pick<Sector, "id" | "name" | "slug">;
}

export interface User {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string | null;
  status: string;
  tenant_id: string | null;
  avatar: string | null;
  last_access: string | null;
  date_created: string;
}

export interface Conversation {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  title: string | null;
  scope: "tenant" | "global";
  status: "active" | "archived";
  skill_last_used: string | null;
  message_count: number;
  date_created: string;
  date_updated: string | null;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  skill: string | null;
  metadata: Record<string, unknown> | null;
  date_created: string;
}

export interface KpiSnapshot {
  tenants_active: number;
  tenants_total: number;
  mrr_estimate: number;
  arr_estimate: number;
  sectors_published: number;
  templates_published: number;
  conversations_today: number;
  churn_rate_30d: number;
}
