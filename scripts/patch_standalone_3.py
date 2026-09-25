#!/usr/bin/env python3
# 单文件版补丁3：战斗界面双人（骨架 + 更新 + 意图目标 + HUD 双人 + fx 路由）
P = '/home/z/my-project/scripts/standalone/ui.ts'
src = open(P).read()

# ============ 战斗骨架：单人不变；联机双英雄并排 ============
src = src.replace(
"""function buildCombatScreen(run: RunState): string {
  const hero = run.character
  return `<div class="screen bg-cover" id="combat-screen" data-bg="1" style="background-image:url('${A(combatBgKey(run.act))}')">
  ${topHudShell()}
  <div class="player-zone">
    <div class="player-fx-slot" id="player-fx-slot"></div>
    <div id="player-extra"></div>
    <div id="player-status"></div>
    <img src="${A('hero/' + hero + '.png')}" alt="" style="width:240px;filter:drop-shadow(0 8px 10px rgba(0,0,0,.5))">
  </div>
  <div class="enemies-row" id="enemies-row"></div>""",
"""function buildCombatScreen(run: RunState): string {
  const hero = run.character
  const mp = run.players.length > 1
  const playerZone = mp
    ? `<div class="player-zone" style="left:26px;bottom:88px;flex-direction:row;gap:10px;align-items:flex-end">
      ${run.players.map((p, i) => `
      <div data-hidx="${i}" id="hero-slot-${i}" style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <div class="player-fx-slot" id="player-fx-slot-${i}" style="width:200px;height:52px"></div>
        <div id="player-extra-${i}"></div>
        <div id="player-status-${i}"></div>
        <img src="${A('hero/' + p.character + '.png')}" alt="" id="hero-img-${i}" style="width:200px;filter:drop-shadow(0 8px 10px rgba(0,0,0,.5))">
        <div class="sts-body" id="hero-name-${i}" style="font-size:12px;font-weight:700"></div>
      </div>`).join('')}
      </div>`
    : `<div class="player-zone">
    <div class="player-fx-slot" id="player-fx-slot"></div>
    <div id="player-extra"></div>
    <div id="player-status"></div>
    <img src="${A('hero/' + hero + '.png')}" alt="" style="width:240px;filter:drop-shadow(0 8px 10px rgba(0,0,0,.5))">
  </div>`
  return `<div class="screen bg-cover" id="combat-screen" data-bg="1" style="background-image:url('${A(combatBgKey(run.act))}')">
  ${topHudShell()}
  <div id="mp-wait-banner"></div>
  ${playerZone}
  <div class="enemies-row" id="enemies-row"></div>""")

# ============ 意图：目标伤害 + 目标标记 ============
src = src.replace(
"""function intentHtml(e: EnemyInstance, c: CombatState): string {
  if (!e.intent || e.dying) return ''
  const it = e.intent
  const { dmg, times } = enemyDisplayDamage(e, AP(c).statuses)""",
"""function intentHtml(e: EnemyInstance, c: CombatState): string {
  if (!e.intent || e.dying) return ''
  const it = e.intent
  const mp = c.players.length > 1
  const tgtIdx = mp ? (it.targetIdx ?? 0) : 0
  const TP = c.players[tgtIdx] || AP(c)
  const { dmg, times } = enemyDisplayDamage(e, TP.statuses, TP.stance)
  const tgtLabel = mp && it.type.startsWith('attack') ? `<span class="sts-body" style="font-size:12px;font-weight:700;color:${tgtIdx === g().net.myIdx ? '#ff6a50' : '#6ab0ff'};text-shadow:1px 1px 0 #000">▶${tgtIdx === g().net.myIdx ? '你' : '队友'}</span>` : ''""")

src = src.replace(
"""  return `<div class="intent" data-tip="<b>${esc(mvName)}</b>">
    ${isAtk ? `<img src="${A('intent/' + (map[it.type] || 'unknown') + '.png')}" width="40" height="40">
      <span class="dmg-num sts-num">${dmg}${times > 1 ? `<small>x${times}</small>` : ''}</span>
      ${(it.type === 'attackDebuff' || it.type === 'attackDefend') ? `<img src="${A('intent/' + (it.type === 'attackDebuff' ? 'debuff' : 'defend') + '.png')}" width="28" height="28">` : ''}`
    : `<img src="${A('intent/' + (map[it.type] || 'unknown') + '.png')}" width="42" height="42">`}
  </div>`""",
"""  return `<div class="intent" data-tip="<b>${esc(mvName)}</b>">
    ${isAtk ? `<img src="${A('intent/' + (map[it.type] || 'unknown') + '.png')}" width="40" height="40">
      <span class="dmg-num sts-num">${dmg}${times > 1 ? `<small>x${times}</small>` : ''}</span>
      ${(it.type === 'attackDebuff' || it.type === 'attackDefend') ? `<img src="${A('intent/' + (it.type === 'attackDebuff' ? 'debuff' : 'defend') + '.png')}" width="28" height="28">` : ''}${tgtLabel}`
    : `<img src="${A('intent/' + (map[it.type] || 'unknown') + '.png')}" width="42" height="42">`}
  </div>`""")

# ============ playerExtraHtml：联机按玩家角色 ============
src = src.replace(
"""function playerExtraHtml(run: RunState): string {
  const c = run.combat
  if (!c) return ''
  const p = AP(c)
  let html = ''
  if (run.character === 'watcher') {""",
"""function playerExtraHtml(run: RunState, pidx?: number): string {
  const c = run.combat
  if (!c) return ''
  const p = pidx !== undefined ? c.players[pidx] : AP(c)
  const character = pidx !== undefined ? run.players[pidx]?.character : run.character
  let html = ''
  if (character === 'watcher') {""")
src = src.replace(
"""  if (run.character === 'defect') {
    const orbs = p.orbs || []""",
"""  if (character === 'defect') {
    const orbs = p.orbs || []""")

# ============ updateCombatScreen：联机双英雄更新 ============
src = src.replace(
"""  setHtml(document.getElementById('player-extra'), playerExtraHtml(run))
  setHtml(document.getElementById('player-status'), statusRow(AP(c).statuses, 30))
  updateEnemies(run)
  updateHand(run)
  setText(document.getElementById('energy-num'), String(AP(c).energy))""",
"""  const mp = c.players.length > 1
  if (mp) {
    // 联机：双英雄状态更新（骨架已含双份结构）
    run.players.forEach((rp, i) => {
      const pc = c.players[i]
      const slot = document.getElementById(`hero-slot-${i}`)
      if (!slot || !pc) return
      const isActive = c.activeIdx === i && !pc.dead
      const filter = pc.dead || rp.hp <= 0 ? 'grayscale(1) brightness(.5)' : (isActive ? 'none' : 'brightness(.62)')
      const img = document.getElementById(`hero-img-${i}`) as HTMLElement | null
      if (img && img.style.filter !== filter) img.style.filter = filter
      slot.style.boxShadow = isActive ? '0 0 22px rgba(255,217,128,.28)' : 'none'
      slot.style.borderRadius = '14px'
      setHtml(document.getElementById(`player-extra-${i}`), playerExtraHtml(run, i))
      setHtml(document.getElementById(`player-status-${i}`), statusRow(pc.statuses, 26))
      const nm = document.getElementById(`hero-name-${i}`)
      if (nm) {
        const deadTxt = pc.dead || rp.hp <= 0 ? '（阵亡）' : ''
        const txt = `${rp.name}${i === st.net.myIdx ? '（你）' : ''}${deadTxt}`
        setText(nm, txt)
        nm.style.color = i === st.net.myIdx ? '#8ee8ff' : '#c8a878'
      }
    })
    // 等待横幅
    const myTurn = st.net.myIdx === c.activeIdx
    setHtml(document.getElementById('mp-wait-banner'), (c.phase === 'player' && !myTurn && !c.combatOver)
      ? `<div class="sts-title" style="position:absolute;top:64px;left:50%;transform:translateX(-50%);z-index:70;font-size:19px;color:#ffe9a0;text-shadow:2px 2px 0 #000;letter-spacing:3px;display:flex;align-items:center;gap:8px"><span class="wait-dot">●</span> 等待 ${esc(run.players[c.activeIdx]?.name || '队友')} 行动…</div>` : '')
  } else {
    setHtml(document.getElementById('player-extra'), playerExtraHtml(run))
    setHtml(document.getElementById('player-status'), statusRow(AP(c).statuses, 30))
  }
  updateEnemies(run)
  updateHand(run)
  // 能量球：按活动玩家角色换色（键控，避免闪烁）
  const orbImg = document.querySelector('#energy-box img') as HTMLImageElement | null
  if (orbImg) {
    const oc = ENERGY_ORB[run.players[c.activeIdx]?.character || run.character] || 'redEnergy'
    const url = A('frames/' + oc + '.png')
    if (orbImg.dataset.orb !== oc) { orbImg.dataset.orb = oc; orbImg.src = url }
  }
  setText(document.getElementById('energy-num'), String(AP(c).energy))""")

# ============ 结束回合按钮：联机门控 ============
src = src.replace(
"""  const et = document.getElementById('end-turn-btn') as HTMLButtonElement | null
  if (et) {
    const dis = c.phase !== 'player' || st.busy
    et.disabled = dis || c.combatOver
    et.style.opacity = dis ? '0.5' : '1'
    setText(et, c.phase === 'player' ? '结束回合' : '敌方回合…')
  }""",
"""  const et = document.getElementById('end-turn-btn') as HTMLButtonElement | null
  if (et) {
    const mpE = c.players.length > 1
    const myTurnE = !mpE || st.net.myIdx === c.activeIdx
    const dis = c.phase !== 'player' || st.busy || !myTurnE
    et.disabled = dis || c.combatOver
    et.style.opacity = dis ? '0.5' : '1'
    setText(et, c.phase === 'player' ? (mpE && !myTurnE ? '队友回合…' : '结束回合') : '敌方回合…')
  }""")

# ============ 手牌：非自己回合禁点 ============
src = src.replace(
"""  const c = run.combat
  const st = g()
  const n = AP(c).hand.length
  const mid = (n - 1) / 2
  const playableNow = c.phase === 'player' && !st.busy && !c.combatOver""",
"""  const c = run.combat
  const st = g()
  const n = AP(c).hand.length
  const mid = (n - 1) / 2
  const myTurnH = c.players.length === 1 || st.net.myIdx === c.activeIdx
  const playableNow = c.phase === 'player' && !st.busy && !c.combatOver && myTurnH""")

open(P, 'w').write(src)
print('part3 done: combat MP')
