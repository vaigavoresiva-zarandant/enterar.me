#!/usr/bin/env bash
# ============================================================
# ENTERAR.ME — dev-down.sh
# ------------------------------------------------------------
# Detiene y elimina contenedores + volúmenes del docker-compose dev.
# ¡OJO! --volumes borra la DB local y los uploads de Directus.
# Para conservar datos, pasa --keep-volumes.
#
# Uso:
#   bash scripts/dev-down.sh                  # borra todo (dev)
#   bash scripts/dev-down.sh --keep-volumes   # solo contenedores y red
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
docker compose version >/dev/null 2>&1 || die "docker compose plugin no disponible."

COMPOSE_FILE="${COMPOSE_FILE:-./docker-compose.yml}"
KEEP_VOLUMES=0

for arg in "$@"; do
  case "$arg" in
    --keep-volumes) KEEP_VOLUMES=1;;
    -h|--help)
      cat <<EOF
Uso: $0 [--keep-volumes]
  --keep-volumes  No borra los volúmenes (DB + uploads). Solo detiene contenedores y red.
EOF
      exit 0
      ;;
    *) err "Argumento desconocido: $arg"; exit 1;;
  esac
done

if [[ "$KEEP_VOLUMES" == "1" ]]; then
  log "docker compose down (sin borrar volúmenes)…"
  docker compose -f "$COMPOSE_FILE" down
else
  warn "Borrando contenedores + volúmenes (postgres_data, directus_uploads, directus_extensions)…"
  warn "Si quieres conservar los datos, usa: $0 --keep-volumes"
  docker compose -f "$COMPOSE_FILE" down -v
fi

ok "Entorno dev detenido."
