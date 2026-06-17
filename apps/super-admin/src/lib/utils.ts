import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina clases Tailwind sin conflictos */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formatea una fecha ISO a formato local corto */
export function formatDate(
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-ES", opts).format(new Date(iso));
  } catch {
    return "—";
  }
}

/** Formatea fecha y hora */
export function formatDateTime(iso: string | null | undefined) {
  return formatDate(iso, { dateStyle: "medium", timeStyle: "short" });
}

/** Formatea un número como moneda EUR */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string = "EUR",
) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Formatea un número compacto (1.2k, 3.4M) */
export function formatCompact(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-ES", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

/** Devuelve iniciales para avatares */
export function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Trunca texto con elipsis */
export function truncate(text: string, max = 80) {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

/** Valida formato de email */
export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Genera un slug a partir de un nombre */
export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Descarga un blob como archivo */
export function downloadBlob(content: string, filename: string, type = "text/csv") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Convierte array de objetos a CSV */
export function toCSV(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ];
  return lines.join("\n");
}

/** Delay simple (para simulación de streaming / mocks) */
export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
