#!/usr/bin/env bash
# ============================================================
# ENTERAR.ME — load-ollama-model.sh
# ------------------------------------------------------------
# Carga los modelos base en Ollama y crea el modelo custom
# `enterarme-agent` a partir de ai/Modelfile.
#
# Requisitos:
#   - El CLI `ollama` instalado localmente (para el caso de uso
#     con OLLAMA_HOST remoto, usa `ollama serve` local apuntando
#     a un túnel o usa la API REST directamente).
#   - O bien: si OLLAMA_HOST apunta a un servidor remoto con API
#     expuesta (Railway + Caddy), usamos curl contra la API.
#
# Pasos:
#   1. ollama pull qwen2.5:7b-instruct   (modelo base)
#   2. ollama pull nomic-embed-text      (embeddings para RAG)
#   3. ollama create enterarme-agent -f ai/Modelfile
#   4. Verificación: ollama list | grep enterarme-agent
#
# Variables de entorno:
#   OLLAMA_HOST        URL del servidor Ollama (ej: https://tu-ollama.up.railway.app)
#   OLLAMA_API_KEY     API key si hay proxy Caddy delante (Railway)
#   OLLAMA_MODEL       Nombre del modelo custom a crear (default enterarme-agent)
#   OLLAMA_EMBED_MODEL Modelo de embeddings (default nomic-embed-text)
#   OLLAMA_BASE_MODEL  Modelo base para el agente (default qwen2.5:7b-instruct)
#   USE_CLI            1=usar CLI ollama local, 0=usar curl contra API remota (default: auto)
#   MODELFILE_PATH     (default ./ai/Modelfile)
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

OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
OLLAMA_API_KEY="${OLLAMA_API_KEY:-}"
OLLAMA_MODEL="${OLLAMA_MODEL:-enterarme-agent}"
OLLAMA_EMBED_MODEL="${OLLAMA_EMBED_MODEL:-nomic-embed-text}"
OLLAMA_BASE_MODEL="${OLLAMA_BASE_MODEL:-qwen2.5:7b-instruct}"
MODELFILE_PATH="${MODELFILE_PATH:-${ROOT_DIR}/ai/Modelfile}"
USE_CLI="${USE_CLI:-}"

# ---------- Deps ----------
need() { command -v "$1" >/dev/null 2>&1 || die "Dependencia no encontrada: $1"; }
need curl
need jq

# ---------- Auto-detección CLI vs API ----------
if [[ -z "$USE_CLI" ]]; then
  if command -v ollama >/dev/null 2>&1 && [[ "$OLLAMA_HOST" == "http://localhost:11434" ]]; then
    USE_CLI=1
  else
    USE_CLI=0
  fi
fi

# ---------- Headers comunes ----------
AUTH_HEADER=()
if [[ -n "$OLLAMA_API_KEY" ]]; then
  AUTH_HEADER=(-H "Authorization: Bearer ${OLLAMA_API_KEY}")
fi

# ---------- Funciones CLI ----------
pull_cli() {
  local model="$1"
  log "[CLI] ollama pull ${model}"
  OLLAMA_HOST="$OLLAMA_HOST" ollama pull "$model"
  ok "Pull OK: ${model}"
}

create_cli() {
  log "[CLI] ollama create ${OLLAMA_MODEL} -f ${MODELFILE_PATH}"
  # El CLI ollama envía el Modelfile tal cual. Reescribimos el FROM si es necesario.
  if [[ ! -f "$MODELFILE_PATH" ]]; then
    die "No existe el Modelfile: $MODELFILE_PATH"
  fi
  # Validación: el Modelfile debe contener FROM <algo>
  grep -qE '^FROM ' "$MODELFILE_PATH" || die "El Modelfile no contiene una directiva FROM"

  OLLAMA_HOST="$OLLAMA_HOST" ollama create "$OLLAMA_MODEL" -f "$MODELFILE_PATH"
  ok "Modelo creado: ${OLLAMA_MODEL}"
}

list_cli() {
  OLLAMA_HOST="$OLLAMA_HOST" ollama list
}

# ---------- Funciones API REST (curl) ----------
# POST /api/pull con stream:false (descarga bloqueante)
pull_api() {
  local model="$1"
  log "[API] POST ${OLLAMA_HOST%/}/api/pull  model=${model}"
  local code resp_file
  resp_file=$(mktemp)
  code=$(curl -sS -o "$resp_file" -w '%{http_code}' --max-time 1800 \
          "${AUTH_HEADER[@]}" \
          -H 'Content-Type: application/json' \
          -X POST "${OLLAMA_HOST%/}/api/pull" \
          -d "$(jq -cn --arg m "$model" '{name:$m, stream:false})')")
  if [[ "$code" != "200" ]]; then
    err "Pull de ${model} falló (HTTP ${code})"
    cat "$resp_file" >&2 || true
    rm -f "$resp_file"
    die "Abortando"
  fi
  rm -f "$resp_file"
  ok "Pull OK: ${model}"
}

# POST /api/create con el Modelfile como string en el body
create_api() {
  log "[API] POST ${OLLAMA_HOST%/}/api/create  model=${OLLAMA_MODEL}"
  if [[ ! -f "$MODELFILE_PATH" ]]; then
    die "No existe el Modelfile: $MODELFILE_PATH"
  fi
  grep -qE '^FROM ' "$MODELFILE_PATH" || die "El Modelfile no contiene una directiva FROM"

  local payload resp_file code
  payload=$(jq -cn --arg m "$OLLAMA_MODEL" --rawfile mf "$MODELFILE_PATH" '{name:$m, modelfile:$mf, stream:false}')
  resp_file=$(mktemp)
  code=$(curl -sS -o "$resp_file" -w '%{http_code}' --max-time 600 \
          "${AUTH_HEADER[@]}" \
          -H 'Content-Type: application/json' \
          -X POST "${OLLAMA_HOST%/}/api/create" \
          -d "$payload")
  if [[ "$code" != "200" ]]; then
    err "Create de ${OLLAMA_MODEL} falló (HTTP ${code})"
    cat "$resp_file" >&2 || true
    rm -f "$resp_file"
    die "Abortando"
  fi
  rm -f "$resp_file"
  ok "Modelo creado: ${OLLAMA_MODEL}"
}

list_api() {
  curl -sS "${AUTH_HEADER[@]}" "${OLLAMA_HOST%/}/api/tags" | jq -r '.models[]? | "\(.name)\t\(.details.parameter_size // "?")\t\((.size/1024/1024/1024|floor))GB"' 2>/dev/null || true
}

# ---------- Main ----------
main() {
  log "ENTERAR.ME — load-ollama-model"
  log "OLLAMA_HOST=${OLLAMA_HOST}"
  log "OLLAMA_MODEL=${OLLAMA_MODEL}"
  log "USE_CLI=${USE_CLI}  (1=CLI local, 0=API REST remota)"

  if [[ "$USE_CLI" == "1" ]]; then
    need ollama
    pull_cli "$OLLAMA_BASE_MODEL"
    pull_cli "$OLLAMA_EMBED_MODEL"
    create_cli
    log "Modelos instalados:"
    list_cli
  else
    pull_api "$OLLAMA_BASE_MODEL"
    pull_api "$OLLAMA_EMBED_MODEL"
    create_api
    log "Modelos instalados en ${OLLAMA_HOST}:"
    list_api
  fi

  echo
  printf '%s═══════════════════════════════════════════════════════════%s\n' "${C_BOLD}" "${C_RESET}"
  printf '%s Ollama listo %s\n' "${C_BOLD}" "${C_RESET}"
  printf '%s═══════════════════════════════════════════════════════════%s\n' "${C_BOLD}" "${C_RESET}"
  printf '  Host              : %s\n' "$OLLAMA_HOST"
  printf '  Modelo agente     : %s\n' "$OLLAMA_MODEL"
  printf '  Modelo base       : %s\n' "$OLLAMA_BASE_MODEL"
  printf '  Modelo embeddings : %s\n' "$OLLAMA_EMBED_MODEL"
  printf '  Próximos pasos:\n'
  printf '    • Verifica el agente: curl %s/api/generate -d %s\n' "${OLLAMA_HOST}" '{"model":"'"$OLLAMA_MODEL"'","prompt":"hola"}'
  printf '    • Programa scripts/keep-ollama-warm.sh en cron para evitar cold starts.\n'
  printf '    • En el servicio AI, configura OLLAMA_HOST y OLLAMA_MODEL en las env vars.\n'
  printf '%s═══════════════════════════════════════════════════════════%s\n' "${C_BOLD}" "${C_RESET}"
}

main "$@"
