#!/usr/bin/env bash

set -euo pipefail

LOG_FILE="${DISPATCHER_LOG_FILE:-dispatcher.log}"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-7778}"

log() {
  printf '[%s] %s\n' "$(date +'%Y-%m-%d %H:%M:%S')" "$*"
}

if [ ! -d "dispatcher" ]; then
  log "Error: dispatcher directory not found. Run this script from the project root."
  exit 1
fi

if command -v lsof >/dev/null 2>&1 && lsof -Pi ":${PORT}" -sTCP:LISTEN -t >/dev/null 2>&1; then
  log "Dispatcher already appears to be listening on port ${PORT}"
  log "URL: http://${HOST}:${PORT}/getwork"
  exit 0
fi

exec > >(tee -a "$LOG_FILE") 2>&1

log "Starting nweb dispatcher"
log "URL: http://${HOST}:${PORT}/getwork"
log "Logs: ${LOG_FILE}"

cd dispatcher

if [ ! -d "node_modules" ]; then
  log "Installing dispatcher dependencies"
  npm install
fi

export HOST
export PORT

npm run dev
