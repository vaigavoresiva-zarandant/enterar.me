#!/usr/bin/env bash
# ============================================================
# ENTERAR.ME — init-directus.sh
# ------------------------------------------------------------
# Inicializa un Directus ya corriendo con:
#   1. Apply del schema snapshot (directus/snapshots/schema-snapshot.yaml)
#   2. Import de los 3 seeds (superadmin, planes, marketplace-sectores)
#   3. Creación del token de servicio para el super-admin
#   4. Resumen final
#
# Puede ejecutarse contra:
#   - Un Directus local del docker-compose (docker compose exec directus ...)
#   - Un Directus remoto (Coolify) vía API REST + npx directus CLI desde fuera.
#
# Estrategia por defecto: API REST contra ${DIRECTUS_PUBLIC_URL} para los seeds
# y `docker compose exec directus npx directus schema apply` para el snapshot
# cuando se detecta entorno local (CONTAINER_MODE=1). Si no hay docker, cae
# a `npx directus schema apply` ejecutado desde ./directus.
#
# Variables de entorno (todas con defaults razonables para dev local):
#   DIRECTUS_URL                  (default http://localhost:8055)
#   DIRECTUS_ADMIN_EMAIL          (default admin@enterarme.me)
#   DIRECTUS_ADMIN_PASSWORD       (default admin123 — override obligado en prod)
#   DIRECTUS_SERVICE_TOKEN        (si ya existe, se reutiliza; si no, se crea)
#   DIRECTUS_CONTAINER            (default directus — nombre del servicio docker)
#   USE_DOCKER                    (default 1 si `docker` está disponible)
#   SEED_DIR                      (default ./directus/seed)
#   SNAPSHOT_PATH                 (default ./directus/snapshots/schema-snapshot.yaml)
# ============================================================
set -euo pipefail

# ---------- Colores ----------
if [[ -t 1 ]]; then
  C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'
  C_BLUE=$'\033[34m'; C_PURPLE=$'\033[35m'; C_CYAN=$'\033[36m'
  C_BOLD=$'\033[1m';  C_RESET=$'\033[0m'
else
  C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_PURPLE=""; C_CYAN=""; C_BOLD=""; C_RESET=""
fi

log()  { printf '%s▸ %s%s\n' "${C_BLUE}" "$*" "${C_RESET}"; }
ok()   { printf '%s✓ %s%s\n' "${C_GREEN}" "$*" "${C_RESET}"; }
warn() { printf '%s⚠ %s%s\n' "${C_YELLOW}" "$*" "${C_RESET}"; }
err()  { printf '%s✗ %s%s\n' "${C_RED}" "$*" "${C_RESET}" >&2; }
die()  { err "$*"; exit 1; }

# ---------- Cargar .env si existe ----------
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${ROOT_DIR}/.env" ]]; then
  # shellcheck disable=SC1090
  set -a; . "${ROOT_DIR}/.env"; set +a
fi

# ---------- Defaults ----------
DIRECTUS_URL="${DIRECTUS_URL:-${DIRECTUS_PUBLIC_URL:-http://localhost:8055}}"
DIRECTUS_ADMIN_EMAIL="${DIRECTUS_ADMIN_EMAIL:-admin@enterarme.me}"
DIRECTUS_ADMIN_PASSWORD="${DIRECTUS_ADMIN_PASSWORD:-admin123}"
DIRECTUS_SERVICE_TOKEN="${DIRECTUS_SERVICE_TOKEN:-}"
DIRECTUS_CONTAINER="${DIRECTUS_CONTAINER:-directus}"
USE_DOCKER="${USE_DOCKER:-1}"
SEED_DIR="${SEED_DIR:-${ROOT_DIR}/directus/seed}"
SNAPSHOT_PATH="${SNAPSHOT_PATH:-${ROOT_DIR}/directus/snapshots/schema-snapshot.yaml}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"   # segundos máx a esperar health

# ---------- Deps ----------
need() { command -v "$1" >/dev/null 2>&1 || die "Dependencia no encontrada: $1"; }
need curl
need jq

# ---------- Helpers ----------
# Login contra Directus → devuelve access token (exportado a $TOKEN)
directus_login() {
  local email="$1" pass="$2"
  local resp
  resp=$(curl -sS -X POST "${DIRECTUS_URL}/auth/login" \
        -H 'Content-Type: application/json' \
        -d "$(jq -cn --arg e "$email" --arg p "$pass" '{email:$e,password:$p}')")
  local tk
  tk=$(echo "$resp" | jq -er '.data.access_token' 2>/dev/null) || {
    err "Login fallido. Respuesta de Directus:"
    echo "$resp" | jq . 2>/dev/null || echo "$resp"
    die "Revisa DIRECTUS_ADMIN_EMAIL / DIRECTUS_ADMIN_PASSWORD y que DIRECTUS_URL=${DIRECTUS_URL} sea correcto."
  }
  echo "$tk"
}

# Wait until /server/health returns 200
wait_directus() {
  log "Esperando a Directus en ${DIRECTUS_URL} (timeout ${HEALTH_TIMEOUT}s)…"
  local elapsed=0
  while (( elapsed < HEALTH_TIMEOUT )); do
    if curl -fsS "${DIRECTUS_URL}/server/health" >/dev/null 2>&1; then
      ok "Directus responde en /server/health"
      return 0
    fi
    sleep 2; elapsed=$((elapsed + 2))
    printf '%s.%s' "${C_CYAN}" "${C_RESET}"
  done
  echo
  die "Directus no respondió en ${HEALTH_TIMEOUT}s en ${DIRECTUS_URL}/server/health"
}

# Apply schema snapshot. Si hay docker y el contenedor existe, lo ejecuta dentro.
apply_schema() {
  log "Aplicando schema snapshot: ${SNAPSHOT_PATH}"
  if [[ ! -f "$SNAPSHOT_PATH" ]]; then
    die "No existe el snapshot: $SNAPSHOT_PATH"
  fi

  if [[ "$USE_DOCKER" == "1" ]] && command -v docker >/dev/null 2>&1 \
     && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$DIRECTUS_CONTAINER"; then
    log "Ejecutando schema apply dentro del contenedor docker (${DIRECTUS_CONTAINER})…"
    docker cp "$SNAPSHOT_PATH" "${DIRECTUS_CONTAINER}:/directus/snapshots/schema-snapshot.yaml"
    docker exec -i "$DIRECTUS_CONTAINER" \
      npx directus schema apply /directus/snapshots/schema-snapshot.yaml -y
  else
    warn "No se detectó docker/${DIRECTUS_CONTAINER}. Aplicando schema con npx local desde ./directus…"
    ( cd "${ROOT_DIR}/directus" && npx directus schema apply ./snapshots/schema-snapshot.yaml -y )
  fi
  ok "Schema aplicado"
}

# Importa un seed JSON vía API REST: POST /utils/import/{collection}
# Directus soporta import por colección a partir de un JSON con la estructura
# { "<collection>": [ {...}, {...} ] }. Si el seed tiene esa estructura, itera.
import_seed_file() {
  local file="$1" label="$2"
  if [[ ! -f "$file" ]]; then
    warn "Seed no encontrado, se omite: $file"
    return 0
  fi
  log "Importando seed '${label}' (${file})…"

  # El seed puede tener varias colecciones top-level (p.ej. superadmin.json
  # tiene directus_roles + directus_users; planes.json tiene solo planes).
  # Iteramos las claves que NO empiecen por $ o _ (comentarios/metadata).
  local collections
  collections=$(jq -r 'keys[] | select(startswith("$")|not) | select(startswith("_")|not)' "$file")

  if [[ -z "$collections" ]]; then
    warn "El seed ${file} no contiene colecciones importables. Se omite."
    return 0
  fi

  local coll
  for coll in $collections; do
    log "  → colección: ${coll}"
    # Payload: { "collection": "<coll>", "data": [ ... ] } no es el formato
    # de /utils/import. El endpoint correcto es POST /utils/import/{collection}
    # con body = array de items. Lo construimos:
    local tmp_payload
    tmp_payload=$(mktemp)
    jq -c --arg c "$coll" '.[$c]' "$file" > "$tmp_payload"

    local http_code
    http_code=$(curl -sS -o /tmp/init-directus-import.out -w '%{http_code}' \
      -X POST "${DIRECTUS_URL}/utils/import/${coll}" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H 'Content-Type: application/json' \
      --data-binary "@${tmp_payload}")
    rm -f "$tmp_payload"

    if [[ "$http_code" == "200" || "$http_code" == "201" || "$http_code" == "204" ]]; then
      ok "    importado (${http_code})"
    else
      warn "    respuesta HTTP ${http_code} al importar ${coll}:"
      sed 's/^/      /' /tmp/init-directus-import.out 2>/dev/null || true
      # Continuamos: un fallo parcial (p.ej. items ya existentes) no debe abortar.
    fi
  done
}

# Crea (si no existe) un token de servicio para el admin user y lo imprime.
# Si DIRECTUS_SERVICE_TOKEN ya está definido en el entorno, lo deja tal cual.
ensure_service_token() {
  if [[ -n "$DIRECTUS_SERVICE_TOKEN" ]]; then
    ok "DIRECTUS_SERVICE_TOKEN ya definido en el entorno (no se crea uno nuevo)."
    return 0
  fi

  log "Creando token de servicio para ${DIRECTUS_ADMIN_EMAIL}…"

  # 1. Obtener el id del usuario admin
  local user_id
  user_id=$(curl -sS "${DIRECTUS_URL}/users?filter[email][_eq]=${DIRECTUS_ADMIN_EMAIL}&fields=id" \
            -H "Authorization: Bearer ${TOKEN}" \
            | jq -er '.data[0].id' 2>/dev/null) || {
    warn "No se pudo obtener el id del usuario admin. Probablemente no existe todavía."
    warn "El entrypoint del contenedor Directus lo crea en el primer arranque con ADMIN_EMAIL/ADMIN_PASSWORD."
    warn "Si Directus está recién levantado, espera ~30s y vuelve a ejecutar este script."
    DIRECTUS_SERVICE_TOKEN=""
    return 0
  }

  # 2. Comprobar si ya tiene un token
  local existing
  existing=$(curl -sS "${DIRECTUS_URL}/tokens?filter[user][_eq]=${user_id}" \
             -H "Authorization: Bearer ${TOKEN}" \
             | jq -r '.data | length')

  if [[ "$existing" != "0" ]]; then
    warn "El usuario admin ya tiene ${existing} token(s). Por seguridad, Directus no devuelve el valor."
    warn "Define DIRECTUS_SERVICE_TOKEN en tu .env con el token que ya tienes (o revoca y crea uno nuevo desde el panel)."
    DIRECTUS_SERVICE_TOKEN=""
    return 0
  fi

  # 3. Crear token (POST /tokens con token_access=true → Directus devuelve el token en claro una sola vez)
  local resp
  resp=$(curl -sS -X POST "${DIRECTUS_URL}/tokens" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H 'Content-Type: application/json' \
        -d "$(jq -cn --arg u "$user_id" '{user:$u,name:"service-token",access:["server"],exp:0}')")

  local new_token
  new_token=$(echo "$resp" | jq -er '.data.token' 2>/dev/null) || {
    warn "No se pudo crear el token. Respuesta:"
    echo "$resp" | jq . 2>/dev/null || echo "$resp"
    DIRECTUS_SERVICE_TOKEN=""
    return 0
  }

  DIRECTUS_SERVICE_TOKEN="$new_token"
  ok "Token de servicio creado: ${DIRECTUS_SERVICE_TOKEN}"
  warn "Cópialo en tu .env como DIRECTUS_SERVICE_TOKEN=<valor>. No se volverá a mostrar."
}

print_summary() {
  echo
  printf '%s═══════════════════════════════════════════════════════════%s\n' "${C_BOLD}" "${C_RESET}"
  printf '%s ENTERAR.ME — Directus inicializado %s\n' "${C_BOLD}" "${C_RESET}"
  printf '%s═══════════════════════════════════════════════════════════%s\n' "${C_BOLD}" "${C_RESET}"
  printf '  Directus URL        : %s\n' "$DIRECTUS_URL"
  printf '  Admin email         : %s\n' "$DIRECTUS_ADMIN_EMAIL"
  printf '  Schema snapshot     : %s\n' "$SNAPSHOT_PATH"
  printf '  Seeds importados    : superadmin.json, planes.json, marketplace-sectores.json\n'
  if [[ -n "$DIRECTUS_SERVICE_TOKEN" ]]; then
    printf '  Service token       : %s%s%s (GUÁRDALO EN .env)%s\n' "$C_YELLOW" "$DIRECTUS_SERVICE_TOKEN" "$C_BOLD" "$C_RESET"
  else
    printf '  Service token       : (ya existente — define DIRECTUS_SERVICE_TOKEN en .env manualmente)\n'
  fi
  printf '  Próximos pasos:\n'
  printf '    • bash scripts/create-tenant.sh --name "Demo" --slug demo --plan pro --email admin@demo.com --password <pwd>\n'
  printf '    • bash scripts/load-ollama-model.sh   (crear modelo en Ollama)\n'
  printf '%s═══════════════════════════════════════════════════════════%s\n' "${C_BOLD}" "${C_RESET}"
}

# ---------- Main ----------
main() {
  log "ENTERAR.ME — init-directus"
  log "DIRECTUS_URL=${DIRECTUS_URL}"
  log "ADMIN_EMAIL=${DIRECTUS_ADMIN_EMAIL}"

  wait_directus

  log "Haciendo login como admin…"
  TOKEN="$(directus_login "$DIRECTUS_ADMIN_EMAIL" "$DIRECTUS_ADMIN_PASSWORD")"
  ok "Login OK"

  apply_schema

  import_seed_file "${SEED_DIR}/superadmin.json"             "super-admin + roles"
  import_seed_file "${SEED_DIR}/planes.json"                 "planes de suscripción"
  import_seed_file "${SEED_DIR}/marketplace-sectores.json"   "marketplace de sectores"

  ensure_service_token

  print_summary
}

main "$@"
