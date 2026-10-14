#!/bin/bash
# ============ 一体化验证:server + agent-browser 全流程 ============
# 背景: 沙箱 supervisor 会在每条 Bash 命令结束时回收其派生的全部进程,
#       因此 dev server 与浏览器验证必须在同一条命令内完成。
# 覆盖: 标题→选角→涅奥→地图(修复验证)→战斗(怪物贴图修复验证)→webp 直开覆盖测试
set -u
cd /home/z/my-project
A=scripts
echo "== [1/6] 启动 dev server =="
bun run dev >/dev/null 2>&1 &
for i in $(seq 1 90); do
  curl -sf -o /dev/null http://localhost:3000 && { echo "server ready (${i}s)"; break; }
  sleep 1
done

echo "== [2/6] 标题画面 =="
agent-browser open http://localhost:3000 --timeout 30000
agent-browser set viewport 1600 900
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1 || true
agent-browser wait 1500
agent-browser screenshot $A/shot-01-title.png

echo "== [3/6] 选角 → 涅奥 =="
agent-browser find first ".sts-menu-opt" click   # 开 始 冒 险
agent-browser wait 1000
agent-browser screenshot $A/shot-02-charselect.png
agent-browser find first ".cs-panel" click
agent-browser wait 500
agent-browser find first ".cs-embark" click      # 出 发
agent-browser wait 1800
agent-browser screenshot $A/shot-03-neow.png
agent-browser find first ".sts-neow-option" click
agent-browser wait 1500
# 若该祝福需要选卡(如"转化"),点击第一张卡完成选择
NCARD=$(agent-browser get count ".sts-card" | tr -d '\n')
echo "neow card-pick count: $NCARD"
if [ "$NCARD" != "0" ]; then
  agent-browser find first ".sts-card" click
  agent-browser wait 2000
fi

echo "== [4/6] 地图(修复点:羊皮纸 1:1 + 墨圈) =="
agent-browser screenshot $A/shot-04-map.png
echo -n "nodes/pulse: "
agent-browser get count ".sts-map-node" | tr -d '\n'; echo -n " / "
agent-browser get count ".sts-map-pulse" | tr -d '\n'; echo
echo -n "map canvas: "
agent-browser eval "(() => { const el = document.querySelector('.sts-scroll > .relative.mx-auto'); if (!el) return 'NOT FOUND'; const r = el.getBoundingClientRect(); return JSON.stringify({w: Math.round(r.width), h: Math.round(r.height), ratio: +(r.width/r.height).toFixed(4), expect: +(1100/1450).toFixed(4)}) })()"
echo -n "ink rings: "
agent-browser get count ".sts-node-ring"
echo -n "ink dots: "
agent-browser get count ".sts-map-dot"

echo "== [5/6] 战斗(修复点:怪物贴图逐帧独立) =="
agent-browser find first ".sts-map-pulse" click
agent-browser wait 3000
agent-browser screenshot $A/shot-05-combat.png
echo -n "enemies: "
agent-browser eval "(() => { const els=[...document.querySelectorAll('img[src*=\"/assets/enemies/\"]')]; return JSON.stringify(els.map(i=>{const r=i.getBoundingClientRect(); return {sprite: i.src.split('/').pop().replace('.webp',''), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom), winH: window.innerHeight}})) })()"
echo "-- console errors --"
agent-browser errors || true

echo "== [6/6] redlouse webp 直开覆盖测试(重影最严重案例) =="
agent-browser open http://localhost:3000/assets/enemies/redlouse.webp
agent-browser wait 800
echo -n "cov t1: "
agent-browser eval "(() => { const img=document.images[0]; const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight; const x=c.getContext('2d'); x.drawImage(img,0,0); const d=x.getImageData(0,0,c.width,c.height).data; let op=0; for(let i=3;i<d.length;i+=4) if(d[i]>30) op++; return JSON.stringify({w:c.width,h:c.height,cov:+(op/(d.length/4)).toFixed(4)}) })()"
agent-browser wait 2200
echo -n "cov t2: "
agent-browser eval "(() => { const img=document.images[0]; const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight; const x=c.getContext('2d'); x.drawImage(img,0,0); const d=x.getImageData(0,0,c.width,c.height).data; let op=0; for(let i=3;i<d.length;i+=4) if(d[i]>30) op++; return JSON.stringify({cov:+(op/(d.length/4)).toFixed(4)}) })()"
agent-browser screenshot $A/shot-06-redlouse.png

agent-browser close
pkill -f "next dev" 2>/dev/null
echo "== DONE =="
