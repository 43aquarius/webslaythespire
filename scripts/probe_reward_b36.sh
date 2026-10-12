#!/usr/bin/env bash
# 探测：title 屏与注入式 reward 屏的浏览器错误 + 奖励卡 DOM 详情
set -x
agent-browser open http://localhost:3000/ 
sleep 6
echo "===== TITLE ERRORS ====="
agent-browser errors 2>&1 | head -20
echo "===== TITLE CONSOLE(warn/error) ====="
agent-browser console 2>&1 | rg -i "error|warn|failed" | head -10
# 进入 run
agent-browser eval "(() => { const g = window.__sts.getState(); g.startRun('ironclad'); const st = g.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.screen='map'; window.__sts.setState({run:r}); return 'ok' })()" --json
sleep 2
# 注入式 reward（taken: []）
agent-browser eval "(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run));
  r.combat = { players: r.players.map((p,i)=>({uid:'p'+i, hp:p.maxHp, maxHp:p.maxHp, block:0, energy:3, statuses:{}, potions:p.potions||[], relics:p.relics||[]})), enemies: [], activeIdx: 0, turn: 1, drawPile: [], hand: [], discardPile: [], exhaustPile: [], spawnedEnemies: [] };
  r.screen = 'reward';
  r.reward = { cards: [{ cardId: 'bash', upgraded: false }, { cardId: 'whirlwind', upgraded: false }], gold: 25, potionId: 'firePotion', relicId: null, taken: [] };
  window.__sts.setState({ run: r }); return 'ok' })()" --json
sleep 3
echo "===== REWARD ERRORS ====="
agent-browser errors 2>&1 | head -25
echo "===== REWARD CARD DOM ====="
agent-browser eval "(() => {
  const cards = [...document.querySelectorAll('img')].filter(i => i.src.includes('cardart')).slice(0,4).map(i => ({src: i.src.slice(-50), w: i.naturalWidth, complete: i.complete}));
  const bodyTxt = document.body.innerText.slice(0, 300);
  return JSON.stringify({cardArts: cards, text: bodyTxt}, null, 1)
})()" --json
