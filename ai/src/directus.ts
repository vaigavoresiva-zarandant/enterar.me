/**
 * src/directus.ts
 * Cliente HTTP para Directus usado por las skills.
 * Las skills hacen POST/GET/PATCH a /items/<collection> con el service token.
 * Siempre filtran por tenant_id (cabecera o en el payload según hook de Directus).
 */
import { config } from "./config.js";

export class DirectusError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "DirectusError";
    this.status = status;
    this.body = body;
  }
}

interface DirectusRequestOptions {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string; // p.ej. /items/ubicaciones
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

function buildUrl(path: string, query?: DirectusRequestOptions["query"]): string {
  const url = new URL(path, config.DIRECTUS_URL);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function directusRequest<T = unknown>(
  opts: DirectusRequestOptions
): Promise<T> {
  const url = buildUrl(opts.path, opts.query);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.DIRECTUS_SERVICE_TOKEN}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    method: opts.method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let json: unknown = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = text;
  }

  if (!res.ok) {
    const errors = (json as { errors?: { message?: string }[] })?.errors;
    const message =
      errors && errors.length > 0 && errors[0].message
        ? errors[0].message
        : `Directus ${res.status} ${res.statusText}`;
    throw new DirectusError(res.status, message, json);
  }

  return (json as { data?: T }).data ?? (json as T);
}

export const directus = {
  get: <T = unknown>(
    path: string,
    query?: DirectusRequestOptions["query"]
  ): Promise<T> => directusRequest<T>({ method: "GET", path, query }),

  post: <T = unknown>(
    path: string,
    body: unknown,
    query?: DirectusRequestOptions["query"]
  ): Promise<T> => directusRequest<T>({ method: "POST", path, body, query }),

  patch: <T = unknown>(
    path: string,
    body: unknown,
    query?: DirectusRequestOptions["query"]
  ): Promise<T> => directusRequest<T>({ method: "PATCH", path, body, query }),

  delete: <T = unknown>(
    path: string,
    query?: DirectusRequestOptions["query"]
  ): Promise<T> => directusRequest<T>({ method: "DELETE", path, query }),
};
