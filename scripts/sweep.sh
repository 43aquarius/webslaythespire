#!/usr/bin/env bash
# 回归扫描：顺序跑指定测试套件并汇总结果
# 用法: bash scripts/sweep.sh <suite1> [suite2 ...]   套件名省略 scripts/ 前缀与 .ts 后缀
# 例:   bash scripts/sweep.sh test_batch18 test_batch34
cd /home/z/my-project
declare -a NAMES=() CODES=() RESULTS=()
for t in "$@"; do
  echo "===== RUN $t ====="
  out=$(timeout 420 npx tsx "scripts/${t}.ts" 2>&1)
  code=$?
  echo "$out" | grep -E "^== 结果|^== |✗|FATAL" | tail -6
  NAMES+=("$t"); CODES+=("$code")
  RESULTS+=("$(echo "$out" | grep -oE '[0-9]+ 通过, [0-9]+ 失败' | tail -1)")
done
echo ""
echo "===== SWEEP SUMMARY ====="
fail_total=0
for i in "${!NAMES[@]}"; do
  status="PASS"
  [ "${CODES[$i]}" != "0" ] && { status="FAIL(${CODES[$i]})"; fail_total=$((fail_total+1)); }
  printf "%-28s %-10s %s\n" "${NAMES[$i]}" "$status" "${RESULTS[$i]}"
done
[ "$fail_total" = "0" ] && echo "ALL GREEN" || echo "${fail_total} SUITE(S) FAILED"
exit "$fail_total"
