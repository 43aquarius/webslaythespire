#!/bin/bash
# 回归: 启动 server → /api/mp 17 项测试 → tsc 类型检查 → 关闭
set -u
cd /home/z/my-project
bun run dev >/dev/null 2>&1 &
for i in $(seq 1 90); do curl -sf -o /dev/null http://localhost:3000 && break; sleep 1; done
echo "== /api/mp 回归 =="
bun scripts/test-mp-api.js
MP=$?
echo
echo "== tsc --noEmit (src) =="
bunx tsc --noEmit src/ 2>&1 | head -20
echo "tsc exit: $?"
pkill -f "next dev" 2>/dev/null
echo "MP_TEST_EXIT=$MP"
