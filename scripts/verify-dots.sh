#!/bin/bash
# 地图墨点精确取证: 墨点盒尺寸/可见性/素材加载 + 节点几何
set -u
cd /home/z/my-project
bun run dev >/dev/null 2>&1 &
for i in $(seq 1 90); do curl -sf -o /dev/null http://localhost:3000 && break; sleep 1; done

agent-browser open http://localhost:3000 --timeout 30000
agent-browser set viewport 1600 900
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1 || true
agent-browser wait 1200
agent-browser find first ".sts-menu-opt" click
agent-browser wait 800
agent-browser find first ".cs-panel" click
agent-browser wait 400
agent-browser find first ".cs-embark" click
agent-browser wait 1500
agent-browser find first ".sts-neow-option" click
agent-browser wait 1200
NCARD=$(agent-browser get count ".sts-card" | tr -d '\n')
if [ "$NCARD" != "0" ]; then
  agent-browser find first ".sts-card" click
  agent-browser wait 1500
fi

echo "-- dot geometry (first 6) --"
agent-browser eval "(() => {
  const dots=[...document.querySelectorAll('.sts-map-dot')].slice(0,6);
  const canvas=document.querySelector('.sts-scroll > .relative.mx-auto');
  const cr=canvas?canvas.getBoundingClientRect():null;
  return JSON.stringify({
    canvas: cr?{x:Math.round(cr.x),y:Math.round(cr.y),w:Math.round(cr.width),h:Math.round(cr.height)}:null,
    dots: dots.map(d=>{const r=d.getBoundingClientRect();const cs=getComputedStyle(d);
      return {x:Math.round(r.x),y:Math.round(r.y),w:+r.width.toFixed(1),h:+r.height.toFixed(1),
        display:cs.display,opacity:cs.opacity,bg:cs.backgroundImage.slice(0,60)}})
  })
})()"

echo "-- dot1.png asset load --"
agent-browser eval "new Promise(res=>{const i=new Image(); i.onload=()=>res(JSON.stringify({ok:true,w:i.naturalWidth,h:i.naturalHeight})); i.onerror=()=>res(JSON.stringify({ok:false})); i.src='/assets/maporig/dot1.png?'+Date.now()})"

echo "-- node ring asset --"
agent-browser eval "new Promise(res=>{const i=new Image(); i.onload=()=>res(JSON.stringify({ok:true,w:i.naturalWidth,h:i.naturalHeight})); i.onerror=()=>res(JSON.stringify({ok:false})); i.src='/assets/maporig/circle5.png?'+Date.now()})"

echo "-- node/pulse geometry (first 6 nodes) --"
agent-browser eval "(() => {
  const ns=[...document.querySelectorAll('.sts-map-node')].slice(0,6);
  return JSON.stringify(ns.map(n=>{const r=n.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),pulse:n.className.includes('sts-map-pulse')}}))
})()"

echo "-- screenshot full map --"
agent-browser screenshot scripts/shot-04-map.png

# 放大截图节点+路径区域(第一层到底部)
agent-browser eval "(() => {
  const canvas=document.querySelector('.sts-scroll > .relative.mx-auto');
  const r=canvas.getBoundingClientRect();
  window.__mapRect={x:r.x,y:r.y,w:r.width,h:r.height};
  return JSON.stringify(window.__mapRect)
})()"
python3 - <<'PYEOF'
import json, subprocess
# 裁剪画布下部 40%(floor1-2 区域, 含节点+点路径)
from PIL import Image
im = Image.open('scripts/shot-04-map.png')
w, h = im.size
crop = im.crop((int(w*0.2), int(h*0.5), int(w*0.8), h))
crop = crop.resize((crop.width*2, crop.height*2), Image.LANCZOS)
crop.save('scripts/shot-04-map-dots-zoom.png')
print('zoom saved', crop.size)
PYEOF

agent-browser close
pkill -f "next dev" 2>/dev/null
echo DONE
