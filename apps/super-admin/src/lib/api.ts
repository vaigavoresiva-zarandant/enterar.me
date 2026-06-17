/** Helpers de fetch para llamadas internas (route handlers → servicio IA / Directus). */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return Response.json(data, init);
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

/** Pequeño wrapper para fetch JSON con timeout */
export async function safeFetch<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 15000,
): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new ApiError(txt || `HTTP ${res.status}`, res.status);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}
