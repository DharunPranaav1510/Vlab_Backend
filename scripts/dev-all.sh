#!/usr/bin/env bash
set -euo pipefail

# Start all services: frontend, backend, and Python connector

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
VENV_DIR="$ROOT_DIR/.venv-connector"

# Start the Python connector service in a venv
(
  cd "$ROOT_DIR"
  echo "Setting up Python venv for connector..."
  if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR"
  fi
  source "$VENV_DIR/bin/activate"
  pip install --upgrade pip
  pip install flask requests
  ./scripts/run-connector.sh
) &
CONNECTOR_PID=$!

# Start the backend
(
  cd "$BACKEND_DIR"
  echo "Starting backend..."
  npm install
  npm run dev
) &
BACKEND_PID=$!

cleanup() {
  echo ""
  echo "Stopping services..."
  kill "$BACKEND_PID" 2>/dev/null || true
  kill "$CONNECTOR_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Start the frontend
cd "$ROOT_DIR"
echo "Starting frontend..."
npm install
npm run dev
