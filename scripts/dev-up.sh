#!/usr/bin/env bash
# ============================================================
# ENTERAR.ME — dev-up.sh
# ------------------------------------------------------------
# Levanta el entorno de desarrollo local con docker compose y,
# una vez Directus responde, ejecuta scripts/init-directus.sh.
#
# Variables de entorno (todas con defaults):
#   COMPOSE_FILE        (default ./docker-compose.yml)
#   BUILD               (default 0 — si 1, hace --build)
#   SKIP_INIT           (default 0 — si 1, no ejecuta init-directus)
#   DIRECTUS_URL, DIRECTUS_ADMIN_EMAIL, DIRECTUS_ADMIN_PASSWORD  (pasadas a init-directus)
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
cd "$ROOT_DIR"

# ---------- Deps ----------
need() { command -v "$1" >/dev/null 2>&1 || die "Dependencia no encontrada: $1"; }
need docker

if ! docker compose version >/dev/null 2>&1; then
  die "docker compose plugin no disponible. Instálalo (Docker Desktop o 'apt install docker-compose-plugin')."
fi

# ---------- Cargar .env ----------
if [[ ! -f .env ]]; then
  warn "No existe .env. Copiando .env.example → .env (ajusta los valores antes de seguir)…"
  if [[ -f .env.example ]]; then
    cp .env.example .env
    warn "Revisa .env y vuelve a ejecutar este script."
  fi
fi
if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a; . .env; set +a
fi

COMPOSE_FILE="${COMPOSE_FILE:-./docker-compose.yml}"
BUILD="${BUILD:-0}"
SKIP_INIT="${SKIP_INIT:-0}"

log "Levantando servicios con docker compose (file: ${COMPOSE_FILE})…"
if [[ "$BUILD" == "1" ]]; then
  docker compose -f "$COMPOSE_FILE" up -d --build
else
  docker compose -f "$COMPOSE_FILE" up -d
fi
ok "docker compose up -d OK"

log "Estado de contenedores:"
docker compose -f "$COMPOSE_FILE" ps

# ---------- Esperar a que Directus responda ----------
DIRECTUS_URL="${DIRECTUS_URL:-http://localhost:8055}"
log "Esperando a Directus en ${DIRECTUS_URL}…"
elapsed=0
while (( elapsed < 120 )); do
  if curl -fsS "${DIRECTUS_URL}/server/health" >/dev/null 2>&1; then
    ok "Directus responde"
    break
  fi
  sleep 2; elapsed=$((elapsed + 2))
  printf '.'
done
echo

if (( elapsed >= 120 )); then
  warn "Directus no respondió en 120s. Saltando init. Logs:"
  docker compose -f "$COMPOSE_FILE" logs --tail=50 directus || true
  exit 1
fi

# ---------- Init directus ----------
if [[ "$SKIP_INIT" == "1" ]]; then
  warn "SKIP_INIT=1 — no se ejecuta init-directus.sh"
else
  log "Ejecutando scripts/init-directus.sh…"
  bash "${ROOT_DIR}/scripts/init-directus.sh"
fi

echo
printf '%s═══════════════════════════════════════════════════════════%s\n' "${C_BOLD}" "${C_RESET}"
printf '%s ENTERAR.ME — Entorno dev levantado %s\n' "${C_BOLD}" "${C_RESET}"
printf '%s═══════════════════════════════════════════════════════════%s\n' "${C_BOLD}" "${C_RESET}"
printf '  Directus      : http://localhost:8055  (admin@enterarme.me / ver .env)\n'
printf '  Super Admin   : http://localhost:3000\n'
printf '  Tenant Admin  : http://localhost:3001\n'
printf '  AI Service    : http://localhost:3030\n'
printf '  Postgres      : localhost:5432\n'
printf '  Logs          : docker compose logs -f\n'
printf '  Parar         : bash scripts/dev-down.sh\n'
printf '%s═══════════════════════════════════════════════════════════%s\n' "${C_BOLD}" "${C_RESET}"
