#!/bin/bash
# 测试服务器启动器（:3100）— 复刻 start_prod.sh 的 double-fork 模式（孙进程 reparent 到 init，会话回收后仍存活）
# 与 start_prod.sh 的区别：不做全局 pkill（避免连杀 :3000 生产实例）；仅清 :3100 自身端口
# 用法: bash scripts/start_test_server.sh
cd /home/z/my-project
PORT="${PORT:-3100}"

# --- 仅清理 :3100 端口（不动 :3000） ---
pids=$(ss -tlnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | sort -u)
if [ -n "$pids" ]; then
  echo "杀掉端口 $PORT 旧进程: $pids"
  kill $pids 2>/dev/null
  for i in $(seq 1 10); do ss -tln 2>/dev/null | grep -q ":$PORT " || break; sleep 0.5; done
  pids=$(ss -tlnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | sort -u)
  [ -n "$pids" ] && kill -9 $pids 2>/dev/null
  sleep 1
fi

# --- double-fork 启动（与 start_prod.sh 同构：setsid + exec + 文件重定向） ---
mkdir -p /home/z/my-project/scripts/logs
nohup bash -c "
  cd /home/z/my-project
  exec setsid env PORT=$PORT bun .next/standalone/server.js >> scripts/logs/test3100.log 2>&1
" < /dev/null > /dev/null 2>&1 &

# --- 等待就绪 ---
for i in $(seq 1 24); do
  sleep 0.5
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/" 2>/dev/null)
  if [ "$CODE" = "200" ]; then
    echo "TEST SERVER READY on :$PORT (attempt $i)"
    ss -tlnp | grep ":$PORT"
    exit 0
  fi
done
echo "FAILED: test server did not become ready"
tail -8 scripts/logs/test3100.log 2>/dev/null
exit 1
