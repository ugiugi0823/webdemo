#!/bin/bash
set -e

DEV_DIR=/data/rex/workspace/dev/webdemo/dev

# Docker 빌드 & 재시작 (8080)
echo "🐳 Docker 빌드 중..."
docker compose -f "$DEV_DIR/docker/docker-compose.yml" up -d --build

# npm dev 재시작 (9090)
echo "⚡ dev 서버 재시작 중..."
pkill -f vite 2>/dev/null || true
sleep 1
nohup npm --prefix "$DEV_DIR" run dev -- --host > /tmp/vite-dev.log 2>&1 &
sleep 2
echo "   $(grep 'Network:' /tmp/vite-dev.log | head -1 | xargs)"

echo "✅ 완료 (8080: Docker / 9090: dev)"
