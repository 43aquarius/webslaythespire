#!/usr/bin/env bash
# 奖励屏最终验证：正确 cards: string[] 注入 + console 全量 + 截图
set -x
agent-browser open http://localhost:3000/
sleep 6
agent-browser eval "(() => { const st = window.__sts; const s = st.getState(); if (s.run) { st.setState({run:null}); } s.startRun('ironclad'); return 'started' })()" --json
sleep 2
agent-browser eval "(() => { const st = window.__sts; const s = st.getState(); if (!s.run) return 'no-run'; const r = JSON.parse(JSON.stringify(s.run)); r.screen='map'; r.combat=null; st.setState({run:r}); return 'map' })()" --json
sleep 2
agent-browser eval "(() => { const st = window.__sts; const s = st.getState(); const r = JSON.parse(JSON.stringify(s.run));
  r.combat = { players: r.players.map((p,i)=>({uid:'p'+i, hp:p.maxHp, maxHp:p.maxHp, block:0, energy:3, statuses:{}, potions:p.potions||[], relics:p.relics||[]})), enemies: [], activeIdx: 0, turn: 1, drawPile: [], hand: [], discardPile: [], exhaustPile: [], spawnedEnemies: [] };
  r.screen = 'reward';
  r.reward = { cards: ['bash', 'whirlwind', 'defend'], gold: 25, potionId: 'firePotion', relicId: null, taken: [] };
  st.setState({ run: r }); return 'ok' })()" --json
sleep 3
echo "===== CARD ART DOM ====="
agent-browser eval "(() => {
  const arts = [...document.querySelectorAll('img')].filter(i => i.src.includes('cardart')).slice(0,5).map(i => ({src: i.src.slice(-40), w: i.naturalWidth}));
  const potion = [...document.querySelectorAll('img')].filter(i => i.src.includes('potion')).length;
  return JSON.stringify({cardArts: arts, potionImgs: potion})
})()" --json
echo "===== PAGE ERRORS ====="
agent-browser errors 2>&1 | head -10
echo "===== CONSOLE ALL ====="
agent-browser console 2>&1 | tail -15
agent-browser screenshot scripts/study/batch36/10_reward_final.png
