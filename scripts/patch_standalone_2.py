#!/usr/bin/env python3
# 单文件版补丁2：路由 + 战斗双人 + HUD 双人 + 奖励/篝火/商店/事件/涅奥 联机 + 齿轮菜单 + 快捷键
P = '/home/z/my-project/scripts/standalone/ui.ts'
src = open(P).read()

# ============ 1. 路由：buildScreen / updateScreen / render ============
src = src.replace(
"""function buildScreen(scr: string, run: RunState | null): string {
  if (scr === 'title' || !run) return rTitle()
  if (scr === 'neow') return rNeow(run)
  if (scr === 'map') return buildMapScreen()
  if (scr === 'combat') return buildCombatScreen(run)
  if (scr === 'reward') return buildRewardScreen()
  if (scr === 'shop') return buildShopScreen()
  return '' // 简单界面由 sigScreen 构建
}""",
"""function buildScreen(scr: string, run: RunState | null): string {
  if (scr === 'title' || !run) return rMainMenu()
  if (scr === 'charSelect') return rCharSelect()
  if (scr === 'mpLobby') return rMpLobby()
  if (scr === 'stats') return rStats()
  if (scr === 'settings') return rSettings()
  if (scr === 'credits') return rCredits()
  if (scr === 'actTransition') return rActTransition(run)
  if (scr === 'neow') return rNeow(run)
  if (scr === 'map') return buildMapScreen()
  if (scr === 'combat') return buildCombatScreen(run)
  if (scr === 'reward') return buildRewardScreen()
  if (scr === 'shop') return buildShopScreen()
  return '' // 简单界面由 sigScreen 构建
}""")

src = src.replace(
"""function updateScreen(scr: string, run: RunState | null) {
  if (!run) return
  if (scr === 'combat') updateCombatScreen(run)""",
"""function updateScreen(scr: string, run: RunState | null) {
  if (!run) {
    const st0 = g()
    if (scr === 'mpLobby') sigScreen(`lobby:${st0.net.role}:${st0.net.status}:${st0.net.roomCode}:${st0.net.connected}:${st0.net.lobby?.hostChar}:${st0.net.lobby?.guestChar}:${st0.net.peerName}:${st0.net.error ?? ''}`, () => rMpLobby())
    return
  }
  if (scr === 'mpLobby') sigScreen(`lobby:${g().net.role}:${g().net.status}:${g().net.roomCode}:${g().net.connected}:${g().net.lobby?.hostChar}:${g().net.lobby?.guestChar}:${g().net.peerName}:${g().net.error ?? ''}`, () => rMpLobby())
  if (scr === 'combat') updateCombatScreen(run)""")

src = src.replace(
"""  else if (scr === 'neow') sigScreen(`neow:${run.character}:${run.neow?.chosen ?? ''}:${run.neow?.options.map(o => o.id).join(',')}`, () => rNeow(run))""",
"""  else if (scr === 'neow') sigScreen(`neow:${run.character}:${run.neow?.chosen ?? ''}:${run.neow?.options.map(o => o.id).join(',')}:${run.players.length}:${run.neow?.chooserIdx}:${run.neow?.mpOptions?.map(o => o.map(x => x.id).join('+')).join('|')}`, () => rNeow(run))
  else if (scr === 'actTransition') { /* 骨架已含 data-act=continueAct，自动推进 */ autoAdvanceAct() }""")

src = src.replace(
"""function render() {
  const st = g()
  const run = st.run
  const scr = run ? run.screen : 'title'""",
"""function render() {
  const st = g()
  const run = st.run
  const scr = run ? run.screen : (st.menuScreen || 'title')""")

src = src.replace(
"""  updateScreen(scr, run)
  computeFxPositions()
  renderNewFx()
  renderOverlays(st)
}""",
"""  updateScreen(scr, run)
  computeFxPositions()
  renderNewFx()
  renderOverlays(st)
  renderMenuOverlay(st)
}

// 幕间自动推进（2.6s 或点击）
let actTimer: ReturnType<typeof setTimeout> | null = null
function autoAdvanceAct() {
  if (actTimer) return
  actTimer = setTimeout(() => {
    actTimer = null
    const s = g()
    if (s.run && s.run.screen === 'actTransition') g().continueFromActTransition()
  }, 2600)
}

// ============ 游戏内齿轮菜单遮罩 ============
function renderMenuOverlay(st: ReturnType<typeof g>) {
  let el = document.getElementById('ingame-menu')
  if (!st.run || !st.menuOpen) { el?.remove(); return }
  if (el) return
  el = document.createElement('div')
  el.id = 'ingame-menu'
  el.style.cssText = 'position:absolute;inset:0;z-index:900;background:rgba(4,2,1,.72);display:flex;align-items:center;justify-content:center'
  const mp = st.run.players.length > 1
  el.innerHTML = `<div class="sts-panel" style="padding:28px 50px;display:flex;flex-direction:column;gap:12px;min-width:360px;align-items:center">
    <div class="sts-title" style="font-size:25px;color:#ffd980;letter-spacing:6px;margin-bottom:4px">菜 单</div>
    <button class="sts-btn sts-title" data-act="closeMenu" style="font-size:19px;padding:9px 66px;min-width:240px">继 续 游 戏</button>
    <button class="sts-btn sts-title" data-act="menuSettings" style="font-size:19px;padding:9px 66px;min-width:240px">设　　置</button>
    ${mp
      ? `<button class="sts-btn sts-title" data-act="mpLeaveMenu" style="font-size:19px;padding:9px 66px;min-width:240px;color:#ffa898">退出联机房间</button>`
      : `<button class="sts-btn sts-title" data-act="abandon" data-confirm="0" id="abandon-btn" style="font-size:19px;padding:9px 66px;min-width:240px;color:#e8d8b8">放 弃 本 局</button>`}
    <button class="sts-btn sts-title" data-act="backTitle" style="font-size:19px;padding:9px 66px;min-width:240px">${mp ? '返回主菜单（断开联机）' : '返回主菜单'}</button>
    <div class="sts-body" style="color:#8a7458;font-size:12px;margin-top:2px">第 ${st.run.act} 幕 · 第 ${Math.max(1, st.run.visitedNodes.length)} 层${mp ? ' · 联机合作中' : ' · 进度已自动保存'}</div>
  </div>`
  stageEl.appendChild(el)
}

// ============ 全局键盘快捷键（还原原版：1-9 出牌 / E·空格·回车 结束回合 / Esc 菜单） ============
function setupKeyboard() {
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const tgt = e.target as HTMLElement
    if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return
    const st = g()
    // Esc：菜单 / 取消
    if (e.key === 'Escape') {
      if (st.run) { g().toggleMenu(); e.preventDefault(); return }
      return
    }
    const c = st.run?.combat
    if (!c || c.phase !== 'player' || c.combatOver || st.busy) return
    const mp = c.players.length > 1
    const myTurn = !mp || st.net.myIdx === c.activeIdx
    if (!myTurn) return
    const P = AP(c)
    if (/^[1-9]$/.test(e.key)) {
      const card = P.hand[Number(e.key) - 1]
      if (!card) return
      const def = CARDS[card.id]
      const living = c.enemies.filter(en => !en.dying && en.hp > 0)
      if (def.target === 'enemy' && living.length > 1) { g().clickCard(card.uid); return }
      g().playCard(card.uid, def.target === 'enemy' ? living[0]?.uid ?? null : null)
      e.preventDefault()
      return
    }
    if (e.key === 'e' || e.key === 'E' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      g().endTurn()
    }
  })
}""")

# ============ 2. 涅奥界面：联机双人 ============
src = src.replace(
"""function rNeow(run: RunState): string {
  if (!run.neow) return ''
  const chosen = run.neow.chosen
  const opts = run.neow.options.map((opt, i) => {
    const picked = chosen === opt.id
    return `<button class="neow-opt ${picked ? 'picked' : ''} ${chosen ? 'off' : ''}" data-act="chooseNeow" data-idx="${i}" ${chosen && !picked ? 'disabled' : ''}>
      <div class="sts-title" style="font-size:18px;color:#ffd980">${esc(opt.title)}</div>
      <div class="sts-body" style="font-size:13px;color:#c8b898;line-height:1.6">${esc(opt.desc)}</div>
    </button>`
  }).join('')""",
"""function rNeow(run: RunState): string {
  if (!run.neow) return ''
  const mp = run.players.length > 1
  const st = g()
  const chooserIdx = mp ? (run.neow.chooserIdx ?? 0) : 0
  const isMyChoice = !mp || chooserIdx === st.net.myIdx
  const chosen = mp ? (run.neow.mpChosen?.[chooserIdx] ?? null) : run.neow.chosen
  const options = mp ? (run.neow.mpOptions?.[chooserIdx] ?? []) : run.neow.options
  const chooserName = mp ? (run.players[chooserIdx]?.name || '') : ''
  const greeting = mp
    ? (isMyChoice ? `「${esc(chooserName)}，轮到你了——选择你的祝福。」` : `「${esc(chooserName)} 正在选择祝福…」`)
    : `「<span style="color:#ffd980">${NEOW_GREETING[run.character] || '旅人'}</span>，我将赐予你一份祝福——选择吧。」`
  const waitBanner = mp && !isMyChoice
    ? `<div class="sts-title" style="font-size:21px;color:#ffe9a0;display:flex;align-items:center;gap:10px;margin-bottom:14px"><span class="wait-dot">●</span> 等待 ${esc(chooserName)} 选择祝福…</div>` : ''
  const opts = options.map((opt, i) => {
    const picked = chosen === opt.id
    const dis = !!chosen || (mp && !isMyChoice)
    return `<button class="neow-opt ${picked ? 'picked' : ''} ${dis ? 'off' : ''}" data-act="chooseNeow" data-idx="${i}" ${dis && !picked ? 'disabled' : ''}>
      <div class="sts-title" style="font-size:18px;color:#ffd980">${esc(opt.title)}</div>
      <div class="sts-body" style="font-size:13px;color:#c8b898;line-height:1.6">${esc(opt.desc)}</div>
    </button>`
  }).join('')""")

src = src.replace(
"""    <div class="sts-body" style="color:#a8b8d8;font-size:15px;line-height:1.8;max-width:620px;margin:4px 0 14px">巨鲸涅奥在尖塔脚下苏醒。<br>「<span style="color:#ffd980">${NEOW_GREETING[run.character] || '旅人'}</span>，我将赐予你一份祝福——选择吧。」</div>
    <div class="neow-row">${opts}</div>""",
"""    <div class="sts-body" style="color:#a8b8d8;font-size:15px;line-height:1.8;max-width:620px;margin:4px 0 14px">巨鲸涅奥在尖塔脚下苏醒。<br>${greeting}</div>
    ${waitBanner}
    <div class="neow-row">${opts}</div>""")

open(P, 'w').write(src)
print('part2 done: routing + neow')
