#!/usr/bin/env bash
# ============================================================
# ENTERAR.ME — keep-ollama-warm.sh
# ------------------------------------------------------------
# Mantiene el modelo Ollama caliente haciendo ping a /api/tags
# cada N minutos. Pensado para cron en el VPS / Railway / cualquier
# host con acceso a OLLAMA_HOST. Evita el cold start (Ollama en
# Railway free tier duerme tras ~5 min sin tráfico).
#
# Uso suelto:
#   bash scripts/keep-ollama-warm.sh
#
# Uso en cron (cada 5 min):
#   */5 * * * * OLLAMA_HOST=https://... OLLAMA_API_KEY=... \
#               /path/to/scripts/keep-ollama-warm.sh >> /var/log/ollama-warm.log 2>&1
#
# O como long-running daemon:
#   INTERVAL_SECONDS=300 bash scripts/keep-ollama-warm.sh --loop
#
# Variables de entorno:
#   OLLAMA_HOST        (obligatorio — ej: https://tu-ollama.up.railway.app)
#   OLLAMA_API_KEY     (si tu Ollama está detrás de un proxy con auth)
#   OLLAMA_MODEL       (default enterarme-agent — se invoca /api/generate con prompt vacío)
#   INTERVAL_SECONDS   (default 300 — solo modo --loop)
#   KEEP_WARM_LOG      (default /tmp/enterarme-ollama-warm.log)
# ============================================================
set -euo pipefail

# ---------- Colores ----------
if [[ -t 1 ]]; then
  C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'
  C_BLUE=$'\033[34m'; C_CYAN=$'\033[36m'; C_BOLD=$'\033[1m'; C_RESET=$'\033[0m'
else
  C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_CYAN=""; C_BOLD=""; C_RESET=""
fi
log()  { printf '%s[%s] ▸ %s%s\n' "$(date -u +%FT%TZ)" "${C_BLUE}" "$*" "${C_RESET}"; }
ok()   { printf '%s[%s] ✓ %s%s\n' "$(date -u +%FT%TZ)" "${C_GREEN}" "$*" "${C_RESET}"; }
warn() { printf '%s[%s] ⚠ %s%s\n' "$(date -u +%FT%TZ)" "${C_YELLOW}" "$*" "${C_RESET}"; }
err()  { printf '%s[%s] ✗ %s%s\n' "$(date -u +%FT%TZ)" "${C_RED}" "$*" "${C_RESET}" >&2; }
die()  { err "$*"; exit 1; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${ROOT_DIR}/.env" ]]; then
  # shellcheck disable=SC1090
  set -a; . "${ROOT_DIR}/.env"; set +a
fi

OLLAMA_HOST="${OLLAMA_HOST:?OLLAMA_HOST es obligatorio (ej: https://tu-ollama.up.railway.app)}"
OLLAMA_API_KEY="${OLLAMA_API_KEY:-}"
OLLAMA_MODEL="${OLLAMA_MODEL:-enterarme-agent}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-300}"
KEEP_WARM_LOG="${KEEP_WARM_LOG:-/tmp/enterarme-ollama-warm.log}"

# ---------- Deps ----------
need() { command -v "$1" >/dev/null 2>&1 || die "Dependencia no encontrada: $1"; }
need curl
need jq

# ---------- Headers ----------
AUTH_HEADER=()
if [[ -n "$OLLAMA_API_KEY" ]]; then
  AUTH_HEADER=(-H "Authorization: Bearer ${OLLAMA_API_KEY}")
fi

# ---------- Funciones ----------
# 1) ping /api/tags — muy barato, solo lista modelos cargados
ping_tags() {
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 \
          "${AUTH_HEADER[@]}" "${OLLAMA_HOST%/}/api/tags" || true)
  if [[ "$code" == "200" ]]; then
    ok "/api/tags OK (HTTP 200)"
    return 0
  else
    warn "/api/tags respondió HTTP ${code:-000}"
    return 1
  fi
}

# 2) ping /api/generate con prompt mínimo — fuerza carga del modelo en memoria
#    (más caro pero es el verdadero anti-cold-start). Mantenemos como best-effort.
warm_model() {
  log "Calentando modelo '${OLLAMA_MODEL}'…"
  local resp
  resp=$(curl -sS --max-time 30 \
          "${AUTH_HEADER[@]}" \
          -H 'Content-Type: application/json' \
          -X POST "${OLLAMA_HOST%/}/api/generate" \
          -d "$(jq -cn --arg m "$OLLAMA_MODEL" '{model:$m, prompt:"ping", stream:false, options:{num_predict:1}}')" \
          2>/dev/null || true)
  if [[ -z "$resp" ]]; then
    warn "No hubo respuesta del /api/generate (timeout o error de red). Solo se hizo ping /api/tags."
    return 1
  fi
  # Si el modelo no está cargado localmente, Ollama intentará descargarlo → 404.
  # Lo dejamos como warning, no error fatal.
  if echo "$resp" | jq -e '.error' >/dev/null 2>&1; then
    local msg; msg=$(echo "$resp" | jq -r '.error')
    warn "Ollama devolvió error: ${msg}"
    warn "Ejecuta scripts/load-ollama-model.sh para crear el modelo '${OLLAMA_MODEL}'."
    return 1
  fi
  ok "Modelo '${OLLAMA_MODEL}' respondió — caliente"
  return 0
}

run_once() {
  ping_tags || true
  warm_model || true
}

main_loop() {
  log "ENTERAR.ME — keep-ollama-warm (loop, cada ${INTERVAL_SECONDS}s)"
  log "OLLAMA_HOST=${OLLAMA_HOST}"
  log "OLLAMA_MODEL=${OLLAMA_MODEL}"
  log "Log file: ${KEEP_WARM_LOG}"
  while true; do
    run_once 2>&1 | tee -a "$KEEP_WARM_LOG"
    sleep "$INTERVAL_SECONDS"
  done
}

main_once() {
  log "ENTERAR.ME — keep-ollama-warm (single shot)"
  log "OLLAMA_HOST=${OLLAMA_HOST}"
  run_once
}

# ---------- Main ----------
if [[ "${1:-}" == "--loop" ]]; then
  main_loop
else
  main_once
  echo
  ok "Ping único completado. Para modo daemon: $0 --loop"
  ok "Para cron cada 5 min: */5 * * * * OLLAMA_HOST=... $0 >> ${KEEP_WARM_LOG} 2>&1"
fi
