#!/usr/bin/env bash
# ============================================================
# ENTERAR.ME — create-superadmin.sh
# ------------------------------------------------------------
# Asegura que el usuario admin@enterarme.me existe con rol super-admin
# (UUID 00000000-0000-0000-0000-000000000001, definido en seed/superadmin.json)
# y le asigna un token de servicio (lo crea o lista los existentes).
#
# Si el usuario no existe: lo crea (vía /users) con el password indicado.
# Si ya existe: solo asegura el rol y muestra info de tokens.
#
# Variables de entorno:
#   DIRECTUS_URL                  (default http://localhost:8055)
#   DIRECTUS_ADMIN_EMAIL          (default admin@enterarme.me)
#   DIRECTUS_ADMIN_PASSWORD       (default admin123 — override obligado en prod)
#   SUPERADMIN_FIRST_NAME         (default "ENTERAR.ME")
#   SUPERADMIN_LAST_NAME          (default "Super Admin")
#   SUPERADMIN_ROLE_ID            (default 00000000-0000-0000-0000-000000000001)
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
SUPERADMIN_FIRST_NAME="${SUPERADMIN_FIRST_NAME:-ENTERAR.ME}"
SUPERADMIN_LAST_NAME="${SUPERADMIN_LAST_NAME:-Super Admin}"
SUPERADMIN_ROLE_ID="${SUPERADMIN_ROLE_ID:-00000000-0000-0000-0000-000000000001}"

# ---------- Deps ----------
need() { command -v "$1" >/dev/null 2>&1 || die "Dependencia no encontrada: $1"; }
need curl
need jq

# ---------- Helpers ----------
# Login. Si el admin no existe todavía (fresco tras apply_schema + seed), no podemos
# loguear — en ese caso dependemos del entrypoint del contenedor Directus que crea el
# primer admin con ADMIN_EMAIL/ADMIN_PASSWORD. Si el login falla, se intenta crear
# el user con una llamada autenticada por token de servicio si existe.
login_or_die() {
  local resp
  resp=$(curl -sS -X POST "${DIRECTUS_URL}/auth/login" \
        -H 'Content-Type: application/json' \
        -d "$(jq -cn --arg e "$DIRECTUS_ADMIN_EMAIL" --arg p "$DIRECTUS_ADMIN_PASSWORD" '{email:$e,password:$p}')")
  echo "$resp" | jq -er '.data.access_token' 2>/dev/null || {
    err "Login como ${DIRECTUS_ADMIN_EMAIL} fallido."
    err "Si el usuario no existe todavía, ejecuta primero scripts/init-directus.sh (que aplica el seed superadmin)."
    err "Respuesta:"
    echo "$resp" | jq . 2>/dev/null || echo "$resp"
    die "Abortando."
  }
}

# Busca el user por email → devuelve id o string vacío
find_user_id() {
  curl -sS "${DIRECTUS_URL}/users?filter[email][_eq]=${DIRECTUS_ADMIN_EMAIL}&fields=id,role" \
       -H "Authorization: Bearer ${TOKEN}" \
       | jq -r '.data[0].id // empty'
}

# Asegura que el rol super-admin existe
ensure_role() {
  log "Verificando rol super-admin (${SUPERADMIN_ROLE_ID})…"
  local exists
  exists=$(curl -sS "${DIRECTUS_URL}/roles/${SUPERADMIN_ROLE_ID}" \
                -H "Authorization: Bearer ${TOKEN}" \
                -o /tmp/role.out -w '%{http_code}')
  if [[ "$exists" == "200" ]]; then
    ok "Rol super-admin ya existe"
  else
    warn "Rol no encontrado (HTTP ${exists}). Creándolo…"
    curl -sS -X POST "${DIRECTUS_URL}/roles" \
         -H "Authorization: Bearer ${TOKEN}" \
         -H 'Content-Type: application/json' \
         -d "$(jq -cn --arg id "$SUPERADMIN_ROLE_ID" '{
            id:$id, name:"super-admin", icon:"verified",
            description:"Super administrador de la plataforma ENTERAR.ME (acceso total implícito)",
            enforce_tfa:false, app_access:true, admin_access:true
          }')" >/dev/null
    ok "Rol super-admin creado"
  fi
}

# Crea o actualiza el user admin
ensure_user() {
  log "Verificando user admin@${DIRECTUS_ADMIN_EMAIL}…"
  USER_ID="$(find_user_id)"
  if [[ -n "$USER_ID" ]]; then
    ok "User ya existe (id=${USER_ID}). Asegurando rol super-admin…"
    curl -sS -X PATCH "${DIRECTUS_URL}/users/${USER_ID}" \
         -H "Authorization: Bearer ${TOKEN}" \
         -H 'Content-Type: application/json' \
         -d "$(jq -cn --arg r "$SUPERADMIN_ROLE_ID" '{role:$r, status:"active"}')" >/dev/null
    ok "Rol asignado"
    MODE="existing"
  else
    warn "User no existe. Creándolo…"
    local resp
    resp=$(curl -sS -X POST "${DIRECTUS_URL}/users" \
          -H "Authorization: Bearer ${TOKEN}" \
          -H 'Content-Type: application/json' \
          -d "$(jq -cn \
            --arg e "$DIRECTUS_ADMIN_EMAIL" \
            --arg p "$DIRECTUS_ADMIN_PASSWORD" \
            --arg f "$SUPERADMIN_FIRST_NAME" \
            --arg l "$SUPERADMIN_LAST_NAME" \
            --arg r "$SUPERADMIN_ROLE_ID" \
            '{email:$e,password:$p,first_name:$f,last_name:$l,role:$r,status:"active"}')")
    USER_ID=$(echo "$resp" | jq -er '.data.id' 2>/dev/null) || {
      err "No se pudo crear el user. Respuesta:"
      echo "$resp" | jq . 2>/dev/null || echo "$resp"
      die "Abortando."
    }
    ok "User creado (id=${USER_ID})"
    MODE="created"
  fi
}

# Crea un token de servicio nuevo (POST /tokens) — Directus devuelve el valor en claro una sola vez.
create_token() {
  log "Creando token de servicio para ${USER_ID}…"
  local resp
  resp=$(curl -sS -X POST "${DIRECTUS_URL}/tokens" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H 'Content-Type: application/json' \
        -d "$(jq -cn --arg u "$USER_ID" '{user:$u,name:"service-token",access:["server"],exp:0}')")
  local tk
  tk=$(echo "$resp" | jq -er '.data.token' 2>/dev/null) || {
    warn "No se pudo crear el token. Respuesta:"
    echo "$resp" | jq . 2>/dev/null || echo "$resp"
    return 0
  }
  SERVICE_TOKEN="$tk"
}

print_summary() {
  echo
  printf '%s═══════════════════════════════════════════════════════════%s\n' "${C_BOLD}" "${C_RESET}"
  printf '%s ENTERAR.ME — Super Admin %s\n' "${C_BOLD}" "${C_RESET}"
  printf '%s═══════════════════════════════════════════════════════════%s\n' "${C_BOLD}" "${C_RESET}"
  printf '  Modo          : %s\n' "$([[ "$MODE" == "created" ]] && echo "Creado nuevo" || echo "Ya existía — rol actualizado")"
  printf '  User id       : %s\n' "$USER_ID"
  printf '  Email         : %s\n' "$DIRECTUS_ADMIN_EMAIL"
  printf '  Rol           : super-admin (%s)\n' "$SUPERADMIN_ROLE_ID"
  if [[ -n "${SERVICE_TOKEN:-}" ]]; then
    printf '  Service token : %s%s%s (GUÁRDALO EN .env COMO DIRECTUS_SERVICE_TOKEN)%s\n' \
      "$C_YELLOW" "$SERVICE_TOKEN" "$C_BOLD" "$C_RESET"
  else
    printf '  Service token : (no creado — usa el panel Directus para crearlo si lo necesitas)\n'
  fi
  printf '%s═══════════════════════════════════════════════════════════%s\n' "${C_BOLD}" "${C_RESET}"
}

# ---------- Main ----------
main() {
  log "ENTERAR.ME — create-superadmin"
  log "DIRECTUS_URL=${DIRECTUS_URL}"
  log "EMAIL=${DIRECTUS_ADMIN_EMAIL}"

  TOKEN="$(login_or_die)"
  ok "Login OK"

  ensure_role
  ensure_user
  create_token
  print_summary
}

main "$@"
