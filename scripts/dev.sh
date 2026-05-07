#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$ROOT_DIR/.dev"
BACKEND_PID_FILE="$STATE_DIR/backend.pid"
FRONTEND_PID_FILE="$STATE_DIR/frontend.pid"
BACKEND_LOG="$STATE_DIR/backend.log"
FRONTEND_LOG="$STATE_DIR/frontend.log"
BACKEND_PORT=8000
FRONTEND_PORT=5173

usage() {
  cat <<'USAGE'
Usage: scripts/dev.sh <command>

Commands:
  start     Start backend and frontend dev servers in the background.
  stop      Stop backend and frontend dev servers.
  restart   Stop, then start both dev servers.
  status    Show server status and local URLs.
  logs      Show log file locations.

USAGE
}

ensure_state_dir() {
  mkdir -p "$STATE_DIR"
}

is_running() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

pid_from_file() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    cat "$pid_file"
  fi
}

pids_on_port() {
  local port="$1"
  lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
}

wait_for_port() {
  local port="$1"
  local label="$2"

  for _attempt in {1..50}; do
    if [[ -n "$(pids_on_port "$port")" ]]; then
      return
    fi
    sleep 0.1
  done

  echo "$label did not start listening on port $port. Check logs with: scripts/dev.sh logs"
}

stop_pid() {
  local pid="$1"
  local label="$2"

  if ! is_running "$pid"; then
    return
  fi

  echo "Stopping $label process $pid..."
  kill "$pid" 2>/dev/null || true

  for _attempt in {1..25}; do
    if ! is_running "$pid"; then
      return
    fi
    sleep 0.2
  done

  echo "$label process $pid did not exit after SIGTERM; sending SIGKILL."
  kill -KILL "$pid" 2>/dev/null || true
}

stop_port() {
  local port="$1"
  local label="$2"
  local pids

  pids="$(pids_on_port "$port")"
  if [[ -z "$pids" ]]; then
    return
  fi

  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    stop_pid "$pid" "$label on port $port"
  done <<< "$pids"
}

start_backend() {
  local existing_pid port_pids
  existing_pid="$(pid_from_file "$BACKEND_PID_FILE" || true)"
  port_pids="$(pids_on_port "$BACKEND_PORT")"

  if [[ -n "$port_pids" ]]; then
    echo "Backend already running at http://127.0.0.1:$BACKEND_PORT (pid(s): ${port_pids//$'\n'/, })."
    return
  fi

  if is_running "$existing_pid"; then
    echo "Backend already running at http://127.0.0.1:$BACKEND_PORT (pid $existing_pid)."
    return
  fi

  if [[ ! -x "$ROOT_DIR/backend/.venv/bin/uvicorn" ]]; then
    echo "Missing backend virtualenv. Run backend setup from README first."
    exit 1
  fi

  echo "Starting backend at http://127.0.0.1:$BACKEND_PORT..."
  (
    cd "$ROOT_DIR/backend"
    exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT" --reload
  ) >"$BACKEND_LOG" 2>&1 &
  echo "$!" >"$BACKEND_PID_FILE"
}

start_frontend() {
  local existing_pid port_pids
  existing_pid="$(pid_from_file "$FRONTEND_PID_FILE" || true)"
  port_pids="$(pids_on_port "$FRONTEND_PORT")"

  if [[ -n "$port_pids" ]]; then
    echo "Frontend already running at http://localhost:$FRONTEND_PORT (pid(s): ${port_pids//$'\n'/, })."
    return
  fi

  if is_running "$existing_pid"; then
    echo "Frontend already running at http://localhost:$FRONTEND_PORT (pid $existing_pid)."
    return
  fi

  if [[ ! -d "$ROOT_DIR/frontend/node_modules" ]]; then
    echo "Missing frontend/node_modules. Run npm install in frontend first."
    exit 1
  fi

  echo "Starting frontend at http://localhost:$FRONTEND_PORT..."
  (
    cd "$ROOT_DIR/frontend"
    exec npm run dev -- --host localhost --port "$FRONTEND_PORT"
  ) >"$FRONTEND_LOG" 2>&1 &
  echo "$!" >"$FRONTEND_PID_FILE"
}

start_all() {
  ensure_state_dir
  start_backend
  start_frontend
  wait_for_port "$BACKEND_PORT" "Backend"
  wait_for_port "$FRONTEND_PORT" "Frontend"
  status
}

stop_all() {
  ensure_state_dir

  local backend_pid frontend_pid
  backend_pid="$(pid_from_file "$BACKEND_PID_FILE" || true)"
  frontend_pid="$(pid_from_file "$FRONTEND_PID_FILE" || true)"

  if is_running "$backend_pid"; then
    stop_pid "$backend_pid" "backend"
  fi
  if is_running "$frontend_pid"; then
    stop_pid "$frontend_pid" "frontend"
  fi

  stop_port "$BACKEND_PORT" "backend"
  stop_port "$FRONTEND_PORT" "frontend"

  rm -f "$BACKEND_PID_FILE" "$FRONTEND_PID_FILE"
  echo "Stopped Cloud Lab dev servers."
}

status() {
  ensure_state_dir

  local backend_pids frontend_pids
  backend_pids="$(pids_on_port "$BACKEND_PORT")"
  frontend_pids="$(pids_on_port "$FRONTEND_PORT")"

  if [[ -n "$backend_pids" ]]; then
    echo "Backend:  running on http://127.0.0.1:$BACKEND_PORT (pid(s): ${backend_pids//$'\n'/, })"
  else
    echo "Backend:  stopped"
  fi

  if [[ -n "$frontend_pids" ]]; then
    echo "Frontend: running on http://localhost:$FRONTEND_PORT (pid(s): ${frontend_pids//$'\n'/, })"
  else
    echo "Frontend: stopped"
  fi
}

logs() {
  ensure_state_dir
  echo "Backend log:  $BACKEND_LOG"
  echo "Frontend log: $FRONTEND_LOG"
}

command="${1:-}"
case "$command" in
  start)
    start_all
    ;;
  stop)
    stop_all
    ;;
  restart)
    stop_all
    start_all
    ;;
  status)
    status
    ;;
  logs)
    logs
    ;;
  ""|-h|--help|help)
    usage
    ;;
  *)
    echo "Unknown command: $command"
    usage
    exit 1
    ;;
esac
