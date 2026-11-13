#!/usr/bin/env bash
set -euo pipefail

# Avoid duplicate services when a Codespace is resumed.
if ! pgrep -f '[b]un index.ts' >/dev/null 2>&1; then
  (cd mini-services/trading-engine && nohup bun index.ts > /tmp/gold-trader-engine.log 2>&1 &)
fi

if ! pgrep -f '[n]ext dev' >/dev/null 2>&1; then
  nohup bun run dev -- --hostname 0.0.0.0 > /tmp/gold-trader-web.log 2>&1 &
fi

echo "Gold Trader startup requested. Web logs: /tmp/gold-trader-web.log; engine logs: /tmp/gold-trader-engine.log"
