#!/bin/bash
# Check critical services and alert via log
FAIL=0

# Hub
if ! curl -s -o /dev/null -w "%{http_code}" https://moolabiz.shop | grep -q 200; then
  echo "[ALERT] Hub is DOWN"
  FAIL=1
fi

# Vendure (check via docker network using wget since container lacks curl)
if ! docker exec vendure-server wget -qO- http://localhost:3000/health 2>/dev/null | grep -q ok; then
  # Fallback: just check container is running
  if ! docker ps --format "{{.Names}}" | grep -q vendure-server; then
    echo "[ALERT] Vendure is DOWN"
    FAIL=1
  else
    echo "[ALERT] Vendure container running but health check failed"
    FAIL=1
  fi
fi

# Storefront container
if ! docker ps --format "{{.Names}}" | grep -q vendure-storefront; then
  echo "[ALERT] Storefront container is DOWN"
  FAIL=1
fi

# PostgreSQL
if ! docker exec coolify-db pg_isready -U coolify -q; then
  echo "[ALERT] PostgreSQL is DOWN"
  FAIL=1
fi

# RAM check (alert if >85%)
RAM_PCT=$(free | awk '/Mem/ {printf "%.0f", $3/$2*100}')
if [ "$RAM_PCT" -gt 85 ]; then
  echo "[ALERT] RAM usage at ${RAM_PCT}%"
  FAIL=1
fi

if [ $FAIL -eq 0 ]; then
  echo "[OK] All services healthy at $(date)"
fi
