#!/usr/bin/env bash
# ============================================================
# ENTERAR.ME — create-tenant.sh
# ------------------------------------------------------------
# Crea un tenant vía el endpoint custom POST /onboarding/tenant
# de Directus (extension endpoints/enterarme-onboarding).
# El endpoint ejecuta TODO el onboarding en una transacción:
#   tenant + suscripción + user admin + rol + sede + usuario externo
#   empresa propia + usuario interno + material "App ENTERAR.ME"
#   + 2 tareas (configurar + alta stock) + plantillas del sector.
#
# Uso:
#   bash scripts/create-tenant.sh \
#     --name    "Mi Empresa" \
#     --slug    mi-empresa \
#     --plan    pro \
#     --email   admin@miempresa.com \
#     --password <password> \
#     --sector  <sector-uuid>   # opcional
#
#   --plan acepta el nombre del plan (Starter|Pro|Enterprise) o un UUID.
#   Si es nombre, se resuelve a UUID vía GET /items/planes.
#
# Variables de entorno:
#   DIRECTUS_URL                (default http://localhost:8055)
#   DIRECTUS_SERVICE_TOKEN      token de servicio (obligatorio — lo pide el endpoint)
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
DIRECTUS_SERVICE_TOKEN="${DIRECTUS_SERVICE_TOKEN:-}"

# ---------- Deps ----------
need() { command -v "$1" >/dev/null 2>&1 || die "Dependencia no encontrada: $1"; }
need curl
need jq

# ---------- Parse args ----------
NAME=""
SLUG=""
PLAN=""
EMAIL=""
PASSWORD=""
SECTOR=""

usage() {
  cat <<EOF
Uso: $0 --name N --slug S --plan P --email E --password P [--sector UUID]

  --name       Nombre del tenant (obligatorio)
  --slug       Slug único (obligatorio, se normaliza a minúsculas + guiones)
  --plan       Nombre del plan (Starter|Pro|Enterprise) o UUID (obligatorio)
  --email      Email del admin del tenant (obligatorio)
  --password   Password del admin del tenant (mín 8 chars, obligatorio)
  --sector     UUID del sector de mercado (opcional — instala plantillas del sector)
  -h, --help   Muestra esta ayuda

Variables de entorno usadas:
  DIRECTUS_URL            Endpoint de Directus (default http://localhost:8055)
  DIRECTUS_SERVICE_TOKEN  Token de servicio (obligatorio)
EOF
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)     NAME="$2"; shift 2;;
    --slug)     SLUG="$2"; shift 2;;
    --plan)     PLAN="$2"; shift 2;;
    --email)    EMAIL="$2"; shift 2;;
    --password) PASSWORD="$2"; shift 2;;
    --sector)   SECTOR="$2"; shift 2;;
    -h|--help)  usage 0;;
    *) err "Argumento desconocido: $1"; usage 1;;
  esac
done

[[ -z "$NAME" ]]     && { err "Falta --name";     usage 1; }
[[ -z "$SLUG" ]]     && { err "Falta --slug";     usage 1; }
[[ -z "$PLAN" ]]     && { err "Falta --plan";     usage 1; }
[[ -z "$EMAIL" ]]    && { err "Falta --email";    usage 1; }
[[ -z "$PASSWORD" ]] && { err "Falta --password"; usage 1; }
[[ ${#PASSWORD} -lt 8 ]] && die "--password debe tener al menos 8 caracteres"
[[ -z "$DIRECTUS_SERVICE_TOKEN" ]] && die "DIRECTUS_SERVICE_TOKEN no definido. Expórtalo o define DIRECTUS_SERVICE_TOKEN en .env"

# ---------- Resolve plan name → UUID ----------
resolve_plan() {
  # Si ya parece un UUID, devolverlo tal cual
  if [[ "$PLAN" =~ ^[0-9a-fA-F-]{36}$ ]]; then
    echo "$PLAN"
    return
  fi
  log "Resolviendo plan '${PLAN}' a UUID…"
  local plan_lower
  plan_lower=$(echo "$PLAN" | tr '[:upper:]' '[:lower:]')
  local pid
  pid=$(curl -sS "${DIRECTUS_URL}/items/planes?filter[nombre][_icontains]=${PLAN}&fields=id,nombre,activo" \
        -H "Authorization: Bearer ${DIRECTUS_SERVICE_TOKEN}" \
        | jq -r --arg n "$plan_lower" '.data[] | select((.nombre|ascii_downcase)==$n) | select(.activo==true) | .id' | head -n1)
  [[ -z "$pid" ]] && die "No se encontró ningún plan activo con nombre '${PLAN}'. Lista disponibles: curl ${DIRECTUS_URL}/items/planes"
  echo "$pid"
}

PLAN_ID="$(resolve_plan)"
ok "Plan: ${PLAN} → ${PLAN_ID}"

# ---------- Build payload ----------
PAYLOAD=$(jq -cn \
  --arg n "$NAME" \
  --arg s "$SLUG" \
  --arg p "$PLAN_ID" \
  --arg e "$EMAIL" \
  --arg pw "$PASSWORD" \
  --arg sc "$SECTOR" \
  '{nombre:$n, slug:$s, plan_id:$p, admin_email:$e, admin_password:$pw}
   + (if ($sc|length)>0 then {sector_id:$sc} else {} end)')

log "Llamando a POST ${DIRECTUS_URL}/onboarding/tenant…"
log "Payload: $(echo "$PAYLOAD" | jq -c .)"

# ---------- Call endpoint ----------
RESP_FILE=$(mktemp)
HTTP_CODE=$(curl -sS -o "$RESP_FILE" -w '%{http_code}' \
  -X POST "${DIRECTUS_URL}/onboarding/tenant" \
  -H "Authorization: Bearer ${DIRECTUS_SERVICE_TOKEN}" \
  -H 'Content-Type: application/json' \
  --data "$PAYLOAD")

echo
if [[ "$HTTP_CODE" == "201" ]]; then
  ok "Tenant creado correctamente (HTTP 201)"
  printf '%s═══════════════════════════════════════════════════════════%s\n' "${C_BOLD}" "${C_RESET}"
  printf '%s Onboarding OK %s\n' "${C_BOLD}" "${C_RESET}"
  printf '%s═══════════════════════════════════════════════════════════%s\n' "${C_BOLD}" "${C_RESET}"
  jq . "$RESP_FILE"
  printf '%s═══════════════════════════════════════════════════════════%s\n' "${C_BOLD}" "${C_RESET}"
  echo
  TENANT_ID=$(jq -r '.tenant_id' "$RESP_FILE")
  log "Tenant '${NAME}' creado con id=${TENANT_ID}"
  log "Login del admin: ${TENANT_ADMIN_PUBLIC_URL:-https://app.enterarme.me}/${SLUG} con ${EMAIL}"
else
  err "El endpoint respondió HTTP ${HTTP_CODE}"
  err "Respuesta:"
  jq . "$RESP_FILE" 2>/dev/null || cat "$RESP_FILE"
  rm -f "$RESP_FILE"
  exit 1
fi
rm -f "$RESP_FILE"
