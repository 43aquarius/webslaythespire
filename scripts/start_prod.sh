#!/bin/bash
# 生产服务器启动器 - 分离式(会话回收后仍存活)，占用 3000 端口（Caddy 反代目标）
# 可移植端口清理：fuser 在本环境不存在，改用 ss 解析 + pkill 兜底
# 用法: bash scripts/start_prod.sh
cd /home/z/my-project
PORT="${PORT:-3000}"

# --- 清理端口占用（可移植：ss 解析 PID → kill；pkill 模式兜底） ---
free_port() {
  local pids
  pids=$(ss -tlnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | sort -u)
  if [ -n "$pids" ]; then
    echo "杀掉端口 $PORT 占用进程: $pids"
    kill $pids 2>/dev/null
  fi
  pkill -f "[s]tandalone/server.js" 2>/dev/null
  # 等待端口释放（最多 5s）
  for i in $(seq 1 10); do
    ss -tln 2>/dev/null | grep -q ":$PORT " || return 0
    sleep 0.5
  done
  # 还没释放则强杀
  pids=$(ss -tlnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | sort -u)
  [ -n "$pids" ] && kill -9 $pids 2>/dev/null
  sleep 1
}
free_port

# --- double-fork 启动：孙进程 reparent 到 init，会话回收后仍存活 ---
nohup bash -c "
  cd /home/z/my-project
  exec setsid env PORT=$PORT bun .next/standalone/server.js >> server.log 2>&1
" < /dev/null > /dev/null 2>&1 &

# --- 等待就绪并验证 ---
for i in $(seq 1 24); do
  sleep 0.5
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" 2>/dev/null)
  if [ "$CODE" = "200" ]; then
    echo "PRODUCTION SERVER READY on :$PORT (attempt $i)"
    curl -s -o /dev/null -w "  /          -> HTTP %{http_code}\n" "http://localhost:$PORT/"
    curl -s -o /dev/null -w "  hero asset -> HTTP %{http_code}\n" "http://localhost:$PORT/assets/hero/ironclad.png"
    VER=$(curl -s "http://localhost:$PORT/" | grep -o 'Web 复刻版 v[0-9.]*' | head -1)
    echo "  版本: $VER"
    exit 0
  fi
done
echo "FAILED: production server did not become ready"
tail -8 server.log
exit 1
