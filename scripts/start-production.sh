#!/bin/sh
set -eu

RAG_PORT="${RAG_PORT:-8090}"
RAG_URL="http://127.0.0.1:${RAG_PORT}"

cleanup() {
  if [ -n "${RAG_PID:-}" ]; then
    kill "$RAG_PID" 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

/opt/rag-venv/bin/python -m uvicorn app:app   --app-dir /app/services/rag-python   --host 127.0.0.1   --port "$RAG_PORT" &
RAG_PID=$!

ready=0
for _ in $(seq 1 120); do
  if /opt/rag-venv/bin/python -c "import urllib.request; urllib.request.urlopen('${RAG_URL}/ready', timeout=1).read()" >/dev/null 2>&1; then
    ready=1
    break
  fi
  if ! kill -0 "$RAG_PID" 2>/dev/null; then
    echo "Python RAG process exited before becoming ready." >&2
    exit 1
  fi
  sleep 1
done

if [ "$ready" -ne 1 ]; then
  echo "Python RAG process did not become ready." >&2
  exit 1
fi

node --import tsx apps/api/src/server.ts &
NODE_PID=$!

wait "$NODE_PID"
status=$?
cleanup
exit "$status"
