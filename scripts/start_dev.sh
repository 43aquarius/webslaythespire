#!/usr/bin/env bash
# dev server 启动脚本（脱离进程组，避免工具会话退出时被杀）
# 用法: bash scripts/start_dev.sh [port]   默认 3000
PORT="${1:-3000}"
cd /home/z/my-project

# 已在监听则直接退出
if ss -tln 2>/dev/null | grep -q ":${PORT} "; then
  echo "port ${PORT} already listening, skip"
  exit 0
fi

# 清理残留锁（排障②：.next/dev/lock 禁止双实例）
pkill -f "next dev -p ${PORT}" 2>/dev/null
sleep 1

setsid nohup ./node_modules/.bin/next dev -p "${PORT}" >> dev.log 2>&1 < /dev/null &
disown

# 等待就绪（全新编译可能较慢）
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://localhost:${PORT}/" 2>/dev/null)
  if [ "$code" = "200" ]; then
    echo "dev server ready on :${PORT}"
    exit 0
  fi
  sleep 3
done
echo "TIMEOUT waiting for :${PORT}" >&2
exit 1
