#!/usr/bin/env python3
# 单文件版补丁4：HUD 双人 + 奖励/篝火/商店/事件联机 + fx路由 + ACTIONS + 输入 + 启动
P = '/home/z/my-project/scripts/standalone/ui.ts'
src = open(P).read()

# ============ HUD：联机显示我的数据 + 双人血条 ============
src = src.replace(
"""function updateHud(run: RunState, combat: boolean) {
  const deck = document.getElementById('hud-deck-count')
  if (!deck) return
  setText(deck, String(run.deck.length))
  updateHpBar(document.getElementById('hud-hp'), run.hp, run.maxHp, run.combat ? AP(run.combat).block : 0)
  const floorEl = document.getElementById('hud-floor')
  if (floorEl) {
    if (combat) floorEl.style.display = 'none'
    else { floorEl.style.display = ''; setText(floorEl, `第 ${run.act} 幕 · 第 ${run.visitedNodes.length} 层`) }
  }
  setText(document.getElementById('hud-gold'), `💰 ${run.gold}`)
  setHtml(document.getElementById('hud-potions'), run.potions.map((p, i) => potionHtml(p, i, combat)).join(''))
  setHtml(document.getElementById('hud-relics'), run.relics.map(id => relicIcon(id)).join(''))
}""",
"""function updateHud(run: RunState, combat: boolean) {
  const deck = document.getElementById('hud-deck-count')
  if (!deck) return
  const st = g()
  const mp = run.players.length > 1
  const myIdx = mp ? st.net.myIdx : 0
  const me = run.players[myIdx] || run.players[0]
  setText(deck, String(me.deck.length))
  const myBlock = combat && run.combat && run.combat.activeIdx === myIdx ? AP(run.combat).block : 0
  updateHpBar(document.getElementById('hud-hp'), me.hp, me.maxHp, myBlock)
  const floorEl = document.getElementById('hud-floor')
  if (floorEl) {
    if (combat) floorEl.style.display = 'none'
    else { floorEl.style.display = ''; setText(floorEl, `第 ${run.act} 幕 · 第 ${run.visitedNodes.length} 层${mp ? ' · 联机合作' : ''}`) }
  }
  setText(document.getElementById('hud-gold'), mp ? `💰 ${me.gold}（队友 ${run.players[1 - myIdx]?.gold ?? '-'}）` : `💰 ${me.gold}`)
  setHtml(document.getElementById('hud-potions'), me.potions.map((p, i) => potionHtml(p, i, combat)).join(''))
  setHtml(document.getElementById('hud-relics'), me.relics.map(id => relicIcon(id)).join(''))
  // 联机：双人迷你血条
  let mini = document.getElementById('hud-mp-hp')
  if (mp) {
    if (!mini) {
      const holder = document.querySelector('.hud-left > div:last-child')
      if (holder) {
        mini = document.createElement('div')
        mini.id = 'hud-mp-hp'
        mini.style.cssText = 'display:flex;flex-direction:column;gap:3px;margin-top:3px'
        holder.appendChild(mini)
      }
    }
    if (mini) {
      setHtml(mini, run.players.map((rp, i) => `
        <div style="display:flex;align-items:center;gap:5px">
          <span class="sts-body" style="font-size:11px;font-weight:700;color:${i === myIdx ? '#8ee8ff' : '#c8a878'};text-shadow:1px 1px 0 #000;min-width:32px">${i === myIdx ? '你' : esc(rp.name)}</span>
          ${hpBarShell('hud-mp-hp-' + i, 180)}
        </div>`).join(''))
      run.players.forEach((rp, i) => updateHpBar(document.getElementById('hud-mp-hp-' + i), rp.hp, rp.maxHp))
    }
  } else mini?.remove()
}""")

# ============ 奖励界面：联机各自金币/卡牌 ============
src = src.replace(
"""function updateRewardScreen(run: RunState) {
  const r = run.reward
  if (!r) return
  const rows: string[] = []
  if (r.gold !== undefined) {
    rows.push(`<button class="reward-row ${r.taken.includes('gold') ? 'done' : ''}" data-act="takeGold">
      <img src="${A('mapicons/treasure.png')}" width="42" height="42"><span class="gold-text">${r.gold} 金币</span>${r.taken.includes('gold') ? '' : '<i>点击获取</i>'}</button>`)
  }""",
"""function updateRewardScreen(run: RunState) {
  const r = run.reward
  if (!r) return
  const st = g()
  const mp = run.players.length > 1
  const myIdx = mp ? st.net.myIdx : 0
  const myGoldTag = mp ? `gold_${myIdx}` : 'gold'
  const myCardTag = `mpcard_${myIdx}`
  const myCards = mp ? (r.mpCards?.[myIdx] ?? []) : r.cards
  const tookMyCard = mp ? r.taken.includes(myCardTag) : r.taken.some(t => t.startsWith('card_'))
  const rows: string[] = []
  if (r.gold !== undefined) {
    rows.push(`<button class="reward-row ${r.taken.includes(myGoldTag) ? 'done' : ''}" data-act="takeGold">
      <img src="${A('mapicons/treasure.png')}" width="42" height="42"><span class="gold-text">${r.gold} 金币</span>${r.taken.includes(myGoldTag) ? '' : '<i>点击获取</i>'}</button>`)
  }""")

src = src.replace(
"""  if (r.cards?.length) {
    setText(label, '选择一张卡牌加入牌组（或跳过）')
    const tookAny = r.taken.some(t => t.startsWith('card_'))
    const seen = new Set<string>()
    r.cards.forEach((cid, i) => {
      seen.add(cid)
      let el = holder.querySelector(`[data-cid="${cid}"]`) as HTMLElement | null
      if (!el) {
        el = document.createElement('div')
        el.dataset.cid = cid
        el.style.animationDelay = `${i * 0.12}s`
        el.innerHTML = cardHtml({ uid: 'r_' + cid, id: cid, upgraded: 0 }, 165) + `<span class="taken-mark sts-title" style="display:none">已选</span>`
        holder.appendChild(el)
      }
      const taken = r.taken.includes('card_' + cid)
      const locked = tookAny && !taken
      el.className = `card-in ${taken || locked ? 'taken' : ''}`
      if (taken || locked) delete el.dataset.act
      else el.dataset.act = 'takeCard'
      const tm = el.querySelector('.taken-mark') as HTMLElement
      if (tm) tm.style.display = taken ? '' : 'none'
    })
    holder.querySelectorAll('[data-cid]').forEach(el => {
      if (!seen.has((el as HTMLElement).dataset.cid!)) el.remove()
    })
  } else {
    holder.innerHTML = ''
    setText(label, '')
  }
  const btn = document.getElementById('reward-proceed')
  if (btn) setText(btn, run.combat?.isBoss ? '继续' : '返回地图')
}""",
"""  if (myCards?.length) {
    setText(label, mp ? '你的卡牌奖励（队友独立选择）' : '选择一张卡牌加入牌组（或跳过）')
    const seen = new Set<string>()
    myCards.forEach((cid, i) => {
      seen.add(cid)
      let el = holder.querySelector(`[data-cid="${cid}"]`) as HTMLElement | null
      if (!el) {
        el = document.createElement('div')
        el.dataset.cid = cid
        el.style.animationDelay = `${i * 0.12}s`
        el.innerHTML = cardHtml({ uid: 'r_' + cid, id: cid, upgraded: 0 }, mp ? 150 : 165) + `<span class="taken-mark sts-title" style="display:none">已选</span>`
        holder.appendChild(el)
      }
      const taken = tookMyCard
      el.className = `card-in ${taken ? 'taken' : ''}`
      if (taken) delete el.dataset.act
      else el.dataset.act = 'takeCard'
      const tm = el.querySelector('.taken-mark') as HTMLElement
      if (tm) tm.style.display = taken ? '' : 'none'
    })
    holder.querySelectorAll('[data-cid]').forEach(el => {
      if (!seen.has((el as HTMLElement).dataset.cid!)) el.remove()
    })
    // 联机：跳过按钮 + 等待提示
    const skipEl = document.getElementById('reward-mp-skip')
    if (skipEl) skipEl.remove()
    if (mp && !tookMyCard) {
      const btnS = document.createElement('button')
      btnS.id = 'reward-mp-skip'
      btnS.className = 'sts-btn sts-body'
      btnS.style.cssText = 'font-size:13px;padding:5px 22px;margin-top:6px'
      btnS.dataset.act = 'mpSkipCard'
      btnS.textContent = '跳过卡牌'
      holder.parentElement?.appendChild(btnS)
    }
  } else {
    holder.innerHTML = ''
    setText(label, '')
    document.getElementById('reward-mp-skip')?.remove()
  }
  // 联机等待提示
  const waitEl = document.getElementById('reward-mp-wait')
  if (waitEl) waitEl.remove()
  if (mp && !run.players.every((_, i) => r.mpDone?.[i])) {
    const w = document.createElement('div')
    w.id = 'reward-mp-wait'
    w.className = 'sts-body'
    w.style.cssText = 'color:#ffe9a0;font-size:14px;display:flex;align-items:center;gap:8px;margin-top:4px'
    w.innerHTML = '<span class="wait-dot">●</span> 等待队友确认…'
    const pbtn = document.getElementById('reward-proceed')
    pbtn?.parentElement?.appendChild(w)
  }
  const btn = document.getElementById('reward-proceed')
  if (btn) setText(btn, run.combat?.isBoss ? '继续' : '返回地图')
}""")

# ============ 篝火：联机选择状态 ============
src = src.replace(
"""function rRest(run: RunState): string {
  const canRest = !run.relics.includes('coffeeDripper')
  const heal = Math.min(Math.floor(run.maxHp * 0.3), run.maxHp - run.hp)
  return `<div class="screen rest-bg center-col">
  <img src="${A('mapicons/rest.png')}" width="140" height="140" style="filter:drop-shadow(0 0 30px rgba(255,150,40,.7))">
  <div class="big-title sts-title">篝火</div>
  <div class="row-cards">
    <button class="sts-panel choice-card ${canRest ? '' : 'dis'}" data-act="rest" data-r="rest">
      <span style="font-size:44px">🛏️</span><div class="sts-title" style="font-size:22px;color:#ffd980">休息</div>
      <div class="sts-body">回复 ${Math.floor(run.maxHp * 0.3)} 点生命值（上限的 30%）<br><span style="color:#8fe89a">当前可回复 ${heal} 点</span></div>
    </button>
    <button class="sts-panel choice-card" data-act="rest" data-r="smith">
      <span style="font-size:44px">⚒️</span><div class="sts-title" style="font-size:22px;color:#ffd980">锻造</div>
      <div class="sts-body">升级牌组中的一张牌</div>
    </button>
  </div>
</div>`
}""",
"""function rRest(run: RunState): string {
  const st = g()
  const mp = run.players.length > 1
  const myIdx = mp ? st.net.myIdx : 0
  const me = run.players[myIdx] || run.players[0]
  const myChoice = mp ? run.mpRest?.[myIdx] : undefined
  const canRest = !me.relics.includes('coffeeDripper')
  const heal = Math.min(Math.floor(me.maxHp * 0.3), me.maxHp - me.hp)
  const mpStatus = mp ? `<div class="sts-body" style="color:#c8b090;font-size:14px;margin-bottom:10px">联机模式：各自选择，全员选好后结算
    ${run.players.map((rp, i) => ` <span style="margin-left:10px;color:${run.mpRest?.[i] ? '#8fe89a' : '#a89070'}">${i === myIdx ? '你' : esc(rp.name)}：${run.mpRest?.[i] === 'rest' ? '休息✔' : run.mpRest?.[i] === 'smith' ? '锻造✔' : '待选…'}</span>`).join('')}</div>` : ''
  const dim = (v: boolean) => v ? '' : 'opacity:.5;cursor:not-allowed;'
  return `<div class="screen rest-bg center-col">
  <img src="${A('mapicons/rest.png')}" width="140" height="140" style="filter:drop-shadow(0 0 30px rgba(255,150,40,.7))">
  <div class="big-title sts-title">篝火</div>
  ${mpStatus}
  <div class="row-cards">
    <button class="sts-panel choice-card ${canRest && !myChoice ? '' : 'dis'}" data-act="rest" data-r="rest" style="${dim(canRest && !myChoice)}">
      <span style="font-size:44px">🛏️</span><div class="sts-title" style="font-size:22px;color:#ffd980">休息</div>
      <div class="sts-body">回复 ${Math.floor(me.maxHp * 0.3)} 点生命值（上限的 30%）<br><span style="color:#8fe89a">当前可回复 ${heal} 点</span></div>
    </button>
    <button class="sts-panel choice-card ${!myChoice ? '' : 'dis'}" data-act="rest" data-r="smith" style="${dim(!myChoice)}">
      <span style="font-size:44px">⚒️</span><div class="sts-title" style="font-size:22px;color:#ffd980">锻造</div>
      <div class="sts-body">升级牌组中的一张牌</div>
    </button>
  </div>
</div>`
}""")

# 篝火 sig 更新需含选择状态
src = src.replace(
"""  else if (scr === 'rest') sigScreen(`rest:${run.hp}:${run.maxHp}:${run.relics.length}`, () => rRest(run))""",
"""  else if (scr === 'rest') sigScreen(`rest:${run.hp}:${run.maxHp}:${run.relics.length}:${run.mpRest?.join(',') ?? ''}:${g().net.myIdx}`, () => rRest(run))""")

# ============ 商店/事件：金币按我的显示 ============
src = src.replace(
"""  setText(document.getElementById('shop-gold'), `💰 ${run.gold}`)""",
"""  const stS = g()
  const mpS = run.players.length > 1
  const meS = run.players[mpS ? stS.net.myIdx : 0] || run.players[0]
  setText(document.getElementById('shop-gold'), mpS ? `💰 ${meS.gold}（队友 ${run.players[1 - (mpS ? stS.net.myIdx : 0)]?.gold ?? '-'}）` : `💰 ${run.gold}`)""")
src = src.replace("setHtml(el.querySelector('.shop-price'), shopPriceTag(item.sold, item.price, run.gold))",
                  "setHtml(el.querySelector('.shop-price'), shopPriceTag(item.sold, item.price, meS.gold))")

src = src.replace(
"""    <div class="event-choices">${ev.choices.map((ch: any, i: number) => {
      const dis = (ch.effect === 'cleric_heal' && run.gold < 35) || (ch.effect === 'cleric_purify' && run.gold < 50)""",
"""    <div class="event-choices">${ev.choices.map((ch: any, i: number) => {
      const meE = run.players[run.players.length > 1 ? g().net.myIdx : 0] || run.players[0]
      const dis = (ch.effect === 'cleric_heal' && meE.gold < 35) || (ch.effect === 'cleric_purify' && meE.gold < 50)""")

# ============ fx 路由：p0/p1 → 各自英雄槽 ============
src = src.replace(
"""  const pz = document.querySelector('.player-zone')""",
"""  const pz = document.querySelector('.player-zone') || document.querySelector('[data-hidx="0"]')""")
src = src.replace(
"""    fxPositions['player'] = { x: (r.left + r.width / 2 - sr.left) / k, y: (r.top + 50 - sr.top) / k }""",
"""    fxPositions['player'] = { x: (r.left + r.width / 2 - sr.left) / k, y: (r.top + 50 - sr.top) / k }
    fxPositions['p0'] = fxPositions['player']
    const pz1 = document.getElementById('player-fx-slot-1')
    if (pz1) {
      const r1 = pz1.getBoundingClientRect()
      fxPositions['p1'] = { x: (r1.left + r1.width / 2 - sr.left) / k, y: (r1.top + 30 - sr.top) / k }
    }""")

# 屏幕震动：任一玩家受击
src = src.replace(
"""    if (f.kind === 'shake') {
      if (f.target === 'player') screenShake()
      else enemyFlash(f.target)
    }""",
"""    if (f.kind === 'shake') {
      if (f.target === 'player' || f.target === 'p0' || f.target === 'p1') screenShake()
      else enemyFlash(f.target)
    }""")

# ============ ACTIONS 新增 + 输入事件 + 齿轮按钮 + 启动 ============
src = src.replace(
"""const ACTIONS: Record<string, (el: HTMLElement) => void> = {
  startRun: () => g().startRun(selectedChar),""",
"""const ACTIONS: Record<string, (el: HTMLElement) => void> = {
  startRun: () => g().startRun(selectedChar),
  gotoMenu: (el) => g().gotoMenuScreen(el.dataset.screen as any),
  continueRun: () => g().continueRun(),
  closeMenu: () => g().toggleMenu(false),
  menuSettings: () => {
    // 菜单内快捷设置：切换面板显示
    const panel = document.getElementById('ingame-menu-settings')
    if (panel) panel.style.display = panel.style.display === 'none' ? 'flex' : 'none'
  },
  abandon: (el) => {
    if (el.dataset.confirm !== '1') {
      el.dataset.confirm = '1'
      setText(el, '确认放弃本局？')
      setTimeout(() => { el.dataset.confirm = '0'; setText(el, '放 弃 本 局') }, 2500)
      return
    }
    g().abandonRun()
  },
  mpLeaveMenu: () => g().netLeave(),
  continueAct: () => g().continueFromActTransition(),
  fullscreen: () => {
    const doc = document as any
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else document.documentElement.requestFullscreen().catch(() => {})
  },
  mpCreate: () => {
    const name = (document.getElementById('mp-name') as HTMLInputElement)?.value?.trim() || loadSettings().playerName
    g().netCreateRoom(name)
  },
  mpJoin: () => {
    const name = (document.getElementById('mp-name') as HTMLInputElement)?.value?.trim() || loadSettings().playerName
    const code = (document.getElementById('mp-code') as HTMLInputElement)?.value?.trim() || ''
    if (code.length < 4) return
    g().netJoinRoom(name, code)
  },
  mpLeave: () => g().netLeave(),
  lobbyPick: (el) => g().lobbyPickChar(el.dataset.char as any),
  lobbyStart: () => g().lobbyStart(),
  mpSkipCard: () => g().mpSkipCard(),""")

src = src.replace(
"""// ============ 启动 ============
setupStage()
setupControls()
useGame.subscribe(render)
render()
console.log('[STS standalone] 游戏就绪')""",
"""// ============ 输入框事件（昵称/房间码/音量） ============
document.addEventListener('input', (e) => {
  const el = e.target as HTMLElement
  const kind = el.dataset?.input
  if (kind === 'mpName') savePlayerName((el as HTMLInputElement).value.trim().slice(0, 10))
  if (kind === 'mpCode') { (el as HTMLInputElement).value = (el as HTMLInputElement).value.toUpperCase() }
  if (kind === 'musicVol') {
    const v = Number((el as HTMLInputElement).value)
    music.setVolume(v)
    const lb = document.getElementById('vol-label')
    if (lb) setText(lb, String(Math.round(v * 100)))
  }
})

// ============ 启动 ============
setupStage()
setupControls()
setupKeyboard()
useGame.subscribe(render)
render()
console.log('[STS standalone] 游戏就绪 v1.4（单人 + 联机合作）')""")

open(P, 'w').write(src)
print('part4 done: hud/reward/rest/shop/actions')
