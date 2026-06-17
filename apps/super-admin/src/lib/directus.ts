import {
  createDirectus,
  rest,
  staticToken,
  readItems as _readItems,
  readItem as _readItem,
  createItem as _createItem,
  updateItem as _updateItem,
  deleteItem as _deleteItem,
  aggregate as _aggregate,
} from "@directus/sdk";
import type {
  Plan,
  Tenant,
  Subscription,
  Sector,
  MarketplaceTemplate,
  User,
  Conversation,
  ChatMessage,
  KpiSnapshot,
} from "@/types/directus";

// Alias permissivo: las funciones del SDK se reinterpretan como funciones
// que devuelven `RestCommand`-compatible para pasarlas a `client.request()`.
// Los wrappers de esta librería castean los resultados a nuestros tipos.
type RestCommandLike = Parameters<
  ReturnType<typeof buildClient>["request"]
>[0];
const readItems = _readItems as unknown as (
  collection: string,
  options?: Record<string, unknown>,
) => RestCommandLike;
const readItem = _readItem as unknown as (
  collection: string,
  id: string | number,
  options?: Record<string, unknown>,
) => RestCommandLike;
const createItem = _createItem as unknown as (
  collection: string,
  item: Record<string, unknown>,
) => RestCommandLike;
const updateItem = _updateItem as unknown as (
  collection: string,
  id: string | number,
  item: Record<string, unknown>,
) => RestCommandLike;
const deleteItem = _deleteItem as unknown as (
  collection: string,
  id: string | number,
) => RestCommandLike;
const aggregate = _aggregate as unknown as (
  collection: string,
  options: Record<string, unknown>,
) => RestCommandLike;

/**
 * Cliente Directus del super-admin.
 * SOLO server-side. Usa el token de servicio configurado en el entorno.
 * Nunca exponer el token al cliente.
 *
 * Nota: usamos el cliente sin schema tipado para evitar fricción con
 * la tipificación estricta del SDK; los métodos devuelven `unknown`
 * y los wrappers de esta librería los castean a nuestros tipos de
 * `@/types/directus`.
 */
const DIRECTUS_URL =
  process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_DIRECTUS_URL || "http://localhost:8055";
const SERVICE_TOKEN = process.env.DIRECTUS_SERVICE_TOKEN || "";

export const directusUrl = DIRECTUS_URL;

// Cliente sin schema (unknown). Lo usamos con `as` en cada llamada.
type AnyClient = ReturnType<typeof buildClient>;

function buildClient() {
  return createDirectus(DIRECTUS_URL)
    .with(staticToken(SERVICE_TOKEN))
    .with(rest());
}

let _client: AnyClient | null = null;
function directus(): AnyClient {
  if (!_client) _client = buildClient();
  return _client;
}

// Colecciones
type Collection =
  | "plans"
  | "tenants"
  | "subscriptions"
  | "sectors"
  | "templates"
  | "users"
  | "conversations"
  | "messages"
  | "kpi_snapshots"
  | "locations";

// ---- Lecturas (server-side) ----

export async function listTenants(params: {
  search?: string;
  status?: string;
  limit?: number;
  page?: number;
  sort?: string;
} = {}): Promise<Tenant[]> {
  const { search, status, limit = 20, page = 1, sort = "-date_created" } = params;
  const filter: Record<string, unknown> = {};
  if (status && status !== "all") filter.status = { _eq: status };
  if (search) {
    filter._or = [
      { name: { _icontains: search } },
      { slug: { _icontains: search } },
      { admin_email: { _icontains: search } },
    ];
  }
  try {
    const res = await directus().request(
      readItems("tenants", {
        filter,
        limit,
        page,
        sort,
        fields: ["*", { plan: ["*"], sector: ["*"] }],
      }),
    );
    return res as unknown as Tenant[];
  } catch (err) {
    console.error("[directus.listTenants]", err);
    return [];
  }
}

export async function getTenant(id: string): Promise<Tenant | null> {
  try {
    const res = await directus().request(
      readItem("tenants", id, {
        fields: ["*", { plan: ["*"], sector: ["*"] }],
      }),
    );
    return res as unknown as Tenant;
  } catch (err) {
    console.error("[directus.getTenant]", err);
    return null;
  }
}

export async function listPlans(): Promise<Plan[]> {
  try {
    const res = await directus().request(
      readItems("plans", { sort: "sort" }),
    );
    return res as unknown as Plan[];
  } catch (err) {
    console.error("[directus.listPlans]", err);
    return [];
  }
}

export async function listSubscriptions(params: {
  plan?: string;
  status?: string;
  limit?: number;
} = {}): Promise<Subscription[]> {
  const { plan, status, limit = 50 } = params;
  const filter: Record<string, unknown> = {};
  if (plan && plan !== "all") filter.plan_id = { _eq: plan };
  if (status && status !== "all") filter.status = { _eq: status };
  try {
    const res = await directus().request(
      readItems("subscriptions", {
        filter,
        limit,
        sort: "-current_period_end",
        fields: ["*", { tenant: ["id", "name", "slug"], plan: ["*"] }],
      }),
    );
    return res as unknown as Subscription[];
  } catch (err) {
    console.error("[directus.listSubscriptions]", err);
    return [];
  }
}

export async function listSectors(): Promise<Sector[]> {
  try {
    const res = await directus().request(
      readItems("sectors", { sort: "sort", fields: ["*"] }),
    );
    return res as unknown as Sector[];
  } catch (err) {
    console.error("[directus.listSectors]", err);
    return [];
  }
}

export async function getSector(id: string): Promise<Sector | null> {
  try {
    const res = await directus().request(readItem("sectors", id));
    return res as unknown as Sector;
  } catch (err) {
    console.error("[directus.getSector]", err);
    return null;
  }
}

export async function listTemplatesBySector(
  sectorId: string,
): Promise<MarketplaceTemplate[]> {
  try {
    const res = await directus().request(
      readItems("templates", {
        filter: { sector_id: { _eq: sectorId } },
        sort: "type,name",
      }),
    );
    return res as unknown as MarketplaceTemplate[];
  } catch (err) {
    console.error("[directus.listTemplatesBySector]", err);
    return [];
  }
}

export async function listTemplates(params: {
  type?: string;
  sector?: string;
  limit?: number;
} = {}): Promise<MarketplaceTemplate[]> {
  const { type, sector, limit = 100 } = params;
  const filter: Record<string, unknown> = {};
  if (type && type !== "all") filter.type = { _eq: type };
  if (sector && sector !== "all") filter.sector_id = { _eq: sector };
  try {
    const res = await directus().request(
      readItems("templates", {
        filter,
        limit,
        sort: "-date_created",
        fields: ["*", { sector: ["id", "name", "slug"] }],
      }),
    );
    return res as unknown as MarketplaceTemplate[];
  } catch (err) {
    console.error("[directus.listTemplates]", err);
    return [];
  }
}

export async function countBy(
  collection: Collection,
  field: string,
  value: string,
): Promise<number> {
  try {
    const res = (await directus().request(
      aggregate(collection, {
        aggregate: { count: "*" },
        query: { filter: { [field]: { _eq: value } } },
      }),
    )) as unknown as Array<Record<string, unknown>>;
    const first = res?.[0];
    if (!first) return 0;
    const countObj = (first as { count?: Record<string, number> }).count;
    if (countObj && typeof countObj === "object") {
      const keys = Object.keys(countObj);
      if (keys.length > 0) return countObj[keys[0]] ?? 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

export async function countUsersByTenant(tenantId: string): Promise<number> {
  return countBy("users", "tenant_id", tenantId);
}

export async function countLocationsByTenant(tenantId: string): Promise<number> {
  return countBy("locations", "tenant_id", tenantId);
}

export async function listConversationsGlobal(
  limit = 30,
): Promise<Conversation[]> {
  try {
    const res = await directus().request(
      readItems("conversations", {
        filter: { scope: { _eq: "global" } },
        sort: "-date_updated",
        limit,
      }),
    );
    return res as unknown as Conversation[];
  } catch (err) {
    console.error("[directus.listConversationsGlobal]", err);
    return [];
  }
}

// ---- Escrituras ----

export async function createTenant(input: {
  name: string;
  slug: string;
  plan_id: string;
  admin_email: string;
  sector_id?: string | null;
}): Promise<Tenant | null> {
  try {
    const res = await directus().request(
      createItem("tenants", { ...input, status: "pendiente" }),
    );
    return res as unknown as Tenant;
  } catch (err) {
    console.error("[directus.createTenant]", err);
    return null;
  }
}

/** Lanza el onboarding: llama al endpoint custom del backend de Directus */
export async function launchOnboarding(tenantId: string): Promise<{
  ok: boolean;
  message?: string;
}> {
  try {
    const res = await fetch(`${DIRECTUS_URL}/onboarding/tenant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_TOKEN}`,
      },
      body: JSON.stringify({ tenant_id: tenantId }),
    });
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, message: txt || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[directus.launchOnboarding]", err);
    return { ok: false, message: String(err) };
  }
}

export async function updateTenant(
  id: string,
  patch: Partial<Tenant>,
): Promise<Tenant | null> {
  try {
    const res = await directus().request(updateItem("tenants", id, patch));
    return res as unknown as Tenant;
  } catch (err) {
    console.error("[directus.updateTenant]", err);
    return null;
  }
}

export async function createPlan(input: Partial<Plan>): Promise<Plan | null> {
  try {
    const res = await directus().request(createItem("plans", input));
    return res as unknown as Plan;
  } catch (err) {
    console.error("[directus.createPlan]", err);
    return null;
  }
}

export async function updatePlan(
  id: string,
  patch: Partial<Plan>,
): Promise<Plan | null> {
  try {
    const res = await directus().request(updateItem("plans", id, patch));
    return res as unknown as Plan;
  } catch (err) {
    console.error("[directus.updatePlan]", err);
    return null;
  }
}

export async function deletePlan(id: string): Promise<boolean> {
  try {
    await directus().request(deleteItem("plans", id));
    return true;
  } catch (err) {
    console.error("[directus.deletePlan]", err);
    return false;
  }
}

export async function createSector(
  input: Partial<Sector>,
): Promise<Sector | null> {
  try {
    const res = await directus().request(createItem("sectors", input));
    return res as unknown as Sector;
  } catch (err) {
    console.error("[directus.createSector]", err);
    return null;
  }
}

export async function updateSector(
  id: string,
  patch: Partial<Sector>,
): Promise<Sector | null> {
  try {
    const res = await directus().request(updateItem("sectors", id, patch));
    return res as unknown as Sector;
  } catch (err) {
    console.error("[directus.updateSector]", err);
    return null;
  }
}

export async function deleteSector(id: string): Promise<boolean> {
  try {
    await directus().request(deleteItem("sectors", id));
    return true;
  } catch (err) {
    console.error("[directus.deleteSector]", err);
    return false;
  }
}

export async function createTemplate(
  input: Partial<MarketplaceTemplate>,
): Promise<MarketplaceTemplate | null> {
  try {
    const res = await directus().request(createItem("templates", input));
    return res as unknown as MarketplaceTemplate;
  } catch (err) {
    console.error("[directus.createTemplate]", err);
    return null;
  }
}

export async function updateTemplate(
  id: string,
  patch: Partial<MarketplaceTemplate>,
): Promise<MarketplaceTemplate | null> {
  try {
    const res = await directus().request(updateItem("templates", id, patch));
    return res as unknown as MarketplaceTemplate;
  } catch (err) {
    console.error("[directus.updateTemplate]", err);
    return null;
  }
}

export async function deleteTemplate(id: string): Promise<boolean> {
  try {
    await directus().request(deleteItem("templates", id));
    return true;
  } catch (err) {
    console.error("[directus.deleteTemplate]", err);
    return false;
  }
}

// ---- KPIs agregados ----

export async function getKpis(): Promise<KpiSnapshot | null> {
  try {
    const res = await directus().request(
      readItems("kpi_snapshots", { limit: 1, sort: "-date_created" }),
    );
    const arr = res as unknown as KpiSnapshot[];
    return arr?.[0] ?? null;
  } catch (err) {
    console.error("[directus.getKpis]", err);
    return null;
  }
}

/** Login admin contra Directus. Devuelve access_token o null. */
export async function loginWithDirectus(
  email: string,
  password: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${DIRECTUS_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { access_token?: string } };
    return data.data?.access_token ?? null;
  } catch (err) {
    console.error("[directus.loginWithDirectus]", err);
    return null;
  }
}

/** Obtiene el perfil del usuario autenticado con su token */
export async function getMe(accessToken: string): Promise<User | null> {
  try {
    const res = await fetch(`${DIRECTUS_URL}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: User };
    return data.data ?? null;
  } catch (err) {
    console.error("[directus.getMe]", err);
    return null;
  }
}

// Reexportamos tipos usados externamente
export type { ChatMessage, Conversation, User };
