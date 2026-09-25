// ============ 单文件版 UI（原生 JS，区域化渲染修复闪动） ============
// 架构：1600×900 舞台等比缩放 + 屏幕切换时构建骨架 + 状态更新时仅差异更新区域
// 修复：innerHTML 全量重建导致的画面闪动；补上选牌/牌堆遮罩渲染
import { useGame } from '@/store/gameStore'
import { CARDS, cardCost, cardDesc, cardColor } from '@/game/cards'
import { ENEMIES } from '@/game/enemies'
import { RELICS } from '@/game/relics'
import { POTIONS } from '@/game/potions'
import { enemyDisplayDamage, AP } from '@/game/engine'
import { EVENTS } from '@/game/events'
import { CHARACTER_INFO } from '@/game/run'
import { STATUS_INFO, STATUS_IMG_FIX, statusImgPath } from '@/game/statusInfo'
import { hasSave, loadStats, loadSettings, savePlayerName } from '@/game/persist'
import type { CharacterId } from '@/game/types'
import type { RunState, CombatState, CardInstance, EnemyInstance } from '@/game/types'

declare const ASSETS: Record<string, string>
const A = (k: string) => ASSETS[k] || ''

// 状态图标路径（共享映射 + 单文件素材解析）
function statusImgKey(id: string): string {
  const fix = STATUS_IMG_FIX[id]
  return fix ? (fix.startsWith('../') ? fix.slice(3) : 'status/' + fix) + '.png' : 'status/' + id + '.png'
}


const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const g = () => useGame.getState()
const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(hover: none)').matches

// ============ 区域差异更新工具（防闪动核心） ============
function setHtml(el: HTMLElement | null, html: string) {
  if (!el) return
  if ((el as any).__sig !== html) { (el as any).__sig = html; el.innerHTML = html }
}
function setText(el: HTMLElement | null, text: string) {
  if (el && el.textContent !== text) el.textContent = text
}

// ============ 舞台（1600×900 等比缩放 + 竖屏提示） ============
const STAGE_W = 1600, STAGE_H = 900
let stageEl: HTMLElement
let fxLayer: HTMLElement
const app = document.getElementById('app')!

let portraitForceContinue = false
function isPortraitNeed() {
  // 双信号：任一判定竖屏且小屏才提示（平板竖屏不提示）
  const bySize = window.innerHeight > window.innerWidth
  const byMq = matchMedia('(orientation: portrait)').matches
  const small = Math.min(window.innerWidth, window.innerHeight) < 760
  return small && (bySize || byMq) && !portraitForceContinue
}

function fitStage() {
  const k = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H)
  stageEl.style.transform = `translate(-50%, -50%) scale(${k})`
  const rp = document.getElementById('rotate-prompt')
  if (rp) rp.style.display = isPortraitNeed() ? 'flex' : 'none'
}

function setupStage() {
  const wrap = document.createElement('div'); wrap.id = 'stage-wrap'
  const stage = document.createElement('div'); stage.id = 'stage'
  const fx = document.getElementById('fx-layer')!
  const toast = document.getElementById('toast')!
  document.body.appendChild(wrap)
  wrap.appendChild(stage)
  stage.appendChild(app)
  stage.appendChild(fx)
  stage.appendChild(toast)
  const ov = document.createElement('div'); ov.id = 'overlay-layer'
  stage.appendChild(ov)
  // 竖屏提示（含逃生按钮：永不卡死）
  const rp = document.createElement('div'); rp.id = 'rotate-prompt'
  rp.innerHTML = `<div class="rotate-phone"></div>
    <div class="sts-title" style="font-size:30px;color:#ffd980;text-shadow:2px 2px 0 #000">请横屏游玩</div>
    <div class="sts-body" style="color:#a89070;font-size:15px;line-height:1.8;text-align:center">杀戮尖塔为横屏游戏<br>旋转设备以获得最佳体验</div>
    <button class="sts-btn sts-title" id="rp-try-landscape" style="font-size:18px;padding:9px 30px">⛶ 自动切换横屏</button>
    <button class="sts-btn" id="rp-continue" style="font-size:15px;padding:7px 22px;opacity:.85">竖屏继续游玩 →</button>`
  document.body.appendChild(rp)
  rp.querySelector('#rp-try-landscape')?.addEventListener('click', async () => {
    try {
      const d = document as any
      if (!d.fullscreenElement) await d.documentElement.requestFullscreen().catch(() => { })
      const so = (screen as any).orientation
      await so?.lock?.('landscape')?.catch(() => { })
    } catch { /* iOS 不支持，静默 */ }
  })
  rp.querySelector('#rp-continue')?.addEventListener('click', () => {
    portraitForceContinue = true
    fitStage()
  })
  stageEl = stage
  fxLayer = fx
  fitStage()
  window.addEventListener('resize', fitStage)
  window.addEventListener('orientationchange', () => {
    // 部分安卓浏览器尺寸延迟更新：多次重测
    setTimeout(fitStage, 100); setTimeout(fitStage, 350); setTimeout(fitStage, 800)
  })
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitStage)
  // 预加载关键背景，避免首次切屏白闪
  for (const k of ['bg/combat.jpg', 'bg/map.jpg']) { const img = new Image(); img.src = A(k) }
}

// ============ BGM 引擎（曲目映射自原版反编译源码） ============
type TrackKey = 'menu' | 'level' | 'elite' | 'boss' | 'merchant' | 'shrine' | 'credits' | 'victory' | 'death'
const MUSIC_SRC: Record<TrackKey, string> = {
  menu: A('audio/menu.ogg'),
  level: A('audio/level.ogg'),
  elite: A('audio/elite.ogg'),
  boss: A('audio/boss.ogg'),
  merchant: A('audio/merchant.ogg'),
  shrine: A('audio/shrine.ogg'),
  credits: A('audio/credits.ogg'),
  victory: A('audio/victory.ogg'),
  death: A('audio/death.ogg'),
}

class MusicEngine {
  private a = new Audio()
  private b = new Audio()
  private active: HTMLAudioElement
  private fadeTargets: Array<{ el: HTMLAudioElement; target: number }> = []
  private fadeTimer: ReturnType<typeof setInterval> | null = null
  private currentKey: TrackKey | null = null
  private pendingKey: TrackKey | null = null
  private unlocked = false
  private unlockBound = false
  volume = 0.55
  muted = false

  constructor() {
    try {
      this.volume = Number(localStorage.getItem('sts-music-vol') ?? 0.55)
      this.muted = localStorage.getItem('sts-music-muted') === '1'
    } catch { /* file:// 或隐私模式 */ }
    for (const el of [this.a, this.b]) { el.preload = 'auto'; el.volume = this.effVol() }
    this.active = this.a
  }
  private effVol() { return this.muted ? 0 : this.volume }

  unlock() {
    if (this.unlocked) return
    this.unlocked = true
    if (this.pendingKey) { const k = this.pendingKey; this.pendingKey = null; this.play(k) }
  }
  private ensureUnlock() {
    if (this.unlocked) return
    if (!this.unlockBound) {
      this.unlockBound = true
      const handler = () => {
        this.unlock()
        window.removeEventListener('pointerdown', handler)
        window.removeEventListener('keydown', handler)
      }
      window.addEventListener('pointerdown', handler)
      window.addEventListener('keydown', handler)
    }
  }

  play(key: TrackKey) {
    this.ensureUnlock()
    if (!this.unlocked) { this.pendingKey = key; return }
    if (this.currentKey === key && !this.active.paused) return
    this.currentKey = key
    this.crossfade(MUSIC_SRC[key], true, 1.6)
  }

  stinger(key: TrackKey, follow?: TrackKey) {
    this.ensureUnlock()
    if (!this.unlocked) { this.pendingKey = key; return }
    this.currentKey = key
    this.crossfade(MUSIC_SRC[key], false, 0.8, () => {
      if (follow) { this.currentKey = follow; this.crossfade(MUSIC_SRC[follow], true, 2) }
    })
  }

  private crossfade(src: string, loop: boolean, fadeSec: number, onEnded?: () => void) {
    const from = this.active
    const to = from === this.a ? this.b : this.a
    this.active = to
    to.src = src
    to.loop = loop
    to.volume = 0
    if (onEnded) { to.onended = () => { to.onended = null; onEnded() } } else { to.onended = null }
    to.play().catch(() => { })
    // 目标音量驱动：from→0 后暂停，to→目标音量（连续切歌安全）
    this.fadeTargets = [
      { el: from, target: 0 },
      { el: to, target: this.effVol() },
    ]
    if (this.fadeTimer) return
    const step = Math.max(0.02, 1 / Math.max(1, Math.round(fadeSec * 30)))
    this.fadeTimer = setInterval(() => {
      let done = true
      for (const t of this.fadeTargets) {
        const el = t.el, goal = t.target, cur = el.volume
        if (Math.abs(cur - goal) <= step) {
          el.volume = goal
          if (goal === 0 && el !== this.active && !el.paused) {
            try { el.pause(); el.currentTime = 0 } catch { }
          }
        } else {
          el.volume = cur + Math.sign(goal - cur) * step
          done = false
        }
      }
      if (done) { if (this.fadeTimer) { clearInterval(this.fadeTimer); this.fadeTimer = null } }
    }, 1000 / 30)
  }

  setVolume(v: number) {
    this.volume = v
    try { localStorage.setItem('sts-music-vol', String(v)) } catch { }
    this.active.volume = this.effVol()
    for (const t of this.fadeTargets) if (t.el === this.active) t.target = this.effVol()
  }
  setMuted(m: boolean) {
    this.muted = m
    try { localStorage.setItem('sts-music-muted', m ? '1' : '0') } catch { }
    this.active.volume = this.effVol()
    for (const t of this.fadeTargets) if (t.el === this.active) t.target = this.effVol()
  }
}
const music = new MusicEngine()
;(window as any).__music = music

let musicLastStinger: string | null = null
function updateMusic(st: ReturnType<typeof g>) {
  const run = st.run
  const scr = run ? run.screen : 'title'
  if (!run) { music.play('menu'); return }
  if (scr === 'victory') {
    if (musicLastStinger !== 'victory') { musicLastStinger = 'victory'; music.stinger('victory', 'credits') }
    return
  }
  if (scr === 'gameover') {
    if (musicLastStinger !== 'gameover') { musicLastStinger = 'gameover'; music.stinger('death') }
    return
  }
  musicLastStinger = null
  let key: TrackKey = 'level'
  if (scr === 'neow') key = 'shrine'
  else if (scr === 'shop') key = 'merchant'
  else if (scr === 'event') key = 'shrine'
  else if (scr === 'bossRelic') key = 'credits'
  else if (scr === 'combat') {
    const c = run.combat
    key = c?.isBoss ? 'boss' : c?.isElite ? 'elite' : 'level'
  }
  music.play(key)
}

// ============ 卡牌 HTML（四色卡框/宝球/类型图标） ============
function raritySuffix(rarity: string): string {
  if (rarity === 'rare') return 'Rare'
  if (rarity === 'uncommon') return 'Uncommon'
  return 'Common'
}
const COLOR_FRAME_BG: Record<string, Record<string, string>> = {
  red: { attack: 'frames/bgAttackRed.png', skill: 'frames/bgSkillRed.png', power: 'frames/bgPowerRed.png' },
  green: { attack: 'frames/bgAttackGreen.png', skill: 'frames/bgSkillGreen.png', power: 'frames/bgPowerGreen.png' },
  blue: { attack: 'frames/bgAttackBlue.png', skill: 'frames/bgSkillBlue.png', power: 'frames/bgPowerBlue.png' },
  purple: { attack: 'frames/bgAttackPurple.png', skill: 'frames/bgSkillPurple.png', power: 'frames/bgPowerPurple.png' },
  colorless: { attack: 'frames/bgAttackRed.png', skill: 'frames/bgSkillRed.png', power: 'frames/bgPowerRed.png' },
}
const COLOR_ORB: Record<string, string> = { red: 'cardRedOrb', green: 'cardGreenOrb', blue: 'cardBlueOrb', purple: 'cardPurpleOrb', colorless: 'cardRedOrb' }
const TYPEICON_BASE: Record<string, string> = { red: '', green: 'silent', blue: 'defect', purple: 'watcher', colorless: '' }
function typeIconKey(color: string, type: string, rarity: string): string {
  const base = TYPEICON_BASE[color] || ''
  let rar = raritySuffix(rarity)
  if (type === 'power' && rar === 'Common') rar = 'Uncommon'
  if (!base) return 'typeicons/' + type + rar + '.png'
  return 'typeicons/' + base + type + rar.toLowerCase() + '.png'
}
const TYPE_NAME: Record<string, string> = { attack: '攻击', skill: '技能', power: '能力' }

// 卡面内容（不含外层 .sts-card 包装，供手牌做差异更新）
function cardInner(card: CardInstance, width = 148): string {
  const def = CARDS[card.id]
  if (!def) return ''
  const rar = raritySuffix(def.rarity)
  const color = cardColor(card.id)
  const cost = cardCost(card, 0)
  const desc = cardDesc(card)
  const up = card.upgraded > 0
  const bg = (COLOR_FRAME_BG[color] || COLOR_FRAME_BG.red)[def.type]
  const orb = COLOR_ORB[color] || 'cardRedOrb'
  return `<img class="c512" src="${A(bg)}" alt="">
  <img src="${A('cardart/' + card.id + '.png')}" alt="" style="position:absolute;object-fit:cover;left:4%;top:11.5%;width:87.6%;height:49%;border-radius:3px">
  <img class="c512" src="${A('frames/frame' + def.type[0].toUpperCase() + def.type.slice(1) + rar + '.png')}" alt="">
  <img class="c512" src="${A('frames/banner' + rar + '.png')}" alt="">
  <div class="sts-title card-name" style="font-size:${width * 0.088}px;color:${rar === 'Rare' ? '#ffd98a' : '#ffe9c4'}">${esc(def.name)}</div>
  ${cost !== -99 ? `<img class="c512" src="${A('frames/' + orb + '.png')}" alt="">
  <div class="sts-title card-cost" style="font-size:${width * 0.115}px">${cost === -1 ? 'X' : cost}</div>` : ''}
  <div class="sts-body card-desc" style="font-size:${width * 0.076}px">${up ? '<span style="color:#7fe08a">+ </span>' : ''}${esc(desc)}</div>
  <div class="card-type-row"><img src="${A(typeIconKey(color, def.type, def.rarity))}" alt=""><span class="sts-title" style="font-size:${width * 0.062}px">${TYPE_NAME[def.type]}</span></div>
  ${up ? '<div class="sts-title card-up">✦</div>' : ''}`
}

function cardHtml(card: CardInstance, width = 148, extra = ''): string {
  const def = CARDS[card.id]
  if (!def) return ''
  return `<div class="sts-card ${extra}" style="width:${width}px;height:${width * 1.4003}px">${cardInner(card, width)}</div>`
}

// ============ 状态图标行 ============
function statusRow(statuses: Record<string, number>, size = 26): string {
  const entries = Object.entries(statuses).filter(([, v]) => v !== 0)
  if (!entries.length) return ''
  return `<div class="status-row">${entries.map(([id, n]) => {
    const info = STATUS_INFO[id]
    return `<span class="status-badge" data-tip="<b>${esc(info?.name ?? id)}</b><br>${esc(info?.desc ?? '')}" style="width:${size}px;height:${size}px">
      <img src="${A(statusImgKey(id))}" alt="">
      ${(n !== 1 || ['vulnerable', 'weak', 'frail', 'noDraw'].includes(id)) ? `<i style="font-size:${size * 0.42}px">${n}</i>` : ''}
    </span>`
  }).join('')}</div>`
}

// ============ 血条（结构固定 + 平滑更新） ============
function hpBarShell(id: string, width: number): string {
  return `<div class="hpbar" ${id ? `id="${id}"` : ''} style="width:${width}px">
    <div class="hpbar-outer" style="height:22px">
      <div class="hpbar-fill" style="width:100%"></div>
      <span class="hp-text"></span>
      <span class="block-badge" style="display:none"><img src="${A('status/block.png')}" alt=""><i></i></span>
    </div>
  </div>`
}
function updateHpBar(el: HTMLElement | null, hp: number, maxHp: number, block?: number) {
  if (!el) return
  const pct = Math.max(0, Math.min(100, hp / maxHp * 100))
  const fill = el.querySelector('.hpbar-fill') as HTMLElement
  if (fill) fill.style.width = pct + '%'
  setText(el.querySelector('.hp-text'), `${hp} / ${maxHp}`)
  const bb = el.querySelector('.block-badge') as HTMLElement
  if (bb) {
    if (block !== undefined && block > 0) {
      bb.style.display = ''
      setText(bb.querySelector('i'), String(block))
    } else bb.style.display = 'none'
  }
}

function relicIcon(id: string, size = 34): string {
  const def = RELICS[id]
  if (!def) return ''
  return `<span class="relic" data-tip="<b>${esc(def.name)}</b><br><span style='color:#d8c8a8'>${esc(def.desc)}</span>" style="width:${size}px;height:${size}px"><img src="${A('relics/' + id + '.png')}" alt=""></span>`
}

function potionHtml(pid: string | null, idx: number, combat: boolean): string {
  const sel = combat && g().selectedPotionIdx === idx
  if (!pid) return `<span class="pslot" style="width:38px;height:44px"></span>`
  const def = POTIONS[pid]
  return `<span class="pslot has ${sel ? 'sel' : ''}" data-act="potion" data-idx="${idx}" data-tip="<b>${esc(def.name)}</b><br><span style='color:#d8c8a8'>${esc(def.desc)}</span>">
    <img src="${A('potions/' + pid + '.png')}" alt="">
    ${combat ? `<i class="pdisc" data-act="potionDiscard" data-idx="${idx}">✕</i>` : ''}
  </span>`
}

// ============ 顶部 HUD（参照原版：左上牌组+血条，右上金币+药水+遗物） ============
function topHudShell(): string {
  return `<div class="top-hud"><div class="hud-row">
    <div class="hud-left">
      <button class="sts-btn deck-btn" data-act="openPile" data-pile="deck" data-tip="<b>查看牌组</b>">
        <img src="${A('frames/cardRedOrb.png')}" alt=""><b class="sts-num" id="hud-deck-count"></b>
      </button>
      <div>
        ${hpBarShell('hud-hp', 300)}
        <div class="floor-stat" id="hud-floor" style="display:none"></div>
      </div>
    </div>
    <div class="hud-right">
      <div class="hud-gold-pots">
        <span class="gold-stat sts-body sts-num" id="hud-gold"></span>
        <span class="pots-row" id="hud-potions"></span>
      </div>
      <span class="relics hud-relics" id="hud-relics"></span>
    </div>
  </div></div>`
}

function updateHud(run: RunState, combat: boolean) {
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
}

// ============ GitHub 图标（内联 SVG） ============
const GITHUB_SVG = `<svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>`

// ============ 标题（四角色选择 + GitHub 入口） ============
const CHARACTERS: CharacterId[] = ['ironclad', 'silent', 'defect', 'watcher']
const CHAR_COLOR: Record<string, string> = { ironclad: '#b03828', silent: '#3a9a5a', defect: '#3a7ac8', watcher: '#9a5ab8' }
let selectedChar: CharacterId = 'ironclad'

// ---- 主菜单（原版风格竖排菜单） ----
function rMainMenu(): string {
  const canCont = hasSave()
  const items = [
    { label: '开 始 冒 险', act: 'gotoMenu', arg: 'charSelect', dis: false },
    { label: '继 续 冒 险', act: 'continueRun', arg: '', dis: !canCont },
    { label: '联 机 合 作', act: 'gotoMenu', arg: 'mpLobby', dis: false },
    { label: '统　　计', act: 'gotoMenu', arg: 'stats', dis: false },
    { label: '设　　置', act: 'gotoMenu', arg: 'settings', dis: false },
    { label: '制 作 名 单', act: 'gotoMenu', arg: 'credits', dis: false },
  ]
  return `<div class="screen bg-cover" style="background-image:url('${A('bg/combat.jpg')}')">
  <div class="shade" style="background:rgba(6,3,2,.62)"></div>
  <div class="center-col" style="padding-top:0;gap:14px">
    <h1 class="sts-title game-title">杀戮尖塔</h1>
    <div class="sts-title subtitle">—— SLAY THE SPIRE · WEB 复刻版 ——</div>
    <div style="display:flex;flex-direction:column;gap:11px;margin-top:26px">
      ${items.map(it => `<button class="sts-btn menu-item sts-title" data-act="${it.act}" ${it.arg ? `data-screen="${it.arg}"` : ''} ${it.dis ? 'disabled' : ''}
        style="font-size:23px;letter-spacing:5px;padding:10px 80px;min-width:320px;${it.dis ? 'opacity:.4;cursor:not-allowed' : ''}">${it.label}</button>`).join('')}
    </div>
    <div class="sts-body" style="color:#8a7458;font-size:12px;position:absolute;left:16px;bottom:12px">Web 复刻版 v1.4 · 单人 + 联机合作</div>
  </div>
  <a class="github-btn" href="https://github.com/43aquaris/webslaythespire" target="_blank" rel="noreferrer" title="GitHub 仓库">${GITHUB_SVG}<span>43aquarius/webslaythespire</span></a>
</div>`
}

// ---- 角色选择（原版：角色站立 + 出发/返回） ----
function rCharSelect(): string {
  const info = CHARACTER_INFO[selectedChar]
  const cards = CHARACTERS.map(c => {
    const sel = selectedChar === c
    const col = CHAR_COLOR[c]
    return `<div class="char-card ${sel ? 'sel' : ''}" data-act="pickChar" data-char="${c}" style="${sel ? `border-color:${col};box-shadow:0 0 22px ${col}66` : ''}">
      <img src="${A('hero/' + c + '.png')}" alt="${info.name}" draggable="false">
      <div class="sts-title" style="font-size:20px;color:${sel ? col : '#d8c8a8'};text-shadow:1px 1px 0 #000">${CHARACTER_INFO[c].name}</div>
      <div class="sts-body" style="font-size:12px;color:#a89878;line-height:1.5">${CHARACTER_INFO[c].desc}<br>❤ ${CHARACTER_INFO[c].hp} 生命 · ${RELICS[CHARACTER_INFO[c].relic]?.name ?? ''}</div>
    </div>`
  }).join('')
  return `<div class="screen bg-cover" style="background-image:url('${A('bg/combat.jpg')}')">
  <div class="shade" style="background:rgba(6,3,2,.58)"></div>
  <div class="center-col" style="padding-top:0;gap:16px">
    <div class="sts-title" style="font-size:38px;color:#ffd980;text-shadow:3px 3px 0 #000;letter-spacing:8px">选 择 你 的 角 色</div>
    <div class="char-row">${cards}</div>
    <div class="sts-body" style="color:#c8b090;font-size:14px;max-width:560px;text-align:center;line-height:1.7">
      <span style="color:#ffd980">${info.name}</span> · ${info.desc}<br>全 4 幕 · 220+ 卡牌 · 60+ 敌人 · 12 首领</div>
    <div class="row" style="gap:36px;margin-top:6px">
      <button class="sts-btn sts-title" data-act="gotoMenu" data-screen="title" style="font-size:20px;padding:10px 44px;letter-spacing:4px">返 回</button>
      <button class="sts-btn sts-title" data-act="startRun" style="font-size:26px;padding:12px 68px;letter-spacing:6px">出 发</button>
    </div>
  </div>
</div>`
}

// ---- 设置 ----
function rSettings(): string {
  const s = loadSettings()
  return `<div class="screen bg-cover" style="background-image:url('${A('bg/combat.jpg')}')">
  <div class="shade" style="background:rgba(6,3,2,.66)"></div>
  <div class="center-col" style="padding-top:0;gap:18px">
    <div class="sts-title" style="font-size:32px;color:#ffd980;letter-spacing:6px">设 置</div>
    <div class="sts-panel" style="padding:30px 48px;display:flex;flex-direction:column;gap:16px;min-width:480px">
      <div class="row" style="gap:12px"><span class="sts-body" style="color:#c8b090;width:100px;font-size:15px">联机昵称</span>
        <input class="sts-body" data-input="mpName" value="${esc(s.playerName)}" maxlength="10" placeholder="联机时显示的名字"
          style="flex:1;background:rgba(0,0,0,.5);border:1.5px solid #6b4a2e;border-radius:8px;color:#e8d8b8;padding:8px 12px;font-size:15px"></div>
      <div class="row" style="gap:12px"><span class="sts-body" style="color:#c8b090;width:100px;font-size:15px">音乐音量</span>
        <input type="range" data-input="musicVol" min="0" max="1" step="0.05" value="${music.volume}" style="flex:1;accent-color:#c8a060">
        <span class="sts-body" style="color:#d8c8a8;width:36px;font-size:14px" id="vol-label">${music.muted ? 0 : Math.round(music.volume * 100)}</span></div>
      <div class="row" style="gap:12px"><span class="sts-body" style="color:#c8b090;width:100px;font-size:15px">全屏</span>
        <button class="sts-btn sts-body" data-act="fullscreen" style="font-size:14px;padding:6px 20px">切换全屏（手机自动横屏）</button></div>
    </div>
    <button class="sts-btn sts-title" data-act="gotoMenu" data-screen="title" style="font-size:20px;padding:10px 60px">返 回</button>
  </div>
</div>`
}

// ---- 统计 ----
function rStats(): string {
  const s = loadStats()
  const winRate = s.runs > 0 ? Math.round((s.wins / s.runs) * 100) : 0
  const charRow = (c: CharacterId) => {
    const e = s.perChar[c]
    return `<div class="srow"><span>${CHARACTER_INFO[c].name}</span><b>${e ? `${e.runs} 局 · ${e.wins} 胜 · 最高 ${e.bestFloor} 层` : '未使用'}</b></div>`
  }
  return `<div class="screen bg-cover" style="background-image:url('${A('bg/combat.jpg')}')">
  <div class="shade" style="background:rgba(6,3,2,.66)"></div>
  <div class="center-col" style="padding-top:0;gap:14px">
    <div class="sts-title" style="font-size:32px;color:#ffd980;letter-spacing:6px">统 计</div>
    <div class="sts-panel" style="padding:26px 46px;display:flex;flex-direction:column;gap:9px;min-width:460px">
      <div class="srow"><span>冒险次数</span><b>${s.runs}</b></div>
      <div class="srow"><span>登顶次数</span><b style="color:#8ee888">${s.wins}</b></div>
      <div class="srow"><span>胜率</span><b>${winRate}%</b></div>
      <div class="srow"><span>最高层数</span><b style="color:#ffd980">${s.bestFloor}</b></div>
      <div class="srow"><span>累计击杀</span><b>${s.totalKills}</b></div>
      <div class="srow"><span>累计精英</span><b>${s.totalElites}</b></div>
      <div class="srow"><span>累计金币</span><b style="color:#ffd97a">${s.totalGold}</b></div>
      <div class="sts-title" style="font-size:16px;color:#c8a878;letter-spacing:3px;margin-top:8px">—— 各角色 ——</div>
      ${CHARACTERS.map(charRow).join('')}
    </div>
    <button class="sts-btn sts-title" data-act="gotoMenu" data-screen="title" style="font-size:20px;padding:10px 60px">返 回</button>
  </div>
</div>`
}

// ---- 制作名单 ----
function rCredits(): string {
  return `<div class="screen bg-cover" style="background-image:url('${A('bg/combat.jpg')}')">
  <div class="shade" style="background:rgba(6,3,2,.7)"></div>
  <div class="center-col" style="padding-top:0;gap:12px">
    <div class="sts-title" style="font-size:32px;color:#ffd980;letter-spacing:6px">制 作 名 单</div>
    <div class="sts-panel sts-body" style="padding:28px 52px;max-width:560px;color:#c8b090;font-size:15px;line-height:2;text-align:center">
      <b style="color:#e8d8b8">Web 复刻版</b><br>基于 Mega Crit Games 的《杀戮尖塔》玩法复刻<br>仅供学习交流使用 · 请支持正版原作<br>
      <b style="color:#e8d8b8">技术</b><br>原生 JS · Zustand · Web Animations · PeerJS 联机<br>
      <b style="color:#e8d8b8">开源</b><br>github.com/43aquaris/webslaythespire</div>
    <button class="sts-btn sts-title" data-act="gotoMenu" data-screen="title" style="font-size:20px;padding:10px 60px">返 回</button>
  </div>
</div>`
}

// ---- 联机大厅 ----
function rMpLobby(): string {
  const st = g()
  const n = st.net
  if (!n.role) {
    const s = loadSettings()
    return `<div class="screen bg-cover" style="background-image:url('${A('bg/combat.jpg')}')">
    <div class="shade" style="background:rgba(6,3,2,.64)"></div>
    <div class="center-col" style="padding-top:0;gap:16px">
      <div class="sts-title" style="font-size:34px;color:#ffd980;letter-spacing:8px">联 机 合 作</div>
      <div class="sts-body" style="color:#c8b090;font-size:15px;line-height:1.9;max-width:480px;text-align:center">
        仿照《杀戮尖塔 2》的合作模式：与好友一起攀登尖塔。<br>共享地图与敌人，各自拥有独立的牌组、生命与能量；<br>轮流行动，共同战斗（P2P 直连，无需服务器）。</div>
      <div class="row" style="gap:10px"><span class="sts-body" style="color:#c8b090;font-size:15px">昵称</span>
        <input class="sts-body" id="mp-name" value="${esc(s.playerName)}" maxlength="10" data-input="mpName"
          style="background:rgba(0,0,0,.5);border:1.5px solid #6b4a2e;border-radius:8px;color:#e8d8b8;padding:8px 12px;font-size:15px;width:170px"></div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:6px">
        <button class="sts-btn sts-title" data-act="mpCreate" style="font-size:22px;letter-spacing:4px;padding:10px 66px">创 建 房 间</button>
        <div class="row" style="gap:8px">
          <input class="sts-body" id="mp-code" placeholder="房间码" maxlength="6" data-input="mpCode"
            style="background:rgba(0,0,0,.5);border:1.5px solid #6b4a2e;border-radius:8px;color:#e8d8b8;padding:8px 12px;font-size:17px;width:140px;letter-spacing:3px;text-align:center;text-transform:uppercase">
          <button class="sts-btn sts-body" data-act="mpJoin" style="font-size:14px;padding:8px 16px">加入房间</button>
        </div>
      </div>
      <button class="sts-btn sts-body" data-act="gotoMenu" data-screen="title" style="font-size:15px;padding:6px 28px;margin-top:8px">返回主菜单</button>
      ${n.error ? `<div class="sts-body" style="color:#ff9a8a;font-size:14px">${esc(n.error)}</div>` : ''}
    </div>
  </div>`
  }
  const isHost = n.role === 'host'
  const myChar = isHost ? n.lobby.hostChar : n.lobby.guestChar
  const otherName = n.peerName || '等待加入…'
  const both = !!(n.lobby.hostChar && n.lobby.guestChar)
  const slot = (title: string, char: string | null, pickable: boolean, active: boolean) => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px;opacity:${active ? 1 : 0.55}">
      <div class="sts-body" style="color:#e8d8b8;font-size:15px">${esc(title)}</div>
      ${char
        ? `<img src="${A('hero/' + char + '.png')}" style="width:190px;height:133px;object-fit:contain;border-radius:12px;border:3px solid ${CHAR_COLOR[char]};background:radial-gradient(ellipse at 50% 70%,rgba(40,26,14,.9),rgba(10,6,4,.95))">`
        : `<div class="sts-body" style="width:190px;height:133px;border-radius:12px;border:3px dashed #5a4230;display:flex;align-items:center;justify-content:center;color:#8a7458;font-size:14px">${active ? '选择角色' : '未加入'}</div>`}
      ${pickable ? `<div class="row" style="gap:5px">${CHARACTERS.map(c => `<button data-act="lobbyPick" data-char="${c}" data-tip="${CHARACTER_INFO[c].name}" style="width:25px;height:25px;border-radius:50%;border:2px solid ${char === c ? '#ffd980' : CHAR_COLOR[c]};background:radial-gradient(circle at 40% 35%,${CHAR_COLOR[c]},rgba(10,8,6,.95));cursor:pointer;padding:0"></button>`).join('')}</div>` : ''}
      <div class="sts-title" style="font-size:16px;color:${char ? '#ffd980' : '#8a7458'};letter-spacing:2px">${char ? CHARACTER_INFO[char].name : '？？？'}</div>
    </div>`
  return `<div class="screen bg-cover" style="background-image:url('${A('bg/combat.jpg')}')">
  <div class="shade" style="background:rgba(6,3,2,.64)"></div>
  <div class="center-col" style="padding-top:0;gap:16px">
    <div class="sts-title" style="font-size:30px;color:#ffd980;letter-spacing:6px">合 作 大 厅</div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <div class="sts-body" style="color:#a89070;font-size:13px">房间码（告诉你的好友）</div>
      <div class="sts-title" style="font-size:44px;color:#8ee8ff;letter-spacing:12px;text-shadow:0 0 24px rgba(100,200,255,.5),3px 3px 0 #000">${n.roomCode}</div>
    </div>
    <div class="row" style="gap:52px;align-items:center">
      ${slot(n.myName + '（你）', myChar, true, true)}
      <div class="sts-title" style="font-size:26px;color:#8a7458">VS</div>
      ${slot(otherName, isHost ? n.lobby.guestChar : n.lobby.hostChar, false, n.connected)}
    </div>
    <div class="sts-body" style="color:${n.connected ? '#8ee888' : '#c8a878'};font-size:14px">
      ${!n.connected ? (isHost ? '等待好友加入…（把房间码发给对方）' : '正在连接房间…')
        : both ? (isHost ? '双方已就绪，可以出发！' : '等待房主出发…')
        : (isHost ? '等待双方选择角色…' : '选择你的角色，等待房主出发…')}</div>
    <div class="row" style="gap:22px">
      ${isHost ? `<button class="sts-btn sts-title" data-act="lobbyStart" ${n.connected && both ? '' : 'disabled'} style="font-size:23px;letter-spacing:6px;padding:12px 64px;${n.connected && both ? '' : 'opacity:.4;cursor:not-allowed'}">出 发</button>` : ''}
      <button class="sts-btn sts-body" data-act="mpLeave" style="font-size:15px;padding:8px 24px">离开房间</button>
    </div>
    ${n.error ? `<div class="sts-body" style="color:#ff9a8a;font-size:14px">${esc(n.error)}</div>` : ''}
  </div>
</div>`
}

// ---- 幕间过场 ----
const ACT_NAMES: Record<number, string> = { 2: '第 二 幕 · 城 堡', 3: '第 三 幕 · 尖 峰', 4: '终 章 · 腐 朽 心 脏' }
function rActTransition(run: RunState): string {
  const act = run.nextActInfo || run.act
  return `<div class="screen center-col" style="background:radial-gradient(ellipse at 50% 40%,#1a1208 0%,#0a0603 55%,#030201 100%);cursor:pointer" data-act="continueAct">
  <div class="sts-title" style="font-size:60px;color:#ffd980;letter-spacing:14px;text-shadow:4px 4px 0 #000,0 0 90px rgba(255,190,80,.35);animation:actIn 1.1s ease-out both">${ACT_NAMES[act] || `第 ${act} 幕`}</div>
  <div class="sts-body" style="color:#a89070;font-size:16px;letter-spacing:3px;margin-top:18px">联机模式下全体队员已获得治疗 —— 点击继续</div>
</div>`
}

function rTitle(): string {
  return rMainMenu()
}

// ============ 涅奥祝福（大鲸鱼开局事件） ============
const NEOW_GREETING: Record<string, string> = {
  ironclad: '哦，被放逐的战士', silent: '哦，沉默的猎手',
  defect: '哦，战斗傀儡', watcher: '哦，盲眼的朝圣者',
}
function rNeow(run: RunState): string {
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
  }).join('')
  return `<div class="screen bg-cover" style="background-image:url('${A('bg/map.jpg')}')">
  <div class="shade" style="background:linear-gradient(180deg,rgba(4,4,10,.85),rgba(8,6,14,.6),rgba(4,4,10,.88))"></div>
  <div class="center-col" style="padding-top:8px">
    <img src="${A('neow/neow.png')}" alt="涅奥" draggable="false" style="width:400px;max-width:46vw;object-fit:contain;filter:drop-shadow(0 20px 36px rgba(0,0,0,.9)) drop-shadow(0 0 50px rgba(90,140,255,.25));animation:neowFloat 4s ease-in-out infinite">
    <div class="sts-title" style="font-size:38px;color:#b8d0ff;text-shadow:3px 3px 0 #000,0 0 44px rgba(80,120,255,.5);letter-spacing:8px">涅奥</div>
    <div class="sts-body" style="color:#a8b8d8;font-size:15px;line-height:1.8;max-width:620px;margin:4px 0 14px">巨鲸涅奥在尖塔脚下苏醒。<br>${greeting}</div>
    ${waitBanner}
    <div class="neow-row">${opts}</div>
  </div>
</div>`
}

// ============ 战斗界面（骨架 + 区域更新，按角色/幕数适配） ============
const ENERGY_ORB: Record<string, string> = { ironclad: 'redEnergy', silent: 'greenEnergy', defect: 'blueEnergy', watcher: 'purpleEnergy' }
const STANCE_STYLE: Record<string, { name: string; color: string; desc: string }> = {
  wrath: { name: '怒', color: '#ff8a4a', desc: '造成的攻击伤害翻倍，受到的攻击伤害翻倍。' },
  calm: { name: '静', color: '#5aa8ff', desc: '退出平静姿态时获得 2 点能量。' },
  divinity: { name: '神格', color: '#ffd980', desc: '造成的攻击伤害三倍。回合结束自动退出。' },
}
const ORB_NAME: Record<string, string> = { lightning: '闪电', frost: '冰霜', dark: '暗影', plasma: '等离子' }

function combatBgKey(act: number): string {
  if (act >= 4) return 'bg/combat4.jpg'
  if (act === 3) return 'bg/combat3.jpg'
  if (act === 2) return 'bg/combat2.jpg'
  return 'bg/combat.jpg'
}

function buildCombatScreen(run: RunState): string {
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
  <div class="enemies-row" id="enemies-row"></div>
  <div id="hint-holder"></div>
  <button class="pile-btn" id="pile-draw" data-act="openPile" data-pile="draw" style="left:26px;bottom:158px"><b>0</b><span>抽牌堆</span></button>
  <button class="pile-btn" id="pile-discard" data-act="openPile" data-pile="discard" style="right:26px;bottom:158px"><b>0</b><span>弃牌堆</span></button>
  <span id="exhaust-holder"></span>
  <div class="energy" id="energy-box"><img src="${A('frames/' + (ENERGY_ORB[hero] || 'redEnergy') + '.png')}" alt=""><span id="energy-num"></span></div>
  <button class="sts-btn end-turn sts-title" data-act="endTurn" id="end-turn-btn"></button>
  <div class="hand-row" id="hand-row"></div>
  <div id="banner-holder"></div>
  <div id="card-play-fx"></div>
</div>`
}

function intentHtml(e: EnemyInstance, c: CombatState): string {
  if (!e.intent || e.dying) return ''
  const it = e.intent
  const mp = c.players.length > 1
  const tgtIdx = mp ? (it.targetIdx ?? 0) : 0
  const TP = c.players[tgtIdx] || AP(c)
  const { dmg, times } = enemyDisplayDamage(e, TP.statuses, TP.stance)
  const tgtLabel = mp && it.type.startsWith('attack') ? `<span class="sts-body" style="font-size:12px;font-weight:700;color:${tgtIdx === g().net.myIdx ? '#ff6a50' : '#6ab0ff'};text-shadow:1px 1px 0 #000">▶${tgtIdx === g().net.myIdx ? '你' : '队友'}</span>` : ''
  const map: Record<string, string> = {
    attack: 'attack3', attackDebuff: 'attack5', attackDefend: 'attack4',
    defend: 'defend', buff: 'buff', debuff: 'debuff', strongDebuff: 'debuffStrong',
    sleep: 'sleep', unknown: 'unknown',
  }
  const def = ENEMIES[e.id]
  const isAtk = it.type.startsWith('attack')
  const mvName = def.moves[e.nextMoveIdx]?.name || ''
  return `<div class="intent" data-tip="<b>${esc(mvName)}</b>">
    ${isAtk ? `<img src="${A('intent/' + (map[it.type] || 'unknown') + '.png')}" width="40" height="40">
      <span class="dmg-num sts-num">${dmg}${times > 1 ? `<small>x${times}</small>` : ''}</span>
      ${(it.type === 'attackDebuff' || it.type === 'attackDefend') ? `<img src="${A('intent/' + (it.type === 'attackDebuff' ? 'debuff' : 'defend') + '.png')}" width="28" height="28">` : ''}${tgtLabel}`
    : `<img src="${A('intent/' + (map[it.type] || 'unknown') + '.png')}" width="42" height="42">`}
  </div>`
}

function updateEnemies(run: RunState) {
  const row = document.getElementById('enemies-row')
  if (!row || !run.combat) return
  const c = run.combat
  const targetable = !!g().selectedCardUid || g().selectedPotionIdx !== null
  const seen = new Set<string>()
  for (const e of c.enemies) {
    seen.add(e.uid)
    const def = ENEMIES[e.id]
    const sw = def.boss ? 340 : def.elite ? 260 : 210
    let el = row.querySelector(`[data-euid="${e.uid}"]`) as HTMLElement | null
    if (!el) {
      el = document.createElement('div')
      el.dataset.euid = e.uid
      el.innerHTML = `
        <div class="intent-slot"></div>
        <div class="sprite"><img src="${A('enemies/' + def.sprite + '.png')}" alt="" style="width:${sw}px;height:${sw}px"></div>
        <div class="enemy-info">
          <div class="ename">${esc(def.name)}</div>
          ${hpBarShell('', def.boss ? 280 : 170)}
          <div class="estatus" style="margin-top:4px"></div>
        </div>`
      row.appendChild(el)
    }
    // 类与可点击状态
    const cls = `enemy ${e.dying ? 'dying' : ''} ${targetable ? 'targetable' : ''}`
    if (el.className !== cls) el.className = cls
    if (targetable) { el.dataset.act = 'clickEnemy'; el.dataset.uid = e.uid }
    else { delete el.dataset.act; delete el.dataset.uid }
    el.style.minWidth = sw * 0.8 + 'px'
    // 意图 / 血条 / 状态（区域差异更新）
    setHtml(el.querySelector('.intent-slot'), intentHtml(e, c))
    updateHpBar(el.querySelector('.hpbar'), e.hp, e.maxHp, e.block)
    setHtml(el.querySelector('.estatus'), statusRow(e.statuses, 28))
  }
  row.querySelectorAll('[data-euid]').forEach(el => {
    if (!seen.has((el as HTMLElement).dataset.euid!)) el.remove()
  })
}

function updateHand(run: RunState) {
  const row = document.getElementById('hand-row')
  if (!row || !run.combat) return
  const c = run.combat
  const st = g()
  const n = AP(c).hand.length
  const mid = (n - 1) / 2
  const myTurnH = c.players.length === 1 || st.net.myIdx === c.activeIdx
  const playableNow = c.phase === 'player' && !st.busy && !c.combatOver && myTurnH
  const seen = new Set<string>()
  AP(c).hand.forEach((card, i) => {
    seen.add(card.uid)
    let el = row.querySelector(`[data-cuid="${card.uid}"]`) as HTMLElement | null
    if (!el) {
      el = document.createElement('div')
      el.className = 'hand-card'
      el.dataset.cuid = card.uid
      el.innerHTML = `<div class="hand-inner"><div class="sts-card" data-act="clickCard" data-uid="${card.uid}" style="width:168px;height:235px"></div></div>`
      row.appendChild(el)
    }
    const offset = i - mid
    const spread = Math.min(78, 700 / Math.max(n, 1))
    const rot = n > 1 ? (offset / mid) * (n > 5 ? 14 : 8) : 0
    const ty = Math.abs(offset) * Math.min(8, 44 / Math.max(n, 1)) * 0.9
    const tf = `translateX(${offset * spread}px) translateY(${ty}px) rotate(${rot}deg)`
    if ((el as any).__tf !== tf) { (el as any).__tf = tf; el.style.transform = tf }
    el.style.zIndex = String(10 + i)
    const isSel = st.selectedCardUid === card.uid
    const inner = el.firstElementChild as HTMLElement
    const innerCls = 'hand-inner' + (isSel ? ' sel' : '')
    if (inner.className !== innerCls) inner.className = innerCls
    const cardEl = inner.firstElementChild as HTMLElement
    // 卡面内容仅在升级/费用变化时重建（避免图片重载闪动）
    const sig = `${card.id}|${card.upgraded}|${cardCost(card, AP(c).hpLostThisCombat)}`
    if ((cardEl as any).__sig !== sig) {
      (cardEl as any).__sig = sig
      cardEl.innerHTML = cardInner(card, 168)
    }
    const cost = cardCost(card, AP(c).hpLostThisCombat)
    const enough = cost === -1 ? true : AP(c).energy >= Math.max(0, cost)
    const cls = 'sts-card ' + (playableNow && enough ? 'playable' : 'dimmed')
    if (cardEl.className !== cls) cardEl.className = cls
  })
  row.querySelectorAll('[data-cuid]').forEach(el => {
    if (!seen.has((el as HTMLElement).dataset.cuid!)) el.remove()
  })
}

// 姿态徽章 + 宝球行（player-extra 区域差异更新）
function playerExtraHtml(run: RunState, pidx?: number): string {
  const c = run.combat
  if (!c) return ''
  const p = pidx !== undefined ? c.players[pidx] : AP(c)
  const character = pidx !== undefined ? run.players[pidx]?.character : run.character
  let html = ''
  if (character === 'watcher') {
    const stance = p.stance || 'none'
    const mantra = p.mantra || 0
    const st = STANCE_STYLE[stance]
    if (st) {
      html += `<div class="stance-badge sts-title" data-tip="<b style='color:${st.color}'>${st.name}</b><br>${st.desc}" style="background:linear-gradient(180deg,${st.color}33,rgba(10,8,6,.9));border:2px solid ${st.color};color:${st.color}">${st.name}</div>`
    }
    if (mantra > 0) {
      html += `<div class="mantra-badge sts-body" data-tip="<b>真言</b><br>积攒12点后进入神格姿态。">真言 ${mantra}/12</div>`
    }
  }
  if (character === 'defect') {
    const orbs = p.orbs || []
    const slots = p.orbSlots ?? 3
    const cells: string[] = []
    for (let i = 0; i < slots; i++) {
      const o = orbs[i]
      if (o) {
        const nm = ORB_NAME[o.type] || o.type
        cells.push(`<span class="orb-cell has" data-tip="<b>${nm}球</b>">${o.type[0].toUpperCase()}</span>`)
      } else {
        cells.push('<span class="orb-cell"></span>')
      }
    }
    html += `<div class="orb-row">${cells.join('')}</div>`
  }
  return html
}

function updateCombatScreen(run: RunState) {
  const c = run.combat
  if (!c) return
  const st = g()
  updateHud(run, true)
  // 背景随幕数切换（键控，避免重复设 url）
  const cs = document.getElementById('combat-screen')
  if (cs) {
    const bg = A(combatBgKey(run.act))
    if ((cs as any).__bg !== bg) { (cs as any).__bg = bg; cs.style.backgroundImage = `url('${bg}')` }
  }
  const mp = c.players.length > 1
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
  setText(document.getElementById('energy-num'), String(AP(c).energy))
  const pd = document.getElementById('pile-draw')
  if (pd) setText(pd.querySelector('b'), String(AP(c).drawPile.length))
  const pc = document.getElementById('pile-discard')
  if (pc) setText(pc.querySelector('b'), String(AP(c).discardPile.length))
  setHtml(document.getElementById('exhaust-holder'), AP(c).exhaustPile.length > 0
    ? `<button class="pile-btn small" data-act="openPile" data-pile="exhaust" style="right:26px;bottom:88px"><b>${AP(c).exhaustPile.length}</b><span>消耗堆</span></button>` : '')
  const et = document.getElementById('end-turn-btn') as HTMLButtonElement | null
  if (et) {
    const mpE = c.players.length > 1
    const myTurnE = !mpE || st.net.myIdx === c.activeIdx
    const dis = c.phase !== 'player' || st.busy || !myTurnE
    et.disabled = dis || c.combatOver
    et.style.opacity = dis ? '0.5' : '1'
    setText(et, c.phase === 'player' ? (mpE && !myTurnE ? '队友回合…' : '结束回合') : '敌方回合…')
  }
  setHtml(document.getElementById('hint-holder'), (st.selectedCardUid || st.selectedPotionIdx !== null)
    ? `<div class="target-hint sts-body">${st.selectedPotionIdx !== null
      ? '选择药水目标（点击敌人，点击空白处取消）'
      : isTouch() ? '点击敌人打出 · 再点一次卡牌确认 · 点空白取消' : '选择目标（点击敌人，点击空白处取消）'}</div>` : '')
  setHtml(document.getElementById('banner-holder'), st.endBanner
    ? `<div class="banner sts-title">${st.endBanner === 'win' ? '战斗胜利！' : '你倒下了…'}</div>` : '')
}

// ============ 地图界面（骨架 + 键控节点/边更新） ============
const NODE_ICON: Record<string, string> = { monster: 'monster', elite: 'elite', event: 'event', shop: 'shop', treasure: 'treasure', rest: 'rest', boss: 'boss' }
const NODE_NAME: Record<string, string> = { monster: '普通敌人', elite: '精英敌人', event: '未知事件', shop: '商店', treasure: '宝箱', rest: '篝火', boss: 'BOSS' }

function buildMapScreen(): string {
  return `<div class="screen">
  ${topHudShell()}
  <div class="map-scroll" id="mapScroll">
    <div class="map-canvas" style="background-image:url('${A('bg/map.jpg')}')">
      <svg id="map-edges"></svg>
      <div id="map-nodes"></div>
      <div class="map-fade"></div>
    </div>
  </div>
</div>`
}

let lastMapScrollNode: string | null | undefined

function updateMapScreen(run: RunState) {
  updateHud(run, false)
  const map = run.map
  const W = 1100, H = 1450
  const reach = run.currentNodeId ? (map.nodes[run.currentNodeId]?.edges ?? []) : map.startNodes

  // 节点（键控：图标图片只在创建时加载一次）
  const holder = document.getElementById('map-nodes')
  if (holder) {
    for (const nd of Object.values(map.nodes)) {
      const size = nd.type === 'boss' ? 96 : nd.type === 'elite' ? 60 : 52
      let el = holder.querySelector(`[data-nid="${nd.id}"]`) as HTMLElement | null
      if (!el) {
        el = document.createElement('div')
        el.dataset.nid = nd.id
        el.innerHTML = `<img src="${A('mapicons/' + NODE_ICON[nd.type] + '.png')}" alt=""><span class="cur-ring" style="display:none"></span>`
        holder.appendChild(el)
      }
      const isCur = run.currentNodeId === nd.id
      const isReach = reach.includes(nd.id)
      const visited = run.visitedNodes.includes(nd.id)
      const cls = `node ${isReach ? 'reach' : ''} ${!isReach && !visited && !isCur ? 'locked' : ''}`
      if (el.className !== cls) el.className = cls
      el.style.left = `calc(${(nd.x / W) * 100}% - ${size / 2}px)`
      el.style.top = `calc(${(nd.y / H) * 100}% - ${size / 2}px)`
      el.style.width = el.style.height = size + 'px'
      el.style.zIndex = isReach || isCur ? '20' : '10'
      el.style.opacity = visited && !isCur ? '0.45' : '1'
      if (isReach) { el.dataset.act = 'chooseNode'; el.dataset.id = nd.id }
      else { delete el.dataset.act }
      el.dataset.tip = `<b>${NODE_NAME[nd.type]}</b>`
      const ring = el.querySelector('.cur-ring') as HTMLElement
      if (ring) ring.style.display = isCur ? '' : 'none'
      const img = el.querySelector('img') as HTMLElement
      if (img) img.style.filter = isCur ? 'drop-shadow(0 0 14px #ffd070) brightness(1.2)' : ''
    }
  }

  // 边（属性级更新）
  const svg = document.getElementById('map-edges')
  if (svg) {
    let i = 0
    for (const nd of Object.values(map.nodes)) {
      for (const toId of nd.edges) {
        const to = map.nodes[toId]
        if (!to) continue
        let line = svg.children[i] as SVGLineElement
        if (!line) { line = document.createElementNS('http://www.w3.org/2000/svg', 'line'); svg.appendChild(line) }
        const visitedEdge = run.visitedNodes.includes(toId) && (run.currentNodeId === nd.id || run.visitedNodes.includes(nd.id))
        const fromCurrent = run.currentNodeId === nd.id
        line.setAttribute('x1', `${(nd.x / W) * 100}%`)
        line.setAttribute('y1', `${(nd.y / H) * 100}%`)
        line.setAttribute('x2', `${(to.x / W) * 100}%`)
        line.setAttribute('y2', `${(to.y / H) * 100}%`)
        line.setAttribute('stroke', visitedEdge ? '#ffd97a' : fromCurrent ? '#f0e6cc' : '#cfc2a4')
        line.setAttribute('stroke-width', visitedEdge ? '6' : '5')
        if (visitedEdge) line.removeAttribute('stroke-dasharray')
        else line.setAttribute('stroke-dasharray', '0.5 13')
        line.setAttribute('stroke-linecap', 'round')
        line.setAttribute('opacity', visitedEdge || fromCurrent ? '0.95' : '0.75')
        i++
      }
    }
    while (svg.children.length > i) svg.lastChild!.remove()
  }

  // 节点变化时自动滚动
  if (lastMapScrollNode !== run.currentNodeId) {
    lastMapScrollNode = run.currentNodeId
    const sc = document.getElementById('mapScroll')
    if (sc) {
      const cur = run.currentNodeId ? map.nodes[run.currentNodeId] : null
      const y = cur ? cur.y : 1380
      const target = Math.max(0, sc.scrollHeight * (y / 1450) - sc.clientHeight * 0.55)
      sc.scrollTo({ top: target, behavior: 'smooth' })
    }
  }
}

// ============ 奖励界面 ============
function buildRewardScreen(): string {
  return `<div class="screen reward-bg">
  <div class="big-title sts-title">战利品</div>
  <div class="reward-list" id="reward-rows"></div>
  <div class="reward-cards-label sts-body" id="reward-label"></div>
  <div class="reward-cards" id="reward-cards"></div>
  <button class="sts-btn sts-title" data-act="proceedReward" id="reward-proceed" style="font-size:22px;margin-top:26px"></button>
</div>`
}

function updateRewardScreen(run: RunState) {
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
  }
  if (r.potion && !r.taken.includes('potion')) {
    rows.push(`<button class="reward-row" data-act="takePotion">${potionHtml(r.potion, 0, false)}<span class="sts-body">${POTIONS[r.potion]?.name}</span><i>点击获取</i></button>`)
  }
  if (r.relic && !r.taken.includes('relic')) {
    rows.push(`<button class="reward-row" data-act="takeRelic">${relicIcon(r.relic, 44)}<span class="sts-body">${RELICS[r.relic]?.name}</span><i>点击获取</i></button>`)
  }
  setHtml(document.getElementById('reward-rows'), rows.join(''))

  // 卡牌（键控：选中状态只改类，不重载图片）
  const holder = document.getElementById('reward-cards')
  const label = document.getElementById('reward-label')
  if (!holder || !label) return
  if (myCards?.length) {
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
}

// ============ 商店界面 ============
function buildShopScreen(): string {
  return `<div class="screen shop-bg">
  <div class="center-col" style="padding:26px 16px;gap:22px">
    <div class="row" style="gap:20px;align-items:center">
      <img src="${A('mapicons/shop.png')}" width="88" height="88" style="filter:drop-shadow(0 0 20px rgba(255,180,80,.4))">
      <div><div class="big-title sts-title" style="font-size:38px">商店</div>
      <div class="sts-body" style="color:#c8b090;font-size:14px">「看看有没有中意的？」</div></div>
      <div class="sts-body" style="color:#ffd980;font-size:20px;margin-left:24px" id="shop-gold"></div>
    </div>
    <div class="row" style="flex-wrap:wrap;justify-content:center;gap:18px" id="shop-cards"></div>
    <div class="row" style="flex-wrap:wrap;justify-content:center;gap:34px;align-items:flex-start">
      <div class="row" style="gap:14px;flex-wrap:wrap" id="shop-relics"></div>
      <div class="row" style="gap:14px;flex-wrap:wrap" id="shop-potions"></div>
    </div>
    <button class="sts-btn sts-btn-gold sts-title" data-act="buyRemoval" id="shop-removal" style="font-size:18px"></button>
    <button class="sts-btn sts-title" data-act="leaveShop" style="font-size:22px">离开商店</button>
  </div>
</div>`
}

function shopPriceTag(sold: boolean, price: number, gold: number): string {
  return sold ? `<span class="price-tag">已售出</span>` : `<span class="price-tag ${gold >= price ? 'ok' : ''}">💰 ${price}</span>`
}

function updateShopScreen(run: RunState) {
  const shop = run.shop
  if (!shop) return
  const stS = g()
  const mpS = run.players.length > 1
  const meS = run.players[mpS ? stS.net.myIdx : 0] || run.players[0]
  setText(document.getElementById('shop-gold'), mpS ? `💰 ${meS.gold}（队友 ${run.players[1 - (mpS ? stS.net.myIdx : 0)]?.gold ?? '-'}）` : `💰 ${run.gold}`)
  // 卡牌（键控）
  const cardsEl = document.getElementById('shop-cards')
  if (cardsEl) {
    shop.cards.forEach((item, i) => {
      let el = cardsEl.querySelector(`[data-sidx="${i}"]`) as HTMLElement | null
      if (!el) {
        el = document.createElement('div')
        el.dataset.sidx = String(i)
        el.dataset.act = 'buyCard'
        el.dataset.idx = String(i)
        el.innerHTML = cardHtml({ uid: 's' + i, id: item.cardId, upgraded: 0 }, 150) + `<span class="shop-price" style="margin-top:6px"></span>`
        cardsEl.appendChild(el)
      }
      el.className = `shop-card ${item.sold ? 'sold' : ''}`
      if (item.sold) delete el.dataset.act
      else el.dataset.act = 'buyCard'
      setHtml(el.querySelector('.shop-price'), shopPriceTag(item.sold, item.price, meS.gold))
    })
  }
  // 遗物
  const relicsEl = document.getElementById('shop-relics')
  if (relicsEl) {
    shop.relics.forEach((item, i) => {
      const def = RELICS[item.relicId]
      let el = relicsEl.querySelector(`[data-ridx="${i}"]`) as HTMLElement | null
      if (!el) {
        el = document.createElement('button')
        el.className = 'sts-panel shop-item'
        el.dataset.ridx = String(i)
        el.dataset.tip = `<b>${esc(def.name)}</b><br>${esc(def.desc)}`
        el.innerHTML = `<img src="${A('relics/' + item.relicId + '.png')}" width="54" height="54">
          <div class="sts-body" style="font-size:13px;color:#f5e5c8">${esc(def.name)}</div><span class="shop-price"></span>`
        relicsEl.appendChild(el)
      }
      el.className = `sts-panel shop-item ${item.sold ? 'sold' : ''}`
      if (item.sold) delete el.dataset.act
      else { el.dataset.act = 'buyRelic'; el.dataset.idx = String(i) }
      setHtml(el.querySelector('.shop-price'), shopPriceTag(item.sold, item.price, meS.gold))
    })
  }
  // 药水
  const potsEl = document.getElementById('shop-potions')
  if (potsEl) {
    shop.potions.forEach((item, i) => {
      const def = POTIONS[item.potionId]
      let el = potsEl.querySelector(`[data-pidx="${i}"]`) as HTMLElement | null
      if (!el) {
        el = document.createElement('button')
        el.className = 'sts-panel shop-item'
        el.dataset.pidx = String(i)
        el.dataset.tip = `<b>${esc(def.name)}</b><br>${esc(def.desc)}`
        el.innerHTML = `<img src="${A('potions/' + item.potionId + '.png')}" width="42" height="48">
          <div class="sts-body" style="font-size:12px;color:#f5e5c8">${esc(def.name)}</div><span class="shop-price"></span>`
        potsEl.appendChild(el)
      }
      el.className = `sts-panel shop-item ${item.sold ? 'sold' : ''}`
      if (item.sold) delete el.dataset.act
      else { el.dataset.act = 'buyPotion'; el.dataset.idx = String(i) }
      setHtml(el.querySelector('.shop-price'), shopPriceTag(item.sold, item.price, meS.gold))
    })
  }
  const rm = document.getElementById('shop-removal') as HTMLButtonElement | null
  if (rm) {
    rm.disabled = shop.removalUsed
    rm.style.opacity = shop.removalUsed ? '0.4' : '1'
    setText(rm, shop.removalUsed ? '移除服务已使用' : `🧹 移除一张牌 —— 💰 ${shop.removalPrice}`)
  }
}

// ============ 简单界面（低频变化，签名重建） ============
function rBossRelic(run: RunState): string {
  const opts = g().bossOptions
  return `<div class="screen reward-bg center-col">
  <div class="big-title sts-title">击败了首领！选择你的战利品</div>
  <div class="boss-relics">${opts.map((id: string) => {
    const def = RELICS[id]
    return `<button class="sts-panel boss-card" data-act="chooseBossRelic" data-id="${id}">
      <img src="${A('relics/' + id + '.png')}" width="84" height="84">
      <div class="sts-title" style="font-size:20px;color:#ffd980">${esc(def.name)}</div>
      <div class="sts-body" style="font-size:14px;color:#d8c8a8;line-height:1.5">${esc(def.desc)}</div>
    </button>`
  }).join('')}</div>
  <button class="sts-btn sts-title" data-act="chooseBossRelic" data-id="">跳过，直达胜利</button>
</div>`
}

function rRest(run: RunState): string {
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
}

function rTreasure(): string {
  return `<div class="screen treasure-bg center-col">
  <div class="big-title sts-title">宝箱</div>
  <button data-act="takeTreasure" style="filter:drop-shadow(0 0 26px rgba(255,200,60,.55))">
    <img src="${A('mapicons/treasure.png')}" width="180" height="180"></button>
  <button class="sts-btn sts-title" data-act="takeTreasure" style="font-size:20px">打开宝箱</button>
</div>`
}

function rEvent(run: RunState): string {
  const ev = EVENTS[run.currentEvent!]
  const msg = g().eventMsg
  return `<div class="screen event-bg center-col">
  <div class="sts-panel event-panel">
    <div class="sts-title" style="font-size:34px;color:#ffd980;text-shadow:2px 2px 0 #000">${esc(ev.name)}</div>
    <div class="sts-body event-desc">${esc(ev.desc)}</div>
    ${msg ? `<div class="sts-body" style="color:#8fe89a">${esc(msg)}</div>` : ''}
    <div class="event-choices">${ev.choices.map((ch: any, i: number) => {
      const meE = run.players[run.players.length > 1 ? g().net.myIdx : 0] || run.players[0]
      const dis = (ch.effect === 'cleric_heal' && meE.gold < 35) || (ch.effect === 'cleric_purify' && meE.gold < 50)
      return `<button class="sts-btn event-btn ${dis ? 'dis' : ''}" data-act="chooseEvent" data-idx="${i}">${esc(ch.text)}</button>`
    }).join('')}</div>
  </div>
</div>`
}

function rGameOver(run: RunState): string {
  const info = run.gameOverInfo!
  return `<div class="screen gameover-bg center-col">
  <div class="sts-title" style="font-size:64px;color:${info.victory ? '#ffd980' : '#c85040'};text-shadow:4px 4px 0 #000">${info.victory ? '登顶成功！' : '你死了'}</div>
  <div class="sts-panel" style="padding:30px;min-width:320px;display:flex;flex-direction:column;gap:12px">
    <div class="srow"><span>到达层数</span><b>${info.floor}</b></div>
    <div class="srow"><span>消灭怪物</span><b>${info.monstersSlain}</b></div>
    <div class="srow"><span>消灭精英</span><b>${info.elitesSlain}</b></div>
    <div class="srow"><span>赚取金币</span><b>${info.goldEarned}</b></div>
  </div>
  <div class="row" style="gap:18px">
    <button class="sts-btn sts-title" data-act="startRun" style="font-size:22px">再来一局</button>
    <button class="sts-btn sts-title" data-act="backTitle" style="font-size:22px">回到主菜单</button>
  </div>
</div>`
}

// ============ 遮罩层（牌堆查看 / 选牌 / 预见） ============
let scryMarked: Set<string> = new Set()

function overlayHtml(st: ReturnType<typeof g>): { html: string; sig: string } {
  const run = st.run
  if (!run) return { html: '', sig: '' }
  if (run.combat && AP(run.combat).pendingScry) {
    // 预见：展示抽牌堆顶 N 张，点击标记弃置
    const n = AP(run.combat).pendingScry!
    const top = AP(run.combat).drawPile.slice(-n)
    const sig = `scry:${n}:${top.map(c => c.uid).join(',')}:${[...scryMarked].join(',')}`
    const cards = top.map((c, i) => `<div class="card-in scry-card ${scryMarked.has(c.uid) ? 'marked' : ''}" style="animation-delay:${Math.min(i, 8) * 0.06}s" data-act="scryToggle" data-uid="${c.uid}">${cardHtml(c, 150)}</div>`).join('')
    return {
      sig,
      html: `<div class="overlay" style="background:rgba(4,2,8,.55)">
        <div style="display:flex;flex-direction:column;align-items:center;gap:16px">
          <div class="sts-title" style="font-size:30px;color:#c8b8f0;text-shadow:2px 2px 0 #000">预见</div>
          <div class="sts-body" style="color:#a898c0;font-size:15px">点击卡牌将其弃置（下回合不会抽到），最多弃 ${n} 张</div>
          <div class="sel-cards" style="max-height:520px">${cards || '<div class="sts-body">抽牌堆已空</div>'}</div>
          <div style="display:flex;align-items:center;gap:18px">
            <div class="sts-body" style="color:#c8a860;font-size:14px">已弃置 ${scryMarked.size} 张</div>
            <button class="sts-btn sts-title" data-act="resolveScry" style="font-size:20px;padding:8px 36px">确认</button>
          </div>
        </div>
      </div>`
    }
  }
  if (st.pileView) {
    const pile = st.pileView
    const titles: Record<string, string> = { draw: '抽牌堆（随机排序）', discard: '弃牌堆', exhaust: '消耗堆', deck: '牌组' }
    let cards: CardInstance[] = []
    if (pile === 'draw') cards = [...(run.combat ? AP(run.combat).drawPile : [])].reverse()
    else if (pile === 'discard') cards = [...(run.combat ? AP(run.combat).discardPile : [])].reverse()
    else if (pile === 'exhaust') cards = [...(run.combat ? AP(run.combat).exhaustPile : [])]
    else cards = run.deck
    const sig = `pile:${pile}:${cards.length}`
    return {
      sig,
      html: `<div class="overlay" data-act="closePile">
        <div class="sts-panel" style="padding:22px;max-width:1440px;max-height:800px;display:flex;flex-direction:column;align-items:center;gap:14px" onclick="event.stopPropagation()">
          <div class="sts-title" style="font-size:24px;color:#ffd980">${titles[pile]} <small style="font-size:15px;color:#a89070">(${cards.length})</small></div>
          <div class="sel-cards" style="max-height:620px">${cards.map(c => cardHtml(c, 128)).join('') || '<div class="sts-body">空空如也</div>'}</div>
          <button class="sts-btn" data-act="closePile">关闭</button>
        </div>
      </div>`
    }
  }
  if (st.select) {
    const sel = st.select
    const ordered: CardInstance[] = sel.source === 'deck' ? run.deck
      : sel.source === 'hand' ? (run.combat ? AP(run.combat).hand : [])
        : (run.combat ? AP(run.combat).discardPile : [])
    const cards = ordered.filter(c => sel.cardUids.includes(c.uid))
    const cancellable = ['eventUpgrade', 'eventRemove', 'sacrifice', 'restSmith', 'shopRemove'].includes(sel.kind)
    const sig = `select:${sel.kind}:${sel.title}:${cards.length}`
    return {
      sig,
      html: `<div class="overlay" style="display:flex;align-items:center;justify-content:center">
        <div style="display:flex;flex-direction:column;align-items:center;gap:18px;max-width:1480px">
          <div class="sts-title" style="font-size:26px;color:#ffd980;text-shadow:2px 2px 0 #000">${esc(sel.title)}</div>
          <div class="sel-cards" style="max-height:640px">${cards.map((c, i) => `<div class="card-in" style="animation-delay:${Math.min(i, 8) * 0.05}s" data-act="resolveSelect" data-uid="${c.uid}">${cardHtml(c, 136, 'playable')}</div>`).join('') || '<div class="sts-body">没有可选择的卡牌</div>'}</div>
          ${cancellable ? `<button class="sts-btn" data-act="cancelSelect">${sel.kind === 'shopRemove' ? '取消购买' : '放弃'}</button>` : ''}
        </div>
      </div>`
    }
  }
  return { html: '', sig: '' }
}

function renderOverlays(st: ReturnType<typeof g>) {
  const layer = document.getElementById('overlay-layer')
  if (!layer) return
  const { html, sig } = overlayHtml(st)
  if ((layer as any).__sig !== sig) {
    (layer as any).__sig = sig
    layer.innerHTML = html
    layer.style.pointerEvents = html ? 'auto' : 'none'
  }
}

// ============ FX 浮动数字层（舞台内坐标 + 受击/震动动画） ============
let fxPositions: Record<string, { x: number; y: number }> = {}
const renderedFx = new Set<number>()

function computeFxPositions() {
  const sr = fxLayer.getBoundingClientRect()
  const k = sr.width / STAGE_W || 1
  fxPositions = {}
  document.querySelectorAll('.enemy[data-euid]').forEach(el => {
    const r = (el as HTMLElement).getBoundingClientRect()
    fxPositions[(el as HTMLElement).dataset.euid!] = { x: (r.left + r.width / 2 - sr.left) / k, y: (r.top + 20 - sr.top) / k }
  })
  const pz = document.querySelector('.player-zone') || document.querySelector('[data-hidx="0"]')
  if (pz) {
    const r = pz.getBoundingClientRect()
    fxPositions['player'] = { x: (r.left + r.width / 2 - sr.left) / k, y: (r.top + 50 - sr.top) / k }
    fxPositions['p0'] = fxPositions['player']
    const pz1 = document.getElementById('player-fx-slot-1')
    if (pz1) {
      const r1 = pz1.getBoundingClientRect()
      fxPositions['p1'] = { x: (r1.left + r1.width / 2 - sr.left) / k, y: (r1.top + 30 - sr.top) / k }
    }
  }
}

function screenShake() {
  const el = document.getElementById('combat-screen')
  el?.animate?.([
    { transform: 'translate(0,0)' },
    { transform: 'translate(-7px,4px)' },
    { transform: 'translate(6px,-5px)' },
    { transform: 'translate(-4px,-2px)' },
    { transform: 'translate(0,0)' },
  ], { duration: 350, easing: 'ease-out' })
}

function enemyFlash(uid: string) {
  const el = document.querySelector(`.enemy[data-euid="${uid}"] .sprite`) as HTMLElement | null
  el?.animate?.([
    { filter: 'brightness(3) saturate(0)' },
    { filter: 'brightness(1) saturate(1)' },
  ], { duration: 350, easing: 'ease-out' })
}

// 敌人突进：向玩家方向冲撞
function enemyLunge(uid: string) {
  const el = document.querySelector(`.enemy[data-euid="${uid}"] .sprite`) as HTMLElement | null
  el?.animate?.([
    { transform: 'translateX(0)' },
    { transform: 'translateX(-120px) scale(1.06)' },
    { transform: 'translateX(0)' },
  ], { duration: 420, easing: 'cubic-bezier(.3,0,.4,1)' })
}

// 出牌动画：卡牌在屏幕中央放大淡出
let lastCardPlayFx = 0
function cardPlayFx(text: string) {
  const holder = document.getElementById('card-play-fx')
  if (!holder) return
  // text 格式：cardId|upgraded
  const [cid, up] = (text || '').split('|')
  const inst: CardInstance = { uid: 'fx_' + Date.now(), id: cid, upgraded: Number(up) || 0 }
  if (!CARDS[cid]) return
  const el = document.createElement('div')
  el.className = 'card-play-fx'
  el.innerHTML = cardHtml(inst, 190)
  holder.appendChild(el)
  const anim = el.animate?.([
    { transform: 'scale(1.25)', opacity: 1 },
    { transform: 'scale(1.35)', opacity: 1, offset: 0.6 },
    { transform: 'scale(1.5)', opacity: 0 },
  ], { duration: 620, easing: 'ease-out' })
  if (anim) anim.onfinish = () => el.remove()
}

// 斩击特效：在目标敌人位置显示白色斩击弧光
function spawnSlash(uid: string) {
  const target = document.querySelector(`.enemy[data-euid="${uid}"] .sprite`) as HTMLElement | null
  const holder = document.getElementById('card-play-fx') || fxLayer
  const pos = fxPositions[uid]
  if (!pos) return
  const el = document.createElement('div')
  el.className = 'slash-fx'
  el.style.left = pos.x + 'px'
  el.style.top = (pos.y + 100) + 'px'
  holder.appendChild(el)
  setTimeout(() => el.remove(), 480)
  void target
}

// 引导宝球特效：能量球光效闪烁
const ORB_FX_COLOR: Record<string, string> = { lightning: '#f0d040', frost: '#7ac0e8', dark: '#9a6ad8', plasma: '#e87ab0' }
function spawnOrbFx(type: string) {
  const pos = fxPositions['player']
  if (!pos) return
  const el = document.createElement('div')
  el.className = 'fx-float'
  const col = ORB_FX_COLOR[type] || '#c0d0ff'
  el.style.cssText = `left:${pos.x + 120}px;top:${pos.y}px;color:${col};font-size:26px`
  el.innerHTML = `${type === 'lightning' ? '⚡' : type === 'frost' ? '❄' : type === 'dark' ? '●' : '✦'} <span style="color:${col}">引导</span>`
  fxLayer.appendChild(el)
  setTimeout(() => el.remove(), 1100)
}

function renderNewFx() {
  const st = g()
  if (st.fxList.length === 0 && renderedFx.size > 0) renderedFx.clear()
  for (const f of st.fxList) {
    if (renderedFx.has(f.id)) continue
    renderedFx.add(f.id)
    // 受击闪白 / 屏幕震动（Web Animations API，不重建 DOM）
    if (f.kind === 'shake') {
      if (f.target === 'player' || f.target === 'p0' || f.target === 'p1') screenShake()
      else enemyFlash(f.target)
    }
    if (f.kind === 'dmg') enemyFlash(f.target)
    if (f.kind === 'lunge') enemyLunge(f.target)
    if (f.kind === 'cardPlay' && f.text) cardPlayFx(f.text)
    if (f.kind === 'slash') spawnSlash(f.target)
    if (f.kind === 'orb') spawnOrbFx(f.text || '')
    const pos = fxPositions[f.target]
    if (!pos) { st.removeFx(f.id); continue }
    const el = document.createElement('div')
    el.className = 'fx-float'
    let color = '#fff', content = '', size = 24
    if (f.kind === 'dmg') { color = '#ff5a4a'; content = String(f.value); size = 38 }
    else if (f.kind === 'heal') { color = '#7fe08a'; content = '+' + f.value }
    else if (f.kind === 'block') { color = '#9ac8f0'; content = '+' + f.value }
    else if (f.kind === 'status') {
      content = `<img src="${A(statusImgKey(f.text || ''))}" width="26" height="26"><span style="color:${(f.value || 0) > 0 ? '#7fe08a' : '#ff8a7a'}">${(f.value || 0) > 0 ? '+' : ''}${f.value}</span>`
    } else if (f.kind === 'text') { color = '#ffe9a0'; content = String(f.text) }
    el.style.cssText = `left:${pos.x}px;top:${pos.y}px;color:${color};font-size:${size}px`
    el.innerHTML = content
    fxLayer.appendChild(el)
    setTimeout(() => { el.remove(); st.removeFx(f.id) }, 1150)
  }
}

// ============ 主渲染（屏幕切换才重建骨架，否则仅区域差异更新） ============
let curScreenKey = ''

function buildScreen(scr: string, run: RunState | null): string {
  if (!run) {
    // 菜单系列界面（无 run 时）
    if (scr === 'charSelect') return rCharSelect()
    if (scr === 'mpLobby') return rMpLobby()
    if (scr === 'stats') return rStats()
    if (scr === 'settings') return rSettings()
    if (scr === 'credits') return rCredits()
    return rMainMenu()
  }
  if (scr === 'actTransition') return rActTransition(run)
  if (scr === 'neow') return rNeow(run)
  if (scr === 'map') return buildMapScreen()
  if (scr === 'combat') return buildCombatScreen(run)
  if (scr === 'reward') return buildRewardScreen()
  if (scr === 'shop') return buildShopScreen()
  return '' // 简单界面由 sigScreen 构建
}

function sigScreen(sig: string, build: () => string) {
  const a = app as any
  if (a.__sig !== sig) { a.__sig = sig; app.innerHTML = build() }
}

function updateScreen(scr: string, run: RunState | null) {
  if (!run) {
    const st0 = g()
    if (scr === 'mpLobby') sigScreen(`lobby:${st0.net.role}:${st0.net.status}:${st0.net.roomCode}:${st0.net.connected}:${st0.net.lobby?.hostChar}:${st0.net.lobby?.guestChar}:${st0.net.peerName}:${st0.net.error ?? ''}`, () => rMpLobby())
    return
  }
  if (scr === 'mpLobby') sigScreen(`lobby:${g().net.role}:${g().net.status}:${g().net.roomCode}:${g().net.connected}:${g().net.lobby?.hostChar}:${g().net.lobby?.guestChar}:${g().net.peerName}:${g().net.error ?? ''}`, () => rMpLobby())
  if (scr === 'combat') updateCombatScreen(run)
  else if (scr === 'map') updateMapScreen(run)
  else if (scr === 'reward') updateRewardScreen(run)
  else if (scr === 'shop') updateShopScreen(run)
  else if (scr === 'neow') sigScreen(`neow:${run.character}:${run.neow?.chosen ?? ''}:${run.neow?.options.map(o => o.id).join(',')}:${run.players.length}:${run.neow?.chooserIdx}:${run.neow?.mpOptions?.map(o => o.map(x => x.id).join('+')).join('|')}`, () => rNeow(run))
  else if (scr === 'actTransition') { /* 骨架已含 data-act=continueAct，自动推进 */ autoAdvanceAct() }
  else if (scr === 'event') sigScreen(`event:${run.currentEvent}:${g().eventMsg}:${run.gold}`, () => rEvent(run))
  else if (scr === 'rest') sigScreen(`rest:${run.hp}:${run.maxHp}:${run.relics.length}:${run.mpRest?.join(',') ?? ''}:${g().net.myIdx}`, () => rRest(run))
  else if (scr === 'treasure') sigScreen('treasure', () => rTreasure())
  else if (scr === 'bossRelic') sigScreen('bossRelic', () => rBossRelic(run))
  else if (scr === 'gameover' || scr === 'victory') sigScreen('gameover', () => rGameOver(run))
}

function render() {
  const st = g()
  const run = st.run
  const scr = run ? run.screen : (st.menuScreen || 'title')
  updateMusic(st)
  if (scr !== curScreenKey) {
    curScreenKey = scr
    ;(app as any).__sig = ''
    app.innerHTML = buildScreen(scr, run)
  }
  updateScreen(scr, run)
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
}

// ============ 事件委托 ============
const ACTIONS: Record<string, (el: HTMLElement) => void> = {
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
  mpSkipCard: () => g().mpSkipCard(),
  pickChar: (el) => {
    const c = el.dataset.char as CharacterId
    if (c && CHARACTER_INFO[c]) {
      selectedChar = c
      sigScreen('title:' + c, () => rTitle())
    }
  },
  chooseNeow: (el) => g().chooseNeow(Number(el.dataset.idx)),
  scryToggle: (el) => {
    const uid = el.dataset.uid!
    if (scryMarked.has(uid)) scryMarked.delete(uid)
    else scryMarked.add(uid)
  },
  resolveScry: () => {
    g().resolveScry([...scryMarked])
    scryMarked = new Set()
  },
  backTitle: () => g().backToTitle(),
  chooseNode: (el) => g().chooseNode(el.dataset.id!),
  clickCard: (el) => g().clickCard(el.dataset.uid!),
  clickEnemy: (el) => g().clickEnemy(el.dataset.uid!),
  endTurn: () => g().endTurn(),
  openPile: (el) => g().openPile(el.dataset.pile as any),
  closePile: () => g().closePile(),
  takeGold: () => g().takeGold(),
  takeCard: (el) => g().takeCard(el.dataset.cid!),
  takePotion: () => g().takePotion(),
  takeRelic: () => g().takeRelic(),
  proceedReward: () => g().proceedFromReward(),
  chooseBossRelic: (el) => g().chooseBossRelic(el.dataset.id || null),
  buyCard: (el) => g().buyCard(Number(el.dataset.idx)),
  buyRelic: (el) => g().buyRelic(Number(el.dataset.idx)),
  buyPotion: (el) => g().buyPotion(Number(el.dataset.idx)),
  buyRemoval: () => g().buyRemoval(),
  leaveShop: () => g().leaveShop(),
  rest: (el) => g().restAction(el.dataset.r as any),
  chooseEvent: (el) => g().chooseEvent(Number(el.dataset.idx)),
  takeTreasure: () => g().takeTreasure(),
  resolveSelect: (el) => g().resolveSelect(el.dataset.uid!),
  cancelSelect: () => g().cancelSelect(),
  potion: (el) => {
    const st = g()
    const idx = Number(el.dataset.idx)
    const pid = st.run?.potions[idx]
    if (!pid) return
    // 非战斗场景（地图）：直接使用；战斗中：先选中再点目标（防误触）
    if (!st.run?.combat) { g().usePotionMap(idx); return }
    useGame.setState({ selectedPotionIdx: st.selectedPotionIdx === idx ? null : idx })
  },
  potionDiscard: (el) => g().discardPotion(Number(el.dataset.idx)),
}

document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null
  if (el && el.dataset.act && ACTIONS[el.dataset.act]) {
    e.stopPropagation()
    ACTIONS[el.dataset.act](el)
    return
  }
  // 点击战斗背景取消选择
  if ((e.target as HTMLElement).closest('[data-bg]')) {
    const st = g()
    if (st.selectedCardUid || st.selectedPotionIdx !== null) g().cancelSelection()
  }
})

// ============ 悬浮提示（鼠标 + 触屏） ============
const tipEl = document.createElement('div')
tipEl.className = 'tooltip sts-body'
document.body.appendChild(tipEl)
let tipTimer: ReturnType<typeof setTimeout> | null = null

document.addEventListener('mouseover', (e) => {
  const el = (e.target as HTMLElement).closest('[data-tip]') as HTMLElement | null
  if (el) {
    tipEl.innerHTML = el.dataset.tip!
    tipEl.style.display = 'block'
  } else {
    tipEl.style.display = 'none'
  }
})
document.addEventListener('mousemove', (e) => {
  if (tipEl.style.display === 'block') {
    const pad = 14
    let x = e.clientX + pad, y = e.clientY + pad
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight
    if (x + w > innerWidth - 8) x = e.clientX - w - pad
    if (y + h > innerHeight - 8) y = e.clientY - h - pad
    tipEl.style.left = x + 'px'
    tipEl.style.top = y + 'px'
  }
})
// 触屏：轻点显示提示 2 秒
document.addEventListener('touchstart', (e) => {
  const el = (e.target as HTMLElement).closest('[data-tip]') as HTMLElement | null
  if (!el) return
  tipEl.innerHTML = el.dataset.tip!
  tipEl.style.display = 'block'
  tipEl.style.left = '0px'
  tipEl.style.top = '0px'
  requestAnimationFrame(() => {
    const r = el.getBoundingClientRect()
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight
    tipEl.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px'
    tipEl.style.top = Math.max(8, r.top - h - 10) + 'px'
  })
  if (tipTimer) clearTimeout(tipTimer)
  tipTimer = setTimeout(() => { tipEl.style.display = 'none' }, 2000)
}, { passive: true })

// ============ 控制簇（音乐 + 全屏，舞台右上角） ============
function setupControls() {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'position:absolute;top:10px;right:10px;z-index:500;display:flex;gap:6px;align-items:center'

  // 齿轮菜单按钮（游戏内）
  const gearBtn = document.createElement('button')
  gearBtn.className = 'sts-btn'
  gearBtn.style.cssText = 'font-size:15px;padding:4px 10px;min-width:38px'
  gearBtn.textContent = '⚙'
  gearBtn.title = '菜单 (Esc)'
  gearBtn.addEventListener('click', () => {
    const st = g()
    if (st.run) st.toggleMenu(true)
  })
  wrap.appendChild(gearBtn)

  // 全屏按钮
  const fsBtn = document.createElement('button')
  fsBtn.className = 'sts-btn'
  fsBtn.style.cssText = 'font-size:16px;padding:4px 10px;min-width:38px'
  fsBtn.textContent = '⛶'
  fsBtn.title = '全屏'
  if (document.documentElement.requestFullscreen) {
    fsBtn.addEventListener('click', async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen()
          const so = (screen as any).orientation
          so?.lock?.('landscape')?.catch(() => { })
        } else {
          await document.exitFullscreen()
        }
      } catch { /* 不支持时忽略 */ }
    })
  } else fsBtn.style.display = 'none'
  wrap.appendChild(fsBtn)

  // 音乐按钮
  const btn = document.createElement('button')
  btn.className = 'sts-btn'
  btn.style.cssText = 'font-size:15px;padding:4px 10px;min-width:38px'
  btn.textContent = music.muted || music.volume === 0 ? '🔇' : '🎵'
  btn.title = '音乐音量'
  const panel = document.createElement('div')
  panel.style.cssText = 'position:absolute;right:48px;top:0;display:none;align-items:center;gap:8px;background:rgba(12,8,5,.92);border:1px solid #6b4a2e;border-radius:8px;padding:8px 12px;box-shadow:0 4px 16px rgba(0,0,0,.6)'
  const slider = document.createElement('input')
  slider.type = 'range'; slider.min = '0'; slider.max = '1'; slider.step = '0.05'; slider.value = String(music.volume)
  slider.style.cssText = 'width:110px;accent-color:#c8a060'
  const vlabel = document.createElement('span')
  vlabel.className = 'sts-body'
  vlabel.style.cssText = 'color:#d8c8a8;font-size:12px;width:30px'
  vlabel.textContent = String(music.muted ? 0 : Math.round(music.volume * 100))
  const muteBtn = document.createElement('button')
  muteBtn.className = 'sts-btn'
  muteBtn.style.cssText = 'font-size:15px;padding:4px 10px;min-width:38px'
  muteBtn.textContent = music.muted ? '🔇' : '🔊'
  muteBtn.title = '静音'
  panel.appendChild(slider); panel.appendChild(vlabel); panel.appendChild(muteBtn)
  wrap.appendChild(btn); wrap.appendChild(panel)
  stageEl.appendChild(wrap)
  btn.addEventListener('click', () => {
    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none'
  })
  slider.addEventListener('input', () => {
    const v = Number(slider.value)
    music.setVolume(v)
    vlabel.textContent = String(Math.round(v * 100))
    if (v > 0 && music.muted) { music.setMuted(false); muteBtn.textContent = '🔊' }
    btn.textContent = v === 0 ? '🔇' : '🎵'
  })
  muteBtn.addEventListener('click', () => {
    music.setMuted(!music.muted)
    muteBtn.textContent = music.muted ? '🔇' : '🔊'
    btn.textContent = music.muted ? '🔇' : '🎵'
    vlabel.textContent = String(music.muted ? 0 : Math.round(music.volume * 100))
  })
}

// ============ 输入框事件（昵称/房间码/音量） ============
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
console.log('[STS standalone] 游戏就绪 v1.4（单人 + 联机合作）')



