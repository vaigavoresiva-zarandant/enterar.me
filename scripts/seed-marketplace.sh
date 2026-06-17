#!/usr/bin/env bash
# ============================================================
# ENTERAR.ME — seed-marketplace.sh
# ------------------------------------------------------------
# Re-importa SOLO los seeds de marketplace (sectores) y planes.
# Útil tras editar esos seeds para re-aplicarlos sin tocar el superadmin.
#
# Variables de entorno:
#   DIRECTUS_URL                  (default http://localhost:8055)
#   DIRECTUS_ADMIN_EMAIL          (default admin@enterarme.me)
#   DIRECTUS_ADMIN_PASSWORD       (default admin123)
#   SEED_DIR                      (default ./directus/seed)
# ============================================================
set -euo pipefail

# ---------- Colores ----------
if [[ -t 1 ]]; then
  C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'
  C_BLUE=$'\033[34m'; C_CYAN=$'\033[36m'; C_BOLD=$'\033[1m'; C_RESET=$'\033[0m'
else
  C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_CYAN=""; C_BOLD=""; C_RESET=""
fi
log()  { printf '%s▸ %s%s\n' "${C_BLUE}" "$*" "${C_RESET}"; }
ok()   { printf '%s✓ %s%s\n' "${C_GREEN}" "$*" "${C_RESET}"; }
warn() { printf '%s⚠ %s%s\n' "${C_YELLOW}" "$*" "${C_RESET}"; }
err()  { printf '%s✗ %s%s\n' "${C_RED}" "$*" "${C_RESET}" >&2; }
die()  { err "$*"; exit 1; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${ROOT_DIR}/.env" ]]; then
  # shellcheck disable=SC1090
  set -a; . "${ROOT_DIR}/.env"; set +a
fi

DIRECTUS_URL="${DIRECTUS_URL:-${DIRECTUS_PUBLIC_URL:-http://localhost:8055}}"
DIRECTUS_ADMIN_EMAIL="${DIRECTUS_ADMIN_EMAIL:-admin@enterarme.me}"
DIRECTUS_ADMIN_PASSWORD="${DIRECTUS_ADMIN_PASSWORD:-admin123}"
SEED_DIR="${SEED_DIR:-${ROOT_DIR}/directus/seed}"

# ---------- Deps ----------
need() { command -v "$1" >/dev/null 2>&1 || die "Dependencia no encontrada: $1"; }
need curl
need jq

# ---------- Helpers ----------
login() {
  local resp
  resp=$(curl -sS -X POST "${DIRECTUS_URL}/auth/login" \
        -H 'Content-Type: application/json' \
        -d "$(jq -cn --arg e "$DIRECTUS_ADMIN_EMAIL" --arg p "$DIRECTUS_ADMIN_PASSWORD" '{email:$e,password:$p}')")
  echo "$resp" | jq -er '.data.access_token' 2>/dev/null || {
    err "Login fallido. Respuesta:"
    echo "$resp" | jq . 2>/dev/null || echo "$resp"
    die "Revisa DIRECTUS_ADMIN_EMAIL / DIRECTUS_ADMIN_PASSWORD."
  }
}

import_seed_file() {
  local file="$1" label="$2"
  if [[ ! -f "$file" ]]; then warn "Seed no encontrado: $file"; return 0; fi
  log "Importando '${label}' (${file})…"

  local collections
  collections=$(jq -r 'keys[] | select(startswith("$")|not) | select(startswith("_")|not)' "$file")
  [[ -z "$collections" ]] && { warn "  sin colecciones importables en ${file}"; return 0; }

  local coll
  for coll in $collections; do
    log "  → colección: ${coll}"
    local tmp; tmp=$(mktemp)
    jq -c --arg c "$coll" '.[$c]' "$file" > "$tmp"
    local http_code body
    body=$(mktemp)
    http_code=$(curl -sS -o "$body" -w '%{http_code}' \
      -X POST "${DIRECTUS_URL}/utils/import/${coll}" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H 'Content-Type: application/json' \
      --data-binary "@${tmp}")
    rm -f "$tmp" "$body"
    if [[ "$http_code" == "200" || "$http_code" == "201" || "$http_code" == "204" ]]; then
      ok "    importado (${http_code})"
    else
      warn "    HTTP ${http_code} en ${coll} (probablemente ya existían items con mismo id — OK si es upsert)"
    fi
  done
}

# ---------- Main ----------
main() {
  log "ENTERAR.ME — re-seed marketplace + planes"
  log "DIRECTUS_URL=${DIRECTUS_URL}"

  TOKEN="$(login)"
  ok "Login OK"

  import_seed_file "${SEED_DIR}/planes.json"                 "planes de suscripción"
  import_seed_file "${SEED_DIR}/marketplace-sectores.json"   "marketplace de sectores"

  echo
  ok "Re-seed completado. Verifica los cambios en el panel de Directus (admin → marketplace / planes)."
}

main "$@"
