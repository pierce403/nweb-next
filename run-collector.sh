#!/usr/bin/env bash

set -euo pipefail

DISPATCHER_URL="${DISPATCHER_URL:-http://127.0.0.1:7778}"
INDEX_URL="${INDEX_URL:-http://127.0.0.1:3000/api/submit}"
ANALYST_URL="${ANALYST_URL:-${INDEX_URL%/api/submit}}"
RANDOM_IPV4="${RANDOM_IPV4:-1}"
WORK_LABEL="${WORK_LABEL:-}"
WORK_ID="${WORK_ID:-}"
PROFILE="${PROFILE:-quick}"
VANTAGE="${VANTAGE:-local/run-collector}"
WORK_DIR="${WORK_DIR:-}"
CONTINUOUS="${CONTINUOUS:-0}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-30}"
NO_PING="${NO_PING:-1}"
DRY_RUN="${DRY_RUN:-0}"
DIRECT_TARGET="${DIRECT_TARGET:-}"

usage() {
  cat <<'EOF'
Usage: ./run-collector.sh [options]

Runs one collector scan by default. Use --continuous to keep scanning.

Target selection:
  --ip IP                 Scan one IPv4 address directly, equivalent to --target ip:IP
  --target SPEC           Scan an explicit collector target spec, e.g. ip:8.8.8.8 or host:example.com
  --random-ipv4           Ask dispatcher for random globally routable IPv4 work (default)
  --local                 Use dispatcher label "local" for loopback smoke tests
  --work-label LABEL      Filter dispatcher work by label
  --work-id ID            Select a specific dispatcher work id

Run mode:
  --continuous            Keep scanning until interrupted
  --once                  Run exactly once (default)
  --interval SECONDS      Sleep between continuous scans (default: 30)
  --dry-run               Build bundle but do not index into Analyst

Nmap:
  --profile PROFILE       quick, top-100, top-1000, or full (default: quick)
  --no-ping               Pass -Pn to nmap and skip host discovery (default)
  --ping                  Let nmap perform normal host discovery

Other:
  --work-dir DIR          Output directory. In continuous mode each scan gets a child directory.
  --dispatcher-url URL    Dispatcher base URL
  --index-url URL         Analyst /api/submit URL
  --vantage VALUE         Vantage string written to records
  -h, --help              Show this help

Examples:
  ./run-collector.sh --ip 8.8.8.8
  ./run-collector.sh --target host:example.com --ping
  ./run-collector.sh --continuous --interval 10
  ./run-collector.sh --local
EOF
}

log() {
  printf '[%s] %s\n' "$(date +'%Y-%m-%d %H:%M:%S')" "$*"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --ip)
      DIRECT_TARGET="ip:${2:?--ip requires an address}"
      RANDOM_IPV4=0
      WORK_LABEL=""
      shift 2
      ;;
    --target)
      DIRECT_TARGET="${2:?--target requires a target spec}"
      RANDOM_IPV4=0
      WORK_LABEL=""
      shift 2
      ;;
    --random-ipv4)
      RANDOM_IPV4=1
      WORK_LABEL=""
      DIRECT_TARGET=""
      shift
      ;;
    --local)
      RANDOM_IPV4=0
      WORK_LABEL="local"
      DIRECT_TARGET=""
      shift
      ;;
    --work-label)
      WORK_LABEL="${2:?--work-label requires a label}"
      RANDOM_IPV4=0
      DIRECT_TARGET=""
      shift 2
      ;;
    --work-id)
      WORK_ID="${2:?--work-id requires an id}"
      shift 2
      ;;
    --continuous)
      CONTINUOUS=1
      shift
      ;;
    --once)
      CONTINUOUS=0
      shift
      ;;
    --interval)
      INTERVAL_SECONDS="${2:?--interval requires seconds}"
      shift 2
      ;;
    --profile)
      PROFILE="${2:?--profile requires a value}"
      shift 2
      ;;
    --no-ping)
      NO_PING=1
      shift
      ;;
    --ping)
      NO_PING=0
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --work-dir)
      WORK_DIR="${2:?--work-dir requires a directory}"
      shift 2
      ;;
    --dispatcher-url)
      DISPATCHER_URL="${2:?--dispatcher-url requires a URL}"
      shift 2
      ;;
    --index-url)
      INDEX_URL="${2:?--index-url requires a URL}"
      ANALYST_URL="${INDEX_URL%/api/submit}"
      shift 2
      ;;
    --vantage)
      VANTAGE="${2:?--vantage requires a value}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      log "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

if [ ! -d "collector" ]; then
  log "Error: collector directory not found. Run this script from the project root."
  exit 1
fi

if ! [[ "$INTERVAL_SECONDS" =~ ^[0-9]+$ ]]; then
  log "Error: --interval must be a non-negative integer"
  exit 1
fi

ROOT_DIR="$(pwd)"
if [ -n "$WORK_DIR" ] && [[ "$WORK_DIR" != /* ]]; then
  WORK_DIR="${ROOT_DIR}/${WORK_DIR}"
fi

if ! command -v curl >/dev/null 2>&1; then
  log "Error: curl is required for preflight checks."
  exit 1
fi

if [ -z "$DIRECT_TARGET" ] && ! curl -fsS "${DISPATCHER_URL}/health" >/dev/null; then
  log "Error: dispatcher is not reachable at ${DISPATCHER_URL}"
  log "Start it with: ./run-dispatcher.sh"
  exit 1
fi

if [ "$DRY_RUN" != "1" ] && ! curl -fsS "${ANALYST_URL}/api/status" >/dev/null; then
  log "Error: Analyst is not reachable at ${ANALYST_URL}"
  log "Start Analyst with: ./run-analyst.sh"
  exit 1
fi

run_once() {
  local iteration="$1"
  local run_work_dir
  if [ -n "$WORK_DIR" ]; then
    if [ "$CONTINUOUS" = "1" ]; then
      run_work_dir="${WORK_DIR}/run-$(date +%Y%m%d-%H%M%S)-${iteration}"
    else
      run_work_dir="$WORK_DIR"
    fi
  else
    run_work_dir="${ROOT_DIR}/collector/runs/collector-$(date +%Y%m%d-%H%M%S)-${iteration}"
  fi

  local cmd=(
    uv run python -m collector.cli
    --work-dir "$run_work_dir"
    --vantage "$VANTAGE"
    --profile "$PROFILE"
  )

  if [ "$DRY_RUN" != "1" ]; then
    cmd+=(--index-url "$INDEX_URL")
  else
    cmd+=(--dry-run)
  fi

  if [ "$NO_PING" = "1" ]; then
    cmd+=(--no-ping)
  fi

  if [ -n "$DIRECT_TARGET" ]; then
    cmd+=(--targets "$DIRECT_TARGET")
    log "Target: ${DIRECT_TARGET}"
  else
    cmd+=(--dispatcher-url "$DISPATCHER_URL")
    if [ -n "$WORK_LABEL" ]; then
      cmd+=(--work-label "$WORK_LABEL")
    fi
    if [ "$RANDOM_IPV4" = "1" ]; then
      cmd+=(--random-ipv4)
    fi
    if [ -n "$WORK_ID" ]; then
      cmd+=(--work-id "$WORK_ID")
    fi
    log "Dispatcher: ${DISPATCHER_URL}"
  fi

  log "Profile: ${PROFILE}"
  log "Nmap host discovery: $([ "$NO_PING" = "1" ] && echo 'disabled (-Pn)' || echo 'enabled')"
  log "Indexing: $([ "$DRY_RUN" = "1" ] && echo 'disabled (dry run)' || echo "$INDEX_URL")"
  log "Work dir: ${run_work_dir}"

  (cd collector && "${cmd[@]}")
}

iteration=1
while true; do
  log "Starting collector scan #${iteration}"
  if run_once "$iteration"; then
    log "Collector scan #${iteration} completed"
  else
    log "Collector scan #${iteration} failed"
    if [ "$CONTINUOUS" != "1" ]; then
      exit 1
    fi
  fi

  if [ "$CONTINUOUS" != "1" ]; then
    break
  fi

  iteration=$((iteration + 1))
  log "Sleeping ${INTERVAL_SECONDS}s before next scan"
  sleep "$INTERVAL_SECONDS"
done
