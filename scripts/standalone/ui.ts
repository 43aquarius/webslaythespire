// ============ 单文件版 UI（原生 JS，区域化渲染修复闪动） ============
// 架构：1600×900 舞台等比缩放 + 屏幕切换时构建骨架 + 状态更新时仅差异更新区域
// 修复：innerHTML 全量重建导致的画面闪动；补上选牌/牌堆遮罩渲染
import { useGame } from '@/store/gameStore'
import { CARDS, cardCost, cardDesc, cardDescParts, cardValues, cardColor } from '@/game/cards'
import { ENEMIES } from '@/game/enemies'
import { RELICS } from '@/game/relics'
import { POTIONS } from '@/game/potions'
import { POTION_LAYERS, POTION_PLACEHOLDER_COLOR, potionLayerKey, POTION_PLACEHOLDER_KEY } from '@/game/potionLayers'
import { enemyDisplayDamage, AP } from '@/game/engine'
import { EVENTS } from '@/game/events'
import { CHARACTER_INFO } from '@/game/run'
import { STATUS_INFO, STATUS_IMG_FIX, statusImgPath } from '@/game/statusInfo'
import { hasSave, loadStats, loadSettings, savePlayerName } from '@/game/persist'
import { net, getServerUrl, setServerUrl, netMode, setNetMode, OFFICIAL_SERVER } from '@/game/net'
import { sfx } from '@/game/sfx'
import type { RoomInfo } from '@/game/net'
import type { CharacterId } from '@/game/types'
import type { RunState, CombatState, CardInstance, EnemyInstance } from '@/game/types'

// 单文件版 SFX 解析：ASSETS['audio/sfx/{name}.ogg']（make_assets 递归内联）
sfx.resolver = (name: string) => ASSETS[`audio/sfx/${name}.ogg`] || ''

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

// ============ 舞台（1600×900 等比缩放，不拦截竖屏；支持 180 度翻转） ============
const STAGE_W = 1600, STAGE_H = 900
let stageEl: HTMLElement
let fxLayer: HTMLElement
let stageFlipped = false          // 180 度翻转状态（localStorage 持久化）
const app = document.getElementById('app')!

function loadFlip(): boolean {
  try { return localStorage.getItem('stsFlip180') === '1' } catch { return false }
}
function saveFlip(v: boolean) {
  try { v ? localStorage.setItem('stsFlip180', '1') : localStorage.removeItem('stsFlip180') } catch { /* noop */ }
}

function fitStage() {
  const k = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H)
  stageEl.style.transform = `translate(-50%, -50%) scale(${k})${stageFlipped ? ' rotate(180deg)' : ''}`
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
  stageEl = stage
  fxLayer = fx
  stageFlipped = loadFlip()
  fitStage()
  window.addEventListener('resize', fitStage)
  window.addEventListener('orientationchange', () => {
    // 部分安卓浏览器尺寸延迟更新：多次重测
    setTimeout(fitStage, 100); setTimeout(fitStage, 350); setTimeout(fitStage, 800)
  })
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitStage)
  // 预加载关键背景，避免首次切屏白闪
  for (const k of ['bg/combat1.jpg', 'bg/combat2.jpg', 'bg/combat3.jpg', 'bg/combat4.jpg', 'bg/map.jpg', 'bg/menubg.jpg', 'bg/campfire1.jpg', 'bg/event1.jpg']) { const img = new Image(); img.src = A(k) }
}

// 尝试切换到指定方向（全屏 + orientation.lock；iOS 不支持时静默失败）
async function tryOrient(lock: 'landscape' | 'portrait') {
  try {
    const d = document as any
    if (!d.fullscreenElement) await d.documentElement.requestFullscreen().catch(() => { })
    const so = (screen as any).orientation
    await so?.lock?.(lock)?.catch(() => { })
  } catch { /* iOS 不支持，静默 */ }
}

// ============ BGM 引擎（曲目映射自原版反编译源码 MainMusic/TempMusic：各幕专属曲） ============
type TrackKey = 'menu' | 'level' | 'level2' | 'level3' | 'act4' | 'elite' | 'boss' | 'boss2' | 'boss3' | 'boss4' | 'merchant' | 'shrine' | 'credits' | 'victory' | 'death'
const MUSIC_SRC: Record<TrackKey, string> = {
  menu: A('audio/menu.ogg'),
  level: A('audio/level.ogg'),
  level2: A('audio/level2.ogg'),
  level3: A('audio/level3.ogg'),
  act4: A('audio/act4.ogg'),
  elite: A('audio/elite.ogg'),
  boss: A('audio/boss.ogg'),
  boss2: A('audio/boss2.ogg'),
  boss3: A('audio/boss3.ogg'),
  boss4: A('audio/boss4.ogg'),
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
  // 原版 MainMusic：按幕选 Level 曲；TempMusic：按幕选 Boss 曲
  const act = run.act || 1
  const levelKey: TrackKey = act >= 4 ? 'act4' : act === 3 ? 'level3' : act === 2 ? 'level2' : 'level'
  const bossKey: TrackKey = act >= 4 ? 'boss4' : act === 3 ? 'boss3' : act === 2 ? 'boss2' : 'boss'
  let key: TrackKey = levelKey
  if (scr === 'neow') key = 'shrine'
  else if (scr === 'shop') key = 'merchant'
  else if (scr === 'event') key = 'shrine'
  else if (scr === 'bossRelic') key = 'credits'
  else if (scr === 'combat') {
    const c = run.combat
    key = c?.isBoss ? bossKey : c?.isElite ? 'elite' : levelKey
  }
  music.play(key)
  // 进入地图/商店：原版 MapOpen / 离开商店 RugClose
  if (scr === 'map' && lastScreenForSfx !== 'map') sfx.play('mapOpen')
  if (lastScreenForSfx === 'shop' && scr !== 'shop') sfx.play('shopClose')
  lastScreenForSfx = scr
}
let lastScreenForSfx = ''

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
// 原版类型文案（ZHS ui.json SingleCardViewPopup.TEXT[0..2]）；类型行改纯文字渲染（原版 renderType 无图标）
const TYPE_NAME: Record<string, string> = { attack: '攻击', skill: '技能', power: '能力' }

// 卡面内容（不含外层 .sts-card 包装，供手牌做差异更新）
// 错位修复：所有 512 画布图层（背景/艺术图/边框/横幅/宝珠）渲染在唯一 .cbox 内
// （inset:0 完全同矩形）；艺术图已离线烘焙为 512 画布图（原版肖像窗口
// x:131 y:99 250×190），不再需要 CSS 定位 —— 任何缩放/旋转下边框与内容永不错位
// 文字层以 512 画布百分比定位（style.css 的 .card-name 等静态百分比）

function cardInner(card: CardInstance, width = 148, opts?: { unaffordable?: boolean; combatCtx?: { strength?: number; weak?: boolean } }): string {
  const def = CARDS[card.id]
  if (!def) return ''
  const rar = raritySuffix(def.rarity)
  const color = cardColor(card.id)
  const cost = cardCost(card, 0)
  const up = card.upgraded > 0
  // 费用配色（原版 GetCostTextColorInHand）：付不起红/免费减费绿
  const baseCost = (up && def.upCost !== undefined) ? def.upCost : def.cost
  const costFree = card.freeThisTurn || (cost >= 0 && baseCost >= 0 && cost < baseCost)
  const costColor = opts?.unaffordable ? '#ff5555' : costFree ? '#7fff00' : '#fff'
  const costShadow = opts?.unaffordable ? '1px 1px 0 #501717,0 0 8px #2a0808' : costFree ? '1px 1px 0 #1f5923,0 0 8px #0d2a10' : '1px 1px 0 #000,0 0 8px #a02010'
  // 攻击牌伤害随力量/虚弱实时变色（升绿降红）
  let descHtml = ''
  if (def.type === 'attack' && opts?.combatCtx) {
    const cc = opts.combatCtx
    const strMult = card.id === 'heavyBlade' ? (cardValues(card)[1] ?? 2) : 1
    const segs = cardDescParts(card, undefined, (idx, base) => {
      if (idx !== 0) return null
      let eff = base + Math.floor((cc.strength || 0) * strMult)
      if (cc.weak) eff = Math.floor(eff * 0.75)
      eff = Math.max(0, eff)
      if (eff === base) return null
      return { v: eff, color: eff > base ? '#7fff00' : '#ff5555' }
    })
    descHtml = segs.map(s => s.c ? `<span style="color:${s.c};font-weight:700">${esc(s.t)}</span>` : esc(s.t)).join('')
  } else {
    descHtml = esc(cardDesc(card))
  }
  const bg = (COLOR_FRAME_BG[color] || COLOR_FRAME_BG.red)[def.type]
  const orb = COLOR_ORB[color] || 'cardRedOrb'
  return `<div class="cbox"><img class="clayer" src="${A(bg)}" alt="">
  <img class="clayer" src="${A('cardart/' + card.id + '.webp')}" alt="">
  <img class="clayer" src="${A('frames/frame' + def.type[0].toUpperCase() + def.type.slice(1) + rar + '.png')}" alt="">
  <img class="clayer" src="${A('frames/banner' + rar + '.png')}" alt="">
  <div class="sts-title card-name" style="font-size:${width * 0.088}px;color:${up ? '#7fff00' : rar === 'Rare' ? '#ffd98a' : '#ffe9c4'};${up ? 'text-shadow:1px 1px 0 #1b6131,0 0 6px rgba(10,50,20,.9)' : ''}">${esc(def.name)}</div>
  ${cost !== -99 ? `<img class="clayer" src="${A('frames/' + orb + '.png')}" alt="">
  <div class="sts-title card-cost" style="font-size:${width * 0.115}px;color:${costColor};text-shadow:${costShadow}">${cost === -1 ? 'X' : cost}</div>` : ''}
  <div class="card-type-row"><span class="sts-body" style="font-size:${width * 0.057}px">${TYPE_NAME[def.type] || def.type}</span></div>
  <div class="sts-body card-desc" style="font-size:${width * 0.076}px">${up ? '<span style="color:#7fe08a">+ </span>' : ''}${descHtml}</div>
  ${up ? '<div class="sts-title card-up">✦</div>' : ''}</div>`
}

function cardHtml(card: CardInstance, width = 148, extra = ''): string {
  const def = CARDS[card.id]
  if (!def) return ''
  const W = Math.round(width)
  const H = Math.round(width * 1.4003)
  return `<div class="sts-card ${extra}" style="width:${W}px;height:${H}px">${cardInner(card, width)}</div>`
}

// ============ 状态图标行（flashIds：本次新获得/层数增加的状态 → 图标闪光，原版 NPower PowerFlash） ============
function statusRow(statuses: Record<string, number>, size = 26, flashIds?: Set<string>): string {
  const entries = Object.entries(statuses).filter(([, v]) => v !== 0)
  if (!entries.length) return ''
  return `<div class="status-row">${entries.map(([id, n]) => {
    const info = STATUS_INFO[id]
    return `<span class="status-badge${flashIds?.has(id) ? ' power-flash' : ''}" data-tip="<b>${esc(info?.name ?? id)}</b><br>${esc(info?.desc ?? '')}" style="width:${size}px;height:${size}px">
      <img src="${A(statusImgKey(id))}" alt="">
      ${(n !== 1 || ['vulnerable', 'weak', 'frail', 'noDraw'].includes(id)) ? `<i style="font-size:${size * 0.42}px">${n}</i>` : ''}
    </span>`
  }).join('')}</div>`
}

// 计算相比上次快照新增/增加的状态（存于容器 dataset）
function statusFlashIds(holder: HTMLElement | null, statuses: Record<string, number>): Set<string> | undefined {
  if (!holder) return undefined
  let prev: Record<string, number> = {}
  try { prev = JSON.parse(holder.dataset.statuses || '{}') } catch { /* ignore */ }
  const flash = new Set<string>()
  for (const [id, v] of Object.entries(statuses)) {
    if (v !== 0 && (!(id in prev) || v > (prev[id] ?? 0))) flash.add(id)
  }
  holder.dataset.statuses = JSON.stringify(statuses)
  return flash.size ? flash : undefined
}

// ============ 血条（结构固定 + 平滑更新；含原版伤害滞后段+毒预览） ============
function hpBarShell(id: string, width: number): string {
  return `<div class="hpbar" ${id ? `id="${id}"` : ''} style="width:${width}px">
    <div class="hpbar-outer" style="height:22px">
      <div class="hpbar-lag" style="width:100%"></div>
      <div class="hpbar-fill" style="width:100%"></div>
      <div class="hpbar-poison" style="display:none"></div>
      <span class="hp-text"></span>
      <span class="block-badge" style="display:none"><img src="${A('status/block.png')}" alt=""><i></i></span>
    </div>
  </div>`
}
function updateHpBar(el: HTMLElement | null, hp: number, maxHp: number, block?: number, poisonNext = 0) {
  if (!el) return
  const pct = Math.max(0, Math.min(100, hp / maxHp * 100))
  const fill = el.querySelector('.hpbar-fill') as HTMLElement
  if (fill) fill.style.width = pct + '%'
  const lag = el.querySelector('.hpbar-lag') as HTMLElement
  if (lag) lag.style.width = pct + '%'   // CSS transition 产生原版延迟收缩的米白残条
  // 有格挡时血条变蓝（原版：填充蓝 rgb(59,111,163) + 浅蓝外框 + 数字深蓝描边）
  const blocked = (block ?? 0) > 0
  const outer = el.querySelector('.hpbar-outer') as HTMLElement
  if (outer) outer.style.boxShadow = blocked ? '0 0 0 2px rgba(178,224,255,0.85), 0 0 10px rgba(120,190,255,0.5)' : ''
  if (fill) fill.style.background = blocked ? 'linear-gradient(to bottom, #7d9fd4 0%, #3b6fa3 55%, #2c5480 100%)' : ''
  // 格挡破碎：block 从 >0 变 0 时盾牌两半飞散（原版 NBlockBrokenVfx）
  const prevB = Number(el.dataset.block || 0)
  if (prevB > 0 && (block ?? 0) === 0 && hp > 0) spawnBlockBreak(el)
  el.dataset.block = String(block ?? 0)
  const poisonLethal = poisonNext > 0 && poisonNext >= hp && hp > 0
  const pz = el.querySelector('.hpbar-poison') as HTMLElement
  if (pz) {
    if (poisonNext > 0 && !poisonLethal) {
      const ppct = Math.max(0, Math.min(pct, poisonNext / maxHp * 100))
      pz.style.display = ''
      pz.style.left = pct + '%'
      pz.style.width = ppct + '%'
    } else pz.style.display = 'none'
  }
  const txt = el.querySelector('.hp-text') as HTMLElement
  if (txt) {
    txt.style.color = poisonLethal ? '#7dff8a' : ''
    txt.style.textShadow = blocked ? '1px 1px 0 #1B3045' : ''
  }
  setText(txt, `${hp} / ${maxHp}`)
  const bb = el.querySelector('.block-badge') as HTMLElement
  if (bb) {
    if (block !== undefined && block > 0) {
      bb.style.display = ''
      setText(bb.querySelector('i'), String(block))
    } else bb.style.display = 'none'
  }
}

// 遗物图标（flash：获得闪光，原版 NRelicFlashVfx：三份叠加副本 α0.627、间隔0.2s、0.75→1.25 放大1s、1.5s 淡出）
let seenRelics = new Set<string>()
const relicFlashUntil: Record<string, number> = {}
function relicIcon(id: string, size = 34, flash = false): string {
  const def = RELICS[id]
  if (!def) return ''
  return `<span class="relic${flash ? ' has-burst' : ''}" data-tip="<b>${esc(def.name)}</b><br><span style='color:#d8c8a8'>${esc(def.desc)}</span>" style="width:${size}px;height:${size}px;position:relative">
    <img src="${A('relics/' + id + '.png')}" alt="">
    ${flash ? [0, 1, 2].map(k => `<img class="relic-burst" src="${A('relics/' + id + '.png')}" alt="" style="animation-delay:${k * 0.2}s">`).join('') : ''}
  </span>`
}

// ============ 原版药水分层渲染（第二十一批：复刻 AbstractPotion.render 层序） ============
// liquid(纯色mask着色) → hybrid(可选) → spots(可选) → glass(白，原图)；空槽 = 占位剪影 @ 白75%
function potionLayersHtml(pid: string | null, w?: number, h?: number): string {
  const size = w && h ? `width:${w}px;height:${h}px;` : 'width:100%;height:100%;'
  if (!pid) {
    return `<span class="pot-layers" data-pot="empty" style="position:relative;display:inline-block;${size}"><i class="pot-layer" data-layer="placeholder" style="position:absolute;inset:0;-webkit-mask:url(${A(POTION_PLACEHOLDER_KEY)}) center/contain no-repeat;mask:url(${A(POTION_PLACEHOLDER_KEY)}) center/contain no-repeat;background:${POTION_PLACEHOLDER_COLOR}"></i></span>`
  }
  const spec = POTION_LAYERS[pid]
  if (!spec) return `<span class="pot-layers" data-pot="${pid}" style="position:relative;display:inline-block;${size}"></span>`
  const L = (layer: string, color: string) => `<i class="pot-layer" data-layer="${layer}" style="position:absolute;inset:0;-webkit-mask:url(${A(potionLayerKey(spec.shape, layer))}) center/contain no-repeat;mask:url(${A(potionLayerKey(spec.shape, layer))}) center/contain no-repeat;background:${color}"></i>`
  return `<span class="pot-layers" data-pot="${pid}" style="position:relative;display:inline-block;${size}">
    ${spec.liquid ? L('liquid', spec.liquid) : ''}${spec.hybrid ? L('hybrid', spec.hybrid) : ''}${spec.spots ? L('spots', spec.spots) : ''}
    <img data-layer="glass" src="${A(potionLayerKey(spec.shape, 'glass'))}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain">
  </span>`
}

function potionHtml(pid: string | null, idx: number, combat: boolean, acquired = false): string {
  const sel = combat && g().selectedPotionIdx === idx
  // 空槽/未知id：原版行为 = 占位剪影（POTION_PLACEHOLDER @ 白75%）
  if (!pid) return `<span class="pslot" style="width:46px;height:53px">${potionLayersHtml(null)}</span>`
  const def = POTIONS[pid]
  // 防御：未知药水 id 渲染为占位槽（与 Next.js 版一致，避免渲染循环崩溃）
  if (!def) return `<span class="pslot" style="width:46px;height:53px">${potionLayersHtml(null)}</span>`
  // 原版 NPotion：hover 弹跳（DoBounce）/ 获得入场（PlayNewlyAcquiredAnimation 0.1s淡入+40px上浮0.35s BackOut）
  return `<span class="pslot has ${sel ? 'sel' : ''} ${acquired ? 'sts-pot-in' : ''}" data-act="potion" data-idx="${idx}" data-tip="<b>${esc(def.name)}</b><br><span style='color:#d8c8a8'>${esc(def.desc)}</span>">
    ${potionLayersHtml(pid)}
    ${combat ? `<i class="pdisc" data-act="potionDiscard" data-idx="${idx}">✕</i>` : ''}
  </span>`
}

// ============ 玩家血量文字（原版：无血条，红色 78/80 样式） ============
function hpNumShell(id: string, size: number): string {
  return `<div class="hp-num" ${id ? `id="${id}"` : ''} style="font-size:${size}px">
    <span class="block-badge hud-block" style="display:none"><img src="${A('status/block.png')}" alt=""><i></i></span>
    <b class="hp-num-val"></b>
    <span class="hp-num-name" style="display:none"></span>
  </div>`
}
function updateHpNum(el: HTMLElement | null, hp: number, maxHp: number, block?: number, name?: string) {
  if (!el) return
  const low = hp > 0 && hp <= maxHp * 0.3
  el.classList.toggle('low', low)
  setText(el.querySelector('.hp-num-val'), `${hp}/${maxHp}`)
  const bb = el.querySelector('.block-badge') as HTMLElement
  if (bb) {
    if (block !== undefined && block > 0) { bb.style.display = ''; setText(bb.querySelector('i'), String(block)) }
    else bb.style.display = 'none'
  }
  const nm = el.querySelector('.hp-num-name') as HTMLElement
  if (nm) {
    if (name) { nm.style.display = ''; setText(nm, name) }
    else nm.style.display = 'none'
  }
}

// ============ 顶部 HUD（参照原版：左上 头像+血量78/80+金币+药水+遗物 / 右上 牌组+层数） ============
// ---- 第六批：HUD 动画模块状态（原版 NTopBarGold 逐级计数 / NTopBarDeckButton 新高弹跳 / NPotion 退场ghost与满带抖动 / ShinePotions 战斗闪耀） ----
let goldAnim = { cur: -1, label: 0, add: 0, running: false }
let deckMaxSeen = 0
let prevPotions: (string | null)[] = []
let lastPotAct: 'use' | 'discard' = 'use'
let lastBeltFailSeen = 0
let combatShineOn = false
let combatShineTimers: ReturnType<typeof setTimeout>[] = []

function topHudShell(): string {
  // 第二十三批：原版 TopPanel 全套复刻 —— bar底板 + 单行(名字/心+HP/钱袋+金币/药水带/层旗/遗物) + 右上deck+settings
  // 保留 id 兼容既有测试：hud-hp/hud-gold/hud-potions/hud-relics/hud-deck-count/hud-floor + .deck-btn/.pots-row
  return `<div class="top-hud">
    <img class="tp-bar" src="${A('topbar/bar.png')}" alt="">
    <div class="tp-row">
      <span class="tp-name" id="hud-name" data-tip=""></span>
      <span id="hud-hp" class="tp-stat">
        <span class="tp-ico"><img src="${A('topbar/hp.png')}" alt="hp"></span>
        <span class="hp-txt">
          <span class="block-badge hud-block" style="display:none"><img src="${A('status/block.png')}" alt=""><i></i></span>
          <b class="hp-num-val"></b>
          <span class="hp-num-name" style="display:none"></span>
        </span>
      </span>
      <span id="hud-gold" class="tp-stat">
        <span class="tp-ico"><img src="${A('topbar/gold.png')}" alt="gold"></span>
        <span class="gold-txt"><span class="gold-val sts-num"></span><span class="gold-mate" style="display:none"></span></span>
      </span>
      <span id="hud-potions" class="tp-pots">
        <img class="tp-potbox" src="${A('topbar/potionbox.png')}" alt="">
        <span class="pots-row"></span>
      </span>
      <span id="hud-floor" class="tp-stat tp-floor" style="display:none" data-tip=""></span>
      <span class="relics hud-relics" id="hud-relics"></span>
    </div>
    <div class="tp-icons">
      <button class="tp-tico deck-btn" data-act="openPile" data-pile="deck" data-tip="<b>查看牌组</b>">
        <img src="${A('topbar/deck.png')}" alt="deck"><i class="tint"></i><i class="tint2"></i>
        <b class="sts-num" id="hud-deck-count"></b>
      </button>
      <button class="tp-tico settings" data-act="toggleMenu" data-tip="<b>设置</b>">
        <img src="${A('topbar/settings.png')}" alt="settings"><i class="tint"></i><i class="tint2"></i>
      </button>
    </div>
    <div id="hud-mp-hp" style="display:none"></div>
  </div>`
}

function updateHud(run: RunState, combat: boolean) {
  const deck = document.getElementById('hud-deck-count')
  if (!deck) return
  const st = g()
  const mp = run.players.length > 1
  const myIdx = mp ? st.net.myIdx : 0
  const me = run.players[myIdx] || run.players[0]
  // 卡组数量新高弹跳（原版 NTopBarDeckButton：新高时 scale 1.5→1，0.5s Expo Out）
  if (me.deck.length > deckMaxSeen) {
    deckMaxSeen = me.deck.length
    deck.animate?.([{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 500, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })
  }
  setText(deck, String(me.deck.length))
  const myBlock = combat && run.combat && run.combat.activeIdx === myIdx ? AP(run.combat).block : 0
  // 名字（白）+ 称号（灰）+ data-tip 玩家名（第二十三批：原版 TopPanel.renderName，角色变化时才重写）
  const nameEl = document.getElementById('hud-name')
  if (nameEl) {
    const cd = CHARACTER_INFO[me.character] || CHARACTER_INFO.ironclad
    const want = `${cd.name}|${cd.nameEn}`
    if (nameEl.dataset.v !== want) {
      nameEl.dataset.v = want
      nameEl.innerHTML = `<b>${esc(cd.name)}</b><i>${esc(cd.nameEn)}</i>`
    }
    nameEl.setAttribute('data-tip', `<b>${esc(me.name)}${mp ? '（你）' : ''}</b>`)
  }
  updateHpNum(document.getElementById('hud-hp'), me.hp, me.maxHp, myBlock)
  // 层旗 + CREAM 数字（原版 renderDungeonInfo：TP_FLOOR + floorNum；战斗中也显示）
  const floorEl = document.getElementById('hud-floor')
  if (floorEl) {
    const fl = run.visitedNodes.length
    const wantF = `${run.act}|${fl}`
    if (floorEl.dataset.v !== wantF) {
      floorEl.dataset.v = wantF
      floorEl.innerHTML = `<span class="tp-ico"><img src="${A('topbar/floor.png')}" alt="floor"></span><b class="floor-val sts-num">${fl}</b>`
    }
    floorEl.style.display = ''
    floorEl.setAttribute('data-tip', `<b>第 ${run.act} 幕 · 第 ${fl} 层</b>`)
  }
  // 金币逐级计数（原版 NTopBarGold）+ 三态色（第二十三批：原版 renderGold ==金/花费中红/获得中绿）
  const goldEl = document.getElementById('hud-gold')
  const goldVal = goldEl?.querySelector('.gold-val') as HTMLElement | null
  const goldMate = goldEl?.querySelector('.gold-mate') as HTMLElement | null
  const paintGold = () => {
    if (!goldEl || !goldVal) return
    // 三态：display(逐级值)==gold → 金 #efc851 / >gold(花费中) → 红 #ff6563 / <gold(获得中) → 绿 #7fff00
    // 注意：用 goldAnim.cur（最新值）而非闭包 me——动画循环跨多次 updateHud，闭包 me 是旧引用（第二十三批修复）
    goldVal.style.color = goldAnim.label === goldAnim.cur ? '#efc851' : goldAnim.label > goldAnim.cur ? '#ff6563' : '#7fff00'
    setText(goldVal, String(goldAnim.label))
    if (goldMate) {
      if (mp) { goldMate.style.display = ''; setText(goldMate, `（队友 ${run.players[1 - myIdx]?.gold ?? '-'}）`) }
      else goldMate.style.display = 'none'
    }
  }
  if (goldAnim.cur < 0) { goldAnim.cur = me.gold; goldAnim.label = me.gold }
  if (me.gold !== goldAnim.cur) {
    goldAnim.add += me.gold - goldAnim.cur
    goldAnim.cur = me.gold
    if (!goldAnim.running) {
      goldAnim.running = true
      ;(async () => {
        await new Promise(r => setTimeout(r, 400))
        while (goldAnim.add !== 0) {
          const a = Math.abs(goldAnim.add), n = a > 100 ? 75 : a > 50 ? 10 : 1
          goldAnim.add = goldAnim.add > 0 ? goldAnim.add - n : goldAnim.add + n
          goldAnim.label = goldAnim.cur - goldAnim.add
          paintGold()
          await new Promise(r => setTimeout(r, Math.trunc(10 + 10 * Math.max(0, 10 - Math.abs(goldAnim.add)))))
        }
        await new Promise(r => setTimeout(r, 250))
        goldAnim.label = goldAnim.cur
        paintGold()
        goldAnim.running = false
      })()
    }
  }
  paintGold()
  // 药水：写入 .pots-row 子容器（保留 tp-potbox 背景框；第二十三批修复：此前 setHtml 整体覆盖将框删掉）
  const potRow = document.getElementById('hud-potions')
  const potSlots = potRow ? potRow.querySelector('.pots-row') as HTMLElement : null
  if (potRow && potSlots) {
    // 药水带背景框动态宽（原版 draw 宽 100+slots×76×scale ≈ 83+N×63）
    const wantW = `${Math.round(83 + me.potions.length * 63)}px`
    if (potRow.style.width !== wantW) potRow.style.width = wantW
    const ghosts: { idx: number; pid: string; kind: 'use' | 'discard' }[] = []
    for (let i = 0; i < prevPotions.length; i++) {
      if (prevPotions[i] && !me.potions[i]) ghosts.push({ idx: i, pid: prevPotions[i]!, kind: lastPotAct })
    }
    setHtml(potSlots, me.potions.map((p, i) => potionHtml(p, i, combat, !!p && !prevPotions[i])).join(''))
    // 药水带满失败抖动（原版 NPotionContainer.PlayAddFailedAnim：3·sin(5t)·sin(t/2) px，t 0→2π，0.5s）
    // 第二十三批：抖动挂 #hud-potions 容器整体（框+槽一起，batch16 断言查容器 getAnimations）
    if (st.potionBeltFail > lastBeltFailSeen) {
      lastBeltFailSeen = st.potionBeltFail
      potRow.animate?.(Array.from({ length: 25 }, (_, i) => {
        const t = (i / 24) * Math.PI * 2
        return { translate: `${3 * Math.sin(5 * t) * Math.sin(t / 2)}px 0` }
      }), { duration: 500 })
    }
    for (const gh of ghosts) {
      const el = document.createElement('span')
      el.className = `pslot has sts-pot-ghost-${gh.kind}`
      el.style.cssText = `width:46px;height:53px;position:absolute;left:${14 + gh.idx * 63}px;top:8px;pointer-events:none;z-index:5`
      el.innerHTML = potionLayersHtml(gh.pid)
      potSlots.appendChild(el)
      setTimeout(() => el.remove(), 500)
    }
    prevPotions = [...me.potions]
  }
  // 战斗开始药水闪耀（原版 OnCombatSetUp→ShinePotions：1s 后有药的槽依次弹跳，0.25s 间隔；DoBounce 12px 0.25s）
  const inCombat = !!run.combat && run.screen === 'combat'
  if (inCombat && !combatShineOn) {
    combatShineOn = true
    const bounce = (k: number) => {
      const row = document.querySelector('#hud-potions .pots-row')
      const slot = row?.children[k] as HTMLElement | null
      slot?.animate?.([
        { transform: 'translateY(0)', easing: 'cubic-bezier(.61,1,.88,1)' },
        { transform: 'translateY(-12px)', easing: 'cubic-bezier(.12,0,.39,0)' },
        { transform: 'translateY(0)' },
      ], { duration: 250 })
    }
    combatShineTimers.forEach(clearTimeout)
    combatShineTimers = []
    combatShineTimers.push(setTimeout(() => {
      let d = 0
      for (let i = 0; i < me.potions.length; i++) {
        if (!me.potions[i]) continue
        const k = i
        combatShineTimers.push(setTimeout(() => bounce(k), d))
        d += 250
      }
    }, 1000))
  } else if (!inCombat && combatShineOn) {
    combatShineOn = false
    combatShineTimers.forEach(clearTimeout)
    combatShineTimers = []
  }
  // 新获遗物闪光（原版三副本叠加爆发；用时间窗而非一次性 diff，避免后续任何状态更新立即移除闪光）
  const relics = me.relics as string[]
  const nowMs = Date.now()
  for (const id of relics) {
    if (!seenRelics.has(id) && seenRelics.size > 0) relicFlashUntil[id] = nowMs + 1900
  }
  setHtml(document.getElementById('hud-relics'), relics.map(id => relicIcon(id, 56, (relicFlashUntil[id] || 0) > nowMs)).join(''))
  seenRelics = new Set(relics)
  // 联机：队友血量（78/80 样式小字，右上角）
  const mini = document.getElementById('hud-mp-hp')
  if (mini) {
    if (mp) {
      mini.style.display = ''
      setHtml(mini, run.players.map((rp, i) => i === myIdx ? '' : `
        <div style="margin-top:3px">${hpNumShell('hud-mp-hp-' + i, 16)}</div>`).join(''))
      run.players.forEach((rp, i) => { if (i !== myIdx) updateHpNum(document.getElementById('hud-mp-hp-' + i), rp.hp, rp.maxHp, undefined, rp.name) })
    } else {
      mini.style.display = 'none'
      setHtml(mini, '')
    }
  }
}

// ============ GitHub 图标（内联 SVG） ============
const GITHUB_SVG = `<svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>`

// ============ 标题（四角色选择 + GitHub 入口） ============
const CHARACTERS: CharacterId[] = ['ironclad', 'silent', 'defect', 'watcher']
const CHAR_COLOR: Record<string, string> = { ironclad: '#b03828', silent: '#3a9a5a', defect: '#3a7ac8', watcher: '#9a5ab8' }
let selectedChar: CharacterId = 'ironclad'

// ---- 主菜单（原版风格：官方Logo + 尖塔主视觉 + 石板按钮） ----
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
  return `<div class="screen">
  <div class="main-menu-bg" style="background-image:url('${A('bg/menubg.jpg')}')"></div>
  <img class="sts-cloud sts-cloud-far" src="${A('title/midCloud13.png')}" draggable="false" alt="">
  <img class="sts-cloud sts-cloud-mid" src="${A('title/topCloud2.png')}" draggable="false" alt="">
  <img class="sts-cloud sts-cloud-near" src="${A('title/mg2.png')}" draggable="false" alt="">
  <div class="main-menu-fog"></div>
  <div class="center-col" style="padding-top:0;gap:14px">
    <img class="menu-logo" src="${A('bg/logo.png')}" alt="Slay the Spire" draggable="false" style="width:286px">
    <div style="display:flex;flex-direction:column;gap:13px;margin-top:22px">
      ${items.map(it => `<button class="menu-btn sts-title ${it.dis ? 'dis' : ''}" data-act="${it.act}" ${it.arg ? `data-screen="${it.arg}"` : ''} ${it.dis ? 'disabled' : ''}
        style="opacity:${it.dis ? 1 : ''}"><span style="opacity:${it.dis ? .45 : 1};display:block">${it.label}</span></button>`).join('')}
    </div>
  </div>
</div>`
}

// ---- 角色选择（原版：无框立绘站立 + 出发/返回） ----
function rCharSelect(): string {
  const info = CHARACTER_INFO[selectedChar]
  const cards = CHARACTERS.map(c => {
    const sel = selectedChar === c
    const col = CHAR_COLOR[c]
    return `<div class="char-card ${sel ? 'sel' : ''}" data-act="pickChar" data-char="${c}" style="${sel ? `transform:translateY(-10px) scale(1.06)` : ''}">
      <img src="${A('hero/' + c + '.png')}" alt="${CHARACTER_INFO[c].name}" draggable="false">
      <div class="sts-title" style="font-size:19px;margin-top:2px;letter-spacing:3px;color:${sel ? '#ffd980' : '#a89070'};text-shadow:2px 2px 0 #000">${CHARACTER_INFO[c].name}</div>
    </div>`
  }).join('')
  return `<div class="screen bg-cover" style="background-image:url('${A('bg/menubg.jpg')}')">
  <div class="shade" style="background:rgba(6,3,2,.5)"></div>
  <div class="center-col" style="padding-top:0;gap:16px">
    <div class="sts-title" style="font-size:36px;color:#ffd980;text-shadow:3px 3px 0 #000;letter-spacing:8px">选 择 你 的 角 色</div>
    <div class="char-row">${cards}</div>
    <div class="sts-body" style="color:#c8b090;font-size:14px;max-width:580px;text-align:center;line-height:1.8">
      <span style="color:#ffd980">${info.name}</span> · ${info.desc}<br>生命值 <span style="color:#ff8a7a">${info.hp}</span> · 初始遗物「<span style="color:#9ad8f0">${RELICS[info.relic]?.name ?? ''}</span>」 · 全 4 幕 · 220+ 卡牌 · 60+ 敌人 · 12 首领</div>
    <div class="row" style="gap:36px;margin-top:6px">
      <button class="sts-btn sts-title" data-act="gotoMenu" data-screen="title" style="font-size:20px;padding:10px 44px;letter-spacing:4px">返 回</button>
      <button class="sts-btn sts-btn-gold sts-title" data-act="startRun" style="font-size:26px;padding:12px 68px;letter-spacing:6px">出 发</button>
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
      <div class="row" style="gap:12px"><span class="sts-body" style="color:#c8b090;width:100px;font-size:15px">音效音量</span>
        <input type="range" data-input="sfxVol" min="0" max="1" step="0.05" value="${sfx.volume}" style="flex:1;accent-color:#c8a060">
        <span class="sts-body" style="color:#d8c8a8;width:36px;font-size:14px" id="sfxvol-label">${Math.round(sfx.volume * 100)}</span></div>
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
      <b style="color:#e8d8b8">开源</b><br>github.com/43aquarius/webslaythespire</div>
    <button class="sts-btn sts-title" data-act="gotoMenu" data-screen="title" style="font-size:20px;padding:10px 60px">返 回</button>
  </div>
</div>`
}

// ---- 联机大厅（房间列表 + 创建/加入，WebSocket 服务器中转） ----
let lobbyRooms: RoomInfo[] = []
let lobbySrvOk: boolean | null = null      // null=检测中
let lobbyShowSrv = false                   // 服务器地址面板
let lobbyWatching = false
let lobbyWatchScreen = ''

/** 房间列表内容（差异更新，不打扰输入框） */
function lobbyRoomsHtml(): string {
  if (!lobbyRooms.length) {
    return `<div class="sts-body" style="color:${lobbySrvOk ? '#8a7458' : '#a87868'};font-size:13px;text-align:center;padding:18px 0">
      ${lobbySrvOk
        ? '暂无开放房间 —— 创建一个，或输入房间码加入好友'
        : '无法连接联机服务器：请检查网络，<br>或点击「服务器」填写地址（填好后点保存），也可改用 P2P 直连'}</div>`
  }
  return lobbyRooms.map(r => `
    <div style="display:flex;align-items:center;gap:12px;background:rgba(0,0,0,.32);border:1px solid #4a3520;border-radius:8px;padding:7px 12px">
      <span class="sts-title" style="font-size:19px;color:#8ee8ff;letter-spacing:5px;width:82px;text-shadow:2px 2px 0 #000">${esc(r.code)}</span>
      <span class="sts-body" style="font-size:14px;color:#e8d8b8;flex:1">${esc(r.host)} 的房间
        <span style="font-size:12px;color:#8a7458;margin-left:8px">${r.guests > 0 ? '2/2' : '1/2'} 人</span></span>
      <span class="sts-body" style="font-size:12px;color:${r.status === 'open' ? '#8ee888' : '#8a7458'}">${r.status === 'open' ? '等待中' : '已满'}</span>
      <button class="sts-btn sts-body" data-act="mpJoinRoom" data-code="${r.code}" ${r.status !== 'open' ? 'disabled' : ''}
        style="font-size:13px;padding:5px 18px;${r.status !== 'open' ? 'opacity:.4' : ''}">加入</button>
    </div>`).join('')
}

function rMpLobby(): string {
  const st = g()
  const n = st.net
  if (!n.role) {
    const s = loadSettings()
    const mode = netMode()
    const modeBtn = (m: 'server' | 'p2p', title: string, desc: string) => `
      <button class="sts-body" data-act="mpMode" data-mode="${m}"
        style="font-size:13px;padding:5px 14px;border-radius:8px;line-height:1.3;cursor:pointer;
        border:1.5px solid ${mode === m ? '#ffd980' : '#6b4a2e'};
        background:${mode === m ? 'rgba(80,56,20,.55)' : 'rgba(0,0,0,.4)'};
        color:${mode === m ? '#ffd980' : '#a89070'}">${title} <span style="font-size:11px;opacity:.75">${desc}</span></button>`
    return `<div class="screen bg-cover" style="background-image:url('${A('bg/combat.jpg')}')">
    <div class="shade" style="background:rgba(6,3,2,.64)"></div>
    <div class="center-col" style="padding-top:0;gap:14px">
      <div class="sts-title" style="font-size:34px;color:#ffd980;letter-spacing:8px">联 机 合 作</div>
      <div class="sts-body" style="color:#c8b090;font-size:14px;line-height:1.8;max-width:520px;text-align:center">
        仿照《杀戮尖塔 2》的合作模式：与好友一起攀登尖塔。<br>共享地图与敌人，各自拥有独立的牌组、生命与能量，轮流行动，共同战斗。</div>
      <div class="row" style="gap:8px"><span class="sts-body" style="color:#a89070;font-size:13px">连接方式</span>
        ${modeBtn('server', '服务器中转', '推荐·支持大厅')}
        ${modeBtn('p2p', 'P2P 直连', '无需服务器')}</div>
      <div class="row" style="gap:10px"><span class="sts-body" style="color:#c8b090;font-size:15px">昵称</span>
        <input class="sts-body" id="mp-name" value="${esc(s.playerName)}" maxlength="10" data-input="mpName"
          style="background:rgba(0,0,0,.5);border:1.5px solid #6b4a2e;border-radius:8px;color:#e8d8b8;padding:8px 12px;font-size:15px;width:170px"></div>
      <button class="sts-btn sts-title" data-act="mpCreate" style="font-size:22px;letter-spacing:4px;padding:10px 66px">创 建 房 间</button>
      ${mode === 'server' ? `
      <div class="sts-panel" style="padding:12px 16px;display:flex;flex-direction:column;gap:8px;width:620px;max-width:92vw">
        <div class="row" style="justify-content:space-between">
          <div class="sts-title" style="font-size:16px;color:#e8d8b8;letter-spacing:3px">房间大厅</div>
          <div class="row" style="gap:8px">
            <span class="sts-body" id="lobby-srv-status" style="font-size:12px;color:#c8a878"></span>
            <button class="sts-btn sts-body" data-act="mpRefresh" style="font-size:12px;padding:3px 12px">刷新</button>
            <button class="sts-btn sts-body" data-act="mpSrvToggle" style="font-size:12px;padding:3px 12px">服务器</button>
          </div>
        </div>
        ${lobbyShowSrv ? `<div class="row" style="gap:8px;background:rgba(0,0,0,.3);border-radius:8px;padding:8px 10px">
          <span class="sts-body" style="font-size:12px;color:#a89070;white-space:nowrap">服务器地址</span>
          <input class="sts-body" data-input="mpSrv" placeholder="${OFFICIAL_SERVER}" value="${esc(getServerUrl())}"
            style="flex:1;background:rgba(0,0,0,.5);border:1px solid #6b4a2e;border-radius:6px;color:#e8d8b8;padding:5px 8px;font-size:12px">
          <button class="sts-btn sts-body" data-act="mpSrvSave" style="font-size:12px;padding:4px 12px">保存</button>
        </div>` : ''}
        <div id="lobby-rooms" style="display:flex;flex-direction:column;gap:6px;max-height:170px;overflow-y:auto;overflow-x:hidden"></div>
        <div class="row" style="gap:8px;justify-content:center;border-top:1px solid rgba(90,64,32,.6);padding-top:8px">
          <span class="sts-body" style="font-size:13px;color:#a89070">房间码加入</span>
          <input class="sts-body" id="mp-code" placeholder="房间码" maxlength="6" data-input="mpCode"
            style="background:rgba(0,0,0,.5);border:1.5px solid #6b4a2e;border-radius:8px;color:#e8d8b8;padding:6px 10px;font-size:16px;width:130px;letter-spacing:3px;text-align:center;text-transform:uppercase">
          <button class="sts-btn sts-body" data-act="mpJoin" style="font-size:13px;padding:6px 16px">加入房间</button>
        </div>
      </div>` : `
      <div class="sts-panel" style="padding:14px 20px;display:flex;flex-direction:column;align-items:center;gap:10px;width:620px;max-width:92vw">
        <div class="sts-body" style="color:#c8b090;font-size:14px;line-height:1.9;text-align:center">
          P2P 直连模式：通过 WebRTC 与好友直接连接，<b style="color:#ffd980">无需服务器</b>。<br>
          创建房间后把 4 位房间码告诉好友，好友输入房间码即可加入。<br>
          <span style="color:#8a7458;font-size:13px">提示：P2P 模式无大厅房间列表；部分网络环境可能无法打洞，建议优先使用服务器中转。</span></div>
        <div class="row" style="gap:8px;border-top:1px solid rgba(90,64,32,.6);padding-top:8px">
          <span class="sts-body" style="font-size:13px;color:#a89070">房间码加入</span>
          <input class="sts-body" id="mp-code" placeholder="房间码" maxlength="6" data-input="mpCode"
            style="background:rgba(0,0,0,.5);border:1.5px solid #6b4a2e;border-radius:8px;color:#e8d8b8;padding:6px 10px;font-size:16px;width:130px;letter-spacing:3px;text-align:center;text-transform:uppercase">
          <button class="sts-btn sts-body" data-act="mpJoin" style="font-size:13px;padding:6px 16px">加入房间</button>
        </div>
      </div>`}
      <button class="sts-btn sts-body" data-act="gotoMenu" data-screen="title" style="font-size:15px;padding:6px 28px">返回主菜单</button>
      ${n.error ? `<div class="sts-body" style="color:#ff9a8a;font-size:14px">${esc(n.error)}</div>` : ''}
    </div>
  </div>`
  }
  const isHost = n.role === 'host'
  const myChar = isHost ? n.lobby.hostChar : n.lobby.guestChar
  const otherName = n.peerName || '等待加入…'
  const both = !!(n.lobby.hostChar && n.lobby.guestChar)
  const starting = n.status === 'starting' || n.status === 'connecting'
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
    <div class="sts-title" style="font-size:30px;color:#ffd980;letter-spacing:6px">合 作 房 间</div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <div class="sts-body" style="color:#a89070;font-size:13px">${starting ? (isHost ? '正在创建房间…' : '正在连接房间…') : '房间码（告诉你的好友，或在大厅列表中找到它）'}</div>
      <div class="sts-title" style="font-size:44px;color:#8ee8ff;letter-spacing:12px;text-shadow:0 0 24px rgba(100,200,255,.5),3px 3px 0 #000;${starting ? 'animation:blink 1.2s ease-in-out infinite' : ''}">${starting ? '····' : esc(n.roomCode)}</div>
    </div>
    <div class="row" style="gap:52px;align-items:center">
      ${slot(n.myName + '（你）', myChar, true, true)}
      <div class="sts-title" style="font-size:26px;color:#8a7458">VS</div>
      ${slot(otherName, isHost ? n.lobby.guestChar : n.lobby.hostChar, false, n.connected)}
    </div>
    <div class="sts-body" style="color:${n.connected ? '#8ee888' : '#c8a878'};font-size:14px">
      ${starting ? '正在与联机服务器建立连接…'
        : !n.connected ? (isHost
          ? (netMode() === 'p2p' ? '等待好友加入…（把房间码告诉好友）' : '等待好友加入…（房间已显示在大厅列表中）')
          : '正在连接房间…')
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

/** 大厅屏签名（含服务器面板开关与连接方式，保证状态与签名一致） */
function lobbySig(): string {
  const n = g().net
  return `lobby:${netMode()}:${n.role ?? ''}:${n.status}:${n.roomCode}:${n.connected}:${n.lobby?.hostChar}:${n.lobby?.guestChar}:${n.peerName}:${n.error ?? ''}:srv${lobbyShowSrv ? 1 : 0}`
}

/** 大厅差异更新：房间列表 + 服务器状态（不重建整屏，避免打断输入框） */
function updateLobbyDynamics() {
  const st = g()
  if (st.net.role) return   // 房间内界面无需房间列表
  const listEl = document.getElementById('lobby-rooms')
  if (!listEl) return
  setHtml(listEl, lobbyRoomsHtml())
  const stat = document.getElementById('lobby-srv-status')
  if (stat) {
    const color = lobbySrvOk === null ? '#c8a878' : lobbySrvOk ? '#8ee888' : '#ff9a8a'
    const text = lobbySrvOk === null ? '连接服务器中…' : lobbySrvOk ? '● 服务器已连接' : '○ 服务器离线'
    if (stat.style.color !== color) stat.style.color = color
    setText(stat, text)
  }
}

/** 大厅订阅管理：进入 mpLobby 屏时开始，离开时停止；P2P 模式无列表 */
function lobbyWatchTick(screen: string) {
  const want = screen === 'mpLobby' && !g().net.role && netMode() === 'server'
  if (want && !lobbyWatching) {
    lobbyWatching = true
    lobbyWatchScreen = screen
    lobbySrvOk = null
    net.watchLobby().then(() => { lobbySrvOk = true; updateLobbyDynamics() }).catch(() => { lobbySrvOk = false; updateLobbyDynamics() })
  } else if ((!want || netMode() !== 'server') && lobbyWatching) {
    lobbyWatching = false
    lobbyWatchScreen = ''
    net.unwatchLobby()
  }
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
  <div style="position:relative;display:inline-block">
    <img src="${A('neow/neow.png')}" alt="涅奥" draggable="false" style="width:400px;max-width:46vw;object-fit:contain;display:block;filter:drop-shadow(0 20px 36px rgba(0,0,0,.9)) drop-shadow(0 0 50px rgba(90,140,255,.25));animation:neowFloat 4s ease-in-out infinite">
    <div style="position:absolute;left:17%;top:18%;transform:translate(-50%,-50%);width:13%;aspect-ratio:1;pointer-events:none">
      <img src="${A('neow/eye.png')}" draggable="false" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain">
      <img id="neow-lid" src="${A('neow/lid1.png')}" draggable="false" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain">
    </div>
  </div>
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
  return 'bg/combat1.jpg'
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
  return `<div class="screen" id="combat-screen" data-bg="1">
  <div class="sts-shake-layer" id="combat-stage">
    <div class="bg-fill bg-cover" id="combat-bg" style="background-image:url('${A(combatBgKey(run.act))}')"></div>
    ${playerZone}
    <div class="enemies-row" id="enemies-row"></div>
  </div>
  ${topHudShell()}
  <div id="mp-wait-banner"></div>
  <div id="hint-holder"></div>
  <div class="sts-hurt-vignette"></div>
  <button class="pile-btn" id="pile-draw" data-act="openPile" data-pile="draw" style="left:26px;bottom:158px"><b>0</b><span>抽牌堆</span></button>
  <button class="pile-btn" id="pile-discard" data-act="openPile" data-pile="discard" style="right:26px;bottom:158px"><b>0</b><span>弃牌堆</span></button>
  <span id="exhaust-holder"></span>
  <div class="energy" id="energy-box"><img src="${A('frames/' + (ENERGY_ORB[hero] || 'redEnergy') + '.png')}" alt=""><span id="energy-num"></span></div>
  <button class="sts-endturn" data-act="endTurn" id="end-turn-btn"><img class="et-hover" src="${A('endturn/hover.png')}" alt=""><img class="et-plate" src="${A('endturn/button.png')}" alt=""><span class="et-text"></span></button>
  <div class="hand-row" id="hand-row"></div>
  <div id="turn-banner-holder"></div>
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
  // 意图浮动（原版 NIntent：sin(πt+offset)·10+8px，每敌错峰）
  const bobDelay = ((e.uid.charCodeAt(e.uid.length - 1) || 0) % 7) * 0.33
  return `<div class="intent intent-bob" style="animation-delay:${bobDelay}s" data-tip="<b>${esc(mvName)}</b>">
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
  const hasSel = !!g().selectedCardUid || g().selectedPotionIdx !== null
  // 战斗开始（行内尚无敌人）时状态栏延迟滑入；中途召唤的敌人立即滑入（原版 NCreatureStateDisplay fresh 判定）
  const freshCombat = row.children.length === 0
  const seen = new Set<string>()
  let eIdx = 0
  for (const e of c.enemies) {
    seen.add(e.uid)
    const def = ENEMIES[e.id]
    const sw = def.boss ? 340 : def.elite ? 260 : 210
    let el = row.querySelector(`[data-euid="${e.uid}"]`) as HTMLElement | null
    if (!el) {
      el = document.createElement('div')
      el.dataset.euid = e.uid
      // 状态栏滑入（原版 NCreatureStateDisplay：自上方 20px，战斗开始随机延迟 1.3-1.7s）
      const stateDelay = freshCombat ? 1.3 + ((eIdx * 37 + (e.uid.charCodeAt(e.uid.length - 1) || 0)) % 41) / 100 : 0
      el.innerHTML = `
        <div class="intent-slot"></div>
        <div class="sprite"><img src="${A('enemies/' + def.sprite + '.webp')}" alt="" style="width:${sw}px;height:${sw}px"></div>
        <div class="enemy-info" style="animation:sts-state-in .5s cubic-bezier(.2,.8,.3,1) ${stateDelay}s backwards">
          <div class="ename">${esc(def.name)}</div>
          ${hpBarShell('', def.boss ? 280 : 170)}
          <div class="estatus" style="margin-top:4px"></div>
        </div>`
      row.appendChild(el)
    }
    // 类与可点击状态（红框提示仅对存活敌人；死亡怪不再被 target-pulse 动画复活显示）
    const alive = !e.dying && e.hp > 0
    const targetable = hasSel && alive
    const cls = `enemy ${e.dying ? 'dying' : ''} ${targetable ? 'targetable' : ''}`
    if (el.className !== cls) el.className = cls
    if (targetable) { el.dataset.act = 'clickEnemy'; el.dataset.uid = e.uid }
    else { delete el.dataset.act; delete el.dataset.uid }
    el.style.minWidth = sw * 0.8 + 'px'
    // 意图 / 血条 / 状态（区域差异更新；新状态图标闪光）
    setHtml(el.querySelector('.intent-slot'), intentHtml(e, c))
    updateHpBar(el.querySelector('.hpbar'), e.hp, e.maxHp, e.block, (e.statuses as any)?.poison || 0)
    setHtml(el.querySelector('.estatus'), statusRow(e.statuses, 28, statusFlashIds(el.querySelector('.estatus'), e.statuses)))
    eIdx++
  }
  row.querySelectorAll('[data-euid]').forEach(el => {
    if (!seen.has((el as HTMLElement).dataset.euid!)) el.remove()
  })
}

// 悬停中的手牌 uid（悬停推开邻居的原版交互；事件委托，仅需一次绑定）
let handHoverUid = ''
let handHoverBound = false
function bindHandHover() {
  if (handHoverBound) return
  handHoverBound = true
  document.addEventListener('mouseover', ev => {
    const t = (ev.target as HTMLElement | null)?.closest?.('#hand-row [data-cuid]') as HTMLElement | null
    if (t) { if (handHoverUid !== t.dataset.cuid) { handHoverUid = t.dataset.cuid || ''; updateHandAll() } }
    else if (handHoverUid) { handHoverUid = ''; updateHandAll() }
  })
}
function updateHandAll() {
  const st = g()
  if (st.run?.combat) updateHand(st.run)
}

function updateHand(run: RunState) {
  const row = document.getElementById('hand-row')
  if (!row || !run.combat) return
  bindHandHover()
  const c = run.combat
  const st = g()
  const n = AP(c).hand.length
  const myTurnH = c.players.length === 1 || st.net.myIdx === c.activeIdx
  const playableNow = c.phase === 'player' && !st.busy && !c.combatOver && myTurnH
  const seen = new Set<string>()
  // 原版 HandPosHelper 查表（来自 sts2-web 逆向，Mega Crit 官方数值）；按 1600/1920 舞台缩放
  const POS: number[][] = [
    [0, -50], [-100, -50, 100, -50], [-180, -50, 0, -59, 180, -50],
    [-240, -25, -80, -50, 80, -50, 240, -25],
    [-340, 10, -170, -30, 0, -50, 170, -30, 340, 10],
    [-460, 13, -273, -25, -90, -50, 90, -50, 273, -25, 460, 13],
    [-534, 18, -365, -14, -189, -39, 0, -50, 189, -39, 365, -14, 534, 18],
    [-565, 28, -400, -14, -231, -39, -80, -50, 80, -50, 231, -39, 400, -14, 565, 28],
    [-600, 37, -445, -2, -300, -29, -150, -45, 0, -50, 150, -45, 300, -29, 445, -2, 600, 37],
    [-610, 38, -472, 5, -340, -21, -200, -41, -64, -50, 64, -50, 200, -41, 340, -21, 472, 5, 610, 38],
  ]
  const ANG: number[][] = [
    [0], [-2, 2], [-3, 0, 3], [-8, -4, 4, 8], [-8, -4, 0, 4, 8], [-9, -6, -3, 3, 6, 9], [-9, -6, -3, 0, 3, 6, 9],
    [-12, -9, -6, -3, 3, 6, 9, 12], [-12, -9, -6, -3, 0, 3, 6, 9, 12], [-15, -12, -9, -6, -3, 3, 6, 9, 12, 15],
  ]
  const rowIdx = Math.min(Math.max(n, 1), 10) - 1
  const K = 1600 / 1920, HALF_H = 117.5, SINK = 40
  let hoverI = -1
  AP(c).hand.forEach((card, i) => { if (card.uid === handHoverUid) hoverI = i })
  AP(c).hand.forEach((card, i) => {
    seen.add(card.uid)
    let el = row.querySelector(`[data-cuid="${card.uid}"]`) as HTMLElement | null
    if (!el) {
      el = document.createElement('div')
      el.className = 'hand-card hand-in'
      el.dataset.cuid = card.uid
      el.innerHTML = `<div class="hand-inner"><div class="sts-card" data-act="clickCard" data-uid="${card.uid}" style="width:168px;height:235px"></div></div>`
      row.appendChild(el)
    }
    const px = POS[rowIdx]
    let x = (px[i * 2] ?? 0) * K
    const yTab = (px[i * 2 + 1] ?? -50) * K
    const ty = yTab + HALF_H - SINK
    let rot = ANG[rowIdx][i] ?? 0
    if (hoverI >= 0 && hoverI !== i) {
      const dist = Math.abs(hoverI - i)
      if (dist <= 4) x -= Math.sign(hoverI - i) * (100 - 25 * (dist - 1)) * K
    }
    const tf = `translateX(${x}px) translateY(${ty}px) rotate(${rot}deg)`
    if ((el as any).__tf !== tf) { (el as any).__tf = tf; el.style.transform = tf }
    el.style.zIndex = String(10 + i)
    const isSel = st.selectedCardUid === card.uid
    const inner = el.firstElementChild as HTMLElement
    const innerCls = 'hand-inner' + (isSel ? ' sel' : '')
    if (inner.className !== innerCls) inner.className = innerCls
    const cardEl = inner.firstElementChild as HTMLElement
    // 卡面内容仅在升级/费用/付得起/力量/虚弱变化时重建（避免图片重载闪动）
    const cost = cardCost(card, AP(c).hpLostThisCombat)
    const enough = cost === -1 ? true : AP(c).energy >= Math.max(0, cost)
    const ccStrength = AP(c).statuses.strength || 0
    const ccWeak = !!AP(c).statuses.weak
    const sig = `${card.id}|${card.upgraded}|${cost}|${enough}|${ccStrength}|${ccWeak}|${card.freeThisTurn ? 1 : 0}`
    if ((cardEl as any).__sig !== sig) {
      (cardEl as any).__sig = sig
      cardEl.innerHTML = cardInner(card, 168, { unaffordable: !enough && playableNow, combatCtx: { strength: ccStrength, weak: ccWeak } })
    }
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
    const count = Math.max(slots, orbs.length)
    const cells: string[] = []
    // 原版 ∩ 形拱弧（sts2-web TweenLayout）：前球在右 25°，末球在左 150°，半径随容量
    const rArc = 78 + (104 - 78) * Math.min(Math.max((count - 3) / 7, 0), 1)
    const stepArc = count > 1 ? 125 / (count - 1) : 0
    for (let i = 0; i < count; i++) {
      const a = ((25 + i * stepArc) * Math.PI) / 180
      const x = 150 + Math.cos(a) * rArc
      const y = 96 - Math.sin(a) * rArc
      const o = orbs[i]
      const pos = `position:absolute;left:${(x - 17).toFixed(1)}px;top:${(y - 17).toFixed(1)}px`
      if (o) {
        const nm = ORB_NAME[o.type] || o.type
        cells.push(`<span class="orb-cell has" data-tip="<b>${nm}球</b>" style="${pos}">${o.type[0].toUpperCase()}</span>`)
      } else {
        cells.push(`<span class="orb-cell" style="${pos}"></span>`)
      }
    }
    html += `<div class="orb-row" style="position:relative;width:240px;height:104px;margin-bottom:-8px">${cells.join('')}</div>`
  }
  return html
}

// 回合切换横幅（原版参数还原：player_turn_banner / enemy_turn_banner）
// 玩家回合：主文字上浮50px进入 + 「回合 N」天蓝#87ceeb 下落50px，停留0.4s后0.3s淡出
// 敌方回合：2×缩入 + 1.3s淡入，随后金#efc851→红#ff5555渐变1s并淡出
let lastPhase = ''

// 涅奥眨眼驱动（原版 NeowEye.java：lid1停5s→lid2-6闭眼每帧0.04s→全闭0.25s→开眼每帧0.06s）
const NEOW_LID_SEQ = ['lid1', 'lid2', 'lid3', 'lid4', 'lid5', 'lid6', 'lid5', 'lid4', 'lid3', 'lid2']
const NEOW_FRAME_MS = [5000, 40, 40, 40, 40, 250, 60, 60, 60, 60]
let neowFrame = 0
let neowNextAt = 0
setInterval(() => {
  const lid = document.getElementById('neow-lid') as HTMLImageElement | null
  if (!lid) return
  const now = performance.now()
  if (now < neowNextAt) return
  neowFrame = (neowFrame + 1) % 10
  neowNextAt = now + NEOW_FRAME_MS[neowFrame]
  lid.src = A('neow/' + NEOW_LID_SEQ[neowFrame] + '.png')
}, 50)

function turnBanner(phase: string, turn = 1) {
  if (phase === lastPhase) return
  const first = lastPhase === ''
  lastPhase = phase
  if (first || (phase !== 'player' && phase !== 'enemy')) return
  // 原版音效：敌方回合/玩家回合切换
  sfx.play(phase === 'enemy' ? 'enemyTurn' : 'turnEffect')
  const holder = document.getElementById('turn-banner-holder')
  if (!holder) return
  const EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)'
  if (phase === 'player') {
    holder.innerHTML = `<div class="turn-banner sts-title" style="display:flex;flex-direction:column;align-items:center;gap:4px">
      <div id="tb-turn" style="font-size:26px;color:#87ceeb;text-shadow:2px 2px 0 #000;letter-spacing:4px;opacity:0">回合 ${Math.max(1, turn)}</div>
      <div id="tb-label" style="font-size:58px;color:#efc851;text-shadow:3px 3px 0 #000,0 0 40px rgba(0,0,0,.85);letter-spacing:8px;opacity:0">你的回合</div>
    </div>`
    const root = holder.firstElementChild as HTMLElement
    const label = document.getElementById('tb-label')
    const tn = document.getElementById('tb-turn')
    tn?.animate?.([{ transform: 'translateY(-50px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 1500, easing: EXPO, fill: 'forwards' })
    label?.animate?.([{ transform: 'translateY(50px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 1000, easing: EXPO, fill: 'forwards' })
    const fade = root.animate?.([{ opacity: 0 }, { opacity: 1, offset: 0.45 }, { opacity: 1, offset: 0.87 }, { opacity: 0 }], { duration: 2200, easing: 'ease-out', fill: 'forwards' })
    fade?.finished?.then(() => { holder.innerHTML = '' }).catch(() => { holder.innerHTML = '' })
  } else {
    holder.innerHTML = `<div class="turn-banner sts-title" style="display:flex;justify-content:center;opacity:0">
      <div id="tb-label" style="font-size:58px;color:#efc851;text-shadow:3px 3px 0 #000,0 0 40px rgba(0,0,0,.85);letter-spacing:8px;opacity:0;transform-origin:center">敌方回合</div>
    </div>`
    const root = holder.firstElementChild as HTMLElement
    const label = document.getElementById('tb-label')
    label?.animate?.([{ transform: 'scale(2)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 1300, easing: EXPO, fill: 'forwards' })
    label?.animate?.([{ color: '#efc851' }, { color: '#efc851', offset: 0.565 }, { color: '#ff5555' }], { duration: 2300, easing: 'ease-out', fill: 'forwards' })
    const fade = root.animate?.([{ opacity: 0 }, { opacity: 1, offset: 0.45 }, { opacity: 1, offset: 0.57 }, { opacity: 0 }], { duration: 2300, easing: 'ease-out', fill: 'forwards' })
    fade?.finished?.then(() => { holder.innerHTML = '' }).catch(() => { holder.innerHTML = '' })
  }
}

function updateCombatScreen(run: RunState) {
  const c = run.combat
  if (!c) return
  const st = g()
  updateHud(run, true)
  // 背景随幕数切换（键控，避免重复设 url；目标为震屏层内的 #combat-bg）
  const cs = document.getElementById('combat-bg')
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
      setHtml(document.getElementById(`player-status-${i}`), statusRow(pc.statuses, 26, statusFlashIds(document.getElementById(`player-status-${i}`), pc.statuses)))
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
    setHtml(document.getElementById('player-status'), statusRow(AP(c).statuses, 30, statusFlashIds(document.getElementById('player-status'), AP(c).statuses)))
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
  // 能量球：能量 0 时红字暗球（原版 NEnergyCounter dark 态）；回能爆发闪光
  const energyBox = document.getElementById('energy-box')
  if (energyBox) {
    const en = AP(c).energy
    const numEl = document.getElementById('energy-num')
    if (numEl) {
      numEl.style.color = en === 0 ? '#ff5555' : '#fff'
      numEl.style.textShadow = en === 0 ? '2px 2px 0 #501717, 0 0 10px rgba(80,23,23,.9)' : '2px 2px 0 #403010, 0 0 12px #ff5000'
    }
    const eImg = energyBox.querySelector('img') as HTMLImageElement | null
    if (eImg) eImg.style.filter = en === 0 ? 'brightness(.45) saturate(.6)' : ''
    // 第二十三批：原版 EnergyPanel.setEnergy 在回合开始触发（与旧能量值无关）
    // 触发条件：phase player 且 turn 递增（含首回合）
    const cTurn = c.turn || 0
    const prevTurn = (energyBox as any).__turn
    if (c.phase === 'player' && (typeof prevTurn !== 'number' || cTurn > prevTurn)) {
      ;(energyBox as any).__turn = cTurn
      // 原版 EnergyPanel.renderVfx —— 双图反向旋转 2s（α .5→0，scale 1→.1，加色混合）
      const old = energyBox.querySelector('.sts-energy-vfx')
      if (old) (old as HTMLElement).remove()
      const vfx = document.createElement('span')
      vfx.className = 'sts-energy-vfx'
      vfx.innerHTML = `<img class="vfx1" src="${A('topbar/energy-vfx.png')}" alt=""><img class="vfx2" src="${A('topbar/energy-vfx.png')}" alt="">`
      energyBox.appendChild(vfx)
      setTimeout(() => vfx.remove(), 2200)
    }
    ;(energyBox as any).__turn = cTurn
  }
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
    // 第二十二批：原版三态复刻（EndTurnButton.render）——enemy=灰度图+奶白字，off=DISABLED色+浅灰字，glow=无可出牌发光+金字
    const enemyPhase = c.phase !== 'player'
    const off = !enemyPhase && (st.busy || !myTurnE || c.combatOver)
    const me = AP(c)
    const glowing = !enemyPhase && !off && me.hand.length > 0 && me.hand.every(h => cardCost(h) > me.energy)
    et.disabled = enemyPhase || off
    const etCls = 'sts-endturn' + (glowing ? ' glow' : '') + (enemyPhase ? ' enemy' : '') + (off ? ' off' : '')
    if (et.className !== etCls) et.className = etCls
    const plate = et.querySelector('.et-plate') as HTMLImageElement | null
    const plateSrc = glowing ? A('endturn/glow.png') : A('endturn/button.png')
    if (plate && plate.getAttribute('src') !== plateSrc) plate.src = plateSrc
    setText(et.querySelector('.et-text'), c.phase === 'player' ? (mpE && !myTurnE ? '队友回合…' : '结束回合') : '敌方回合…')
  }
  // 回合切换横幅（原版参数动画）
  turnBanner(c.phase, c.turn)
  setHtml(document.getElementById('hint-holder'), (st.selectedCardUid || st.selectedPotionIdx !== null)
    ? `<div class="target-hint sts-body">${st.selectedPotionIdx !== null
      ? '选择药水目标（点击敌人，点击空白处取消）'
      : isTouch() ? '点击敌人打出 · 再点一次卡牌确认 · 点空白取消' : '选择目标（点击敌人，点击空白处取消）'}</div>` : '')
  setHtml(document.getElementById('banner-holder'), st.endBanner
    ? `<div class="banner sts-title">${st.endBanner === 'win' ? '战斗胜利！' : '你倒下了…'}</div>` : '')
}

// ============ 地图界面（骨架 + 键控节点/边更新） ============
// 第五批：点状路径(替代SVG虚线)/节点脉冲/玩家标记/图例/选点墨迹
const NODE_ICON: Record<string, string> = { monster: 'monster', elite: 'elite', event: 'event', shop: 'shop', treasure: 'treasure', rest: 'rest', boss: 'boss' }
const NODE_NAME: Record<string, string> = { monster: '普通敌人', elite: '精英敌人', event: '未知事件', shop: '商店', treasure: '宝箱', rest: '篝火', boss: 'BOSS' }
// 原版行为：地图 boss 节点显示本幕专属 boss 图标（ui/map/boss/*.png）
const BOSS_ICON: Record<string, string> = {
  slimeBoss: 'slime', theGuardian: 'guardian', hexaghost: 'hexaghost',
  bronzeAutomaton: 'automaton', theCollector: 'collector', theChamp: 'champ',
  awakenedOne: 'awakened', timeEater: 'timeeater', donu: 'donu',
  corruptHeart: 'heart',
}
const bossIconOf = (run: RunState): { icon: string; name: string } | null => {
  const ab = run.actBoss
  if (!ab || !ab.enemies.length) return null
  const icon = BOSS_ICON[ab.enemies[0]]
  return icon ? { icon, name: ab.name } : null
}
const LEGEND_ITEMS: [string, string][] = [
  ['event', '未知'], ['shop', '商店'], ['treasure', '宝箱'],
  ['rest', '篝火'], ['monster', '敌人'], ['elite', '精英'],
]

/** 确定性伪随机（与 Next.js 版一致） */
const frac = (x: number) => x - Math.floor(x)
const prand = (seed: number) => frac(Math.sin(seed * 127.1 + 311.7) * 43758.5453)

function buildMapScreen(): string {
  return `<div class="screen">
  ${topHudShell()}
  <div class="map-scroll" id="mapScroll">
    <div class="map-canvas" style="background-image:url('${A('bg/map.jpg')}')">
      <div id="map-dots"></div>
      <div id="map-nodes"></div>
      <div id="map-marker-holder"></div>
      <div class="map-fade"></div>
    </div>
  </div>
  <div class="map-legend">
    <div class="lg-title">图 例</div>
    ${LEGEND_ITEMS.map(([t, n]) => `<div class="lg-item" data-ltype="${t}"><img src="${A('mapicons/' + t + '.png')}"><span>${n}</span></div>`).join('')}
  </div>
</div>`
}

let lastMapScrollNode: string | null | undefined
// 选点墨迹状态（防重入）
let mapInking = false

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
        el.dataset.ntype = nd.type
        const bi0 = bossIconOf(run)
        const iconKey0 = nd.type === 'boss' && bi0 ? bi0.icon : NODE_ICON[nd.type]
        el.innerHTML = `<img src="${A('mapicons/' + iconKey0 + '.png')}" alt=""><span class="cur-ring" style="display:none"></span><span class="node-outline"></span>`
        holder.appendChild(el)
      }
      el.dataset.ntype = nd.type
      const bi = nd.type === 'boss' ? bossIconOf(run) : null
      const iconKey = bi ? bi.icon : NODE_ICON[nd.type]
      const imgEl = el.querySelector('img') as HTMLImageElement | null
      if (imgEl) {
        const wantSrc = A('mapicons/' + iconKey + '.png')
        if (imgEl.getAttribute('src') !== wantSrc) imgEl.setAttribute('src', wantSrc)
      }
      const isCur = run.currentNodeId === nd.id
      const isReach = reach.includes(nd.id)
      const visited = run.visitedNodes.includes(nd.id)
      const cls = ['node', nd.type === 'boss' ? 'boss' : '', isReach ? 'reach' : '', !isReach && !visited && !isCur ? 'locked' : ''].filter(Boolean).join(' ')
      if (el.className !== cls) el.className = cls
      el.style.left = `calc(${(nd.x / W) * 100}% - ${size / 2}px)`
      el.style.top = `calc(${(nd.y / H) * 100}% - ${size / 2}px)`
      el.style.width = el.style.height = size + 'px'
      el.style.zIndex = isReach || isCur ? '20' : '10'
      el.style.opacity = visited && !isCur ? '0.5' : '1'
      if (isReach) { el.dataset.act = 'chooseNode'; el.dataset.id = nd.id }
      else { delete el.dataset.act }
      el.dataset.tip = `<b>${nd.type === 'boss' && bi ? bi.name : NODE_NAME[nd.type]}</b>`
      const ring = el.querySelector('.cur-ring') as HTMLElement
      if (ring) ring.style.display = isCur ? '' : 'none'
      const img = el.querySelector('img') as HTMLElement
      if (img) img.style.filter = isCur ? 'drop-shadow(0 0 14px #ffd070) brightness(1.2)' : ''
    }
  }

  // 边：点状路径（原版 map_dot：每 22 单距一朵，确定性抖动 ±3.5；走过变深色 1.25×）
  const dotHolder = document.getElementById('map-dots')
  if (dotHolder) {
    let i = 0
    for (const nd of Object.values(map.nodes)) {
      for (const toId of nd.edges) {
        const to = map.nodes[toId]
        if (!to) continue
        const visitedEdge = run.visitedNodes.includes(toId) && (run.currentNodeId === nd.id || run.visitedNodes.includes(nd.id))
        const len = Math.hypot(to.x - nd.x, to.y - nd.y)
        const count = Math.floor(len / 22)
        const vx = (to.x - nd.x) / len, vy = (to.y - nd.y) / len
        const edgeKey = `${nd.id}>${toId}`
        for (let k = 1; k <= count; k++) {
          let dot = dotHolder.children[i] as HTMLElement | null
          if (!dot) { dot = document.createElement('div'); dotHolder.appendChild(dot) }
          const seed = nd.id.length * 131 + toId.length * 977 + k * 37
          dot.dataset.edge = edgeKey
          dot.dataset.idx = String(k)
          const cls = 'map-dot' + (visitedEdge ? ' traveled' : '')
          if (dot.className !== cls) dot.className = cls
          dot.style.left = ((nd.x + vx * k * 22 + (prand(seed) - 0.5) * 7) / W * 100) + '%'
          dot.style.top = ((nd.y + vy * k * 22 + (prand(seed + 0.5) - 0.5) * 7) / H * 100) + '%'
          i++
        }
      }
    }
    while (dotHolder.children.length > i) dotHolder.lastChild!.remove()
  }

  // 玩家标记（原版 NMapMarker：当前节点上方，X轴展开+弹性落地）
  const mh = document.getElementById('map-marker-holder')
  if (mh) {
    const cur = run.currentNodeId ? map.nodes[run.currentNodeId] : null
    if (cur) {
      const meP = run.players[run.players.length > 1 ? g().net.myIdx : 0] || run.players[0]
      const myChar = (meP as any)?.character || 'ironclad'
      if (mh.dataset.cur !== run.currentNodeId) {
        mh.dataset.cur = run.currentNodeId ?? undefined
        mh.innerHTML = `<div class="map-marker"><img src="${A('hero/' + myChar + '.png')}"></div>`
        const mk = mh.firstElementChild as HTMLElement
        mk.style.left = (cur.x / W * 100) + '%'
        mk.style.top = `calc(${(cur.y / H * 100)}% - 62px)`
      }
    } else if (mh.dataset.cur) {
      mh.dataset.cur = ''
      mh.innerHTML = ''
    }
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

// ============ 奖励界面（第六批：顶栏 HUD 常驻，原版行为） ============
function buildRewardScreen(): string {
  return `<div class="screen reward-bg">
  ${topHudShell()}
  <div class="big-title sts-title hud-pad-title">战利品</div>
  <div class="reward-list" id="reward-rows"></div>
  <div class="reward-cards-label sts-body" id="reward-label"></div>
  <div class="reward-cards" id="reward-cards"></div>
  <button class="sts-btn sts-title slide-btn-r" data-act="proceedReward" id="reward-proceed" style="font-size:22px;margin-top:26px"></button>
</div>`
}

function updateRewardScreen(run: RunState) {
  const r = run.reward
  if (!r) return
  updateHud(run, false)
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
        // 原版 NCardRareGlow/NCardUncommonGlow：稀有金晕 / 罕见蓝晕（1s 淡入至 0.9）
        const rar0 = CARDS[cid]?.rarity
        const glow = (rar0 === 'rare' || rar0 === 'uncommon')
          ? `<div class="sts-reward-glow ${rar0 === 'rare' ? 'sts-reward-glow-rare' : 'sts-reward-glow-uncommon'}"></div>` : ''
        el.innerHTML = glow + cardHtml({ uid: 'r_' + cid, id: cid, upgraded: 0 }, mp ? 150 : 165) + `<span class="taken-mark sts-title" style="display:none">已选</span>`
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

// ============ 商店界面（第六批：槽位 hover 缩放/购买失败抖动/价格原版配色 + 顶栏 HUD 常驻） ============
function buildShopScreen(): string {
  return `<div class="screen shop-bg">
  ${topHudShell()}
  <div class="center-col hud-pad" style="padding:96px 16px 26px;gap:22px">
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
    <button class="sts-btn sts-btn-gold sts-title sts-shop-slot" data-act="buyRemoval" id="shop-removal" style="font-size:18px"></button>
    <button class="sts-btn sts-title" data-act="leaveShop" style="font-size:22px">离开商店</button>
  </div>
</div>`
}

// 价格标签（原版 NMerchantSlot：#FF5555 买不起 / #7FFF00 打折 / #FFF6E2 正常）
function shopPriceTag(sold: boolean, price: number, gold: number, discount?: boolean): string {
  if (sold) return `<span class="price-tag">已售出</span>`
  const color = gold < price ? '#FF5555' : discount ? '#7FFF00' : '#FFF6E2'
  return `<span class="price-tag ${gold >= price ? 'ok' : ''}" style="color:${color}">💰 ${price}${discount ? ` <i style="font-style:normal;color:#7FFF00;font-size:12px">5折</i>` : ''}</span>`
}

// 购买失败槽位抖动（原版 NMerchantSlot：x=sin(p·2π)·10，p=(1-(1-t)²)·2 Quad Out 采样 25 帧，0.4s）
let shopFailSeen = 0
function watchShopFail() {
  const st = g()
  if (!st.shopFail || st.shopFail.ts === shopFailSeen) return
  shopFailSeen = st.shopFail.ts
  const f = st.shopFail
  let el: HTMLElement | null = null
  if (f.kind === 'card') el = document.querySelector(`#shop-cards [data-sidx="${f.idx}"]`)
  else if (f.kind === 'relic') el = document.querySelector(`#shop-relics [data-ridx="${f.idx}"]`)
  else if (f.kind === 'potion') el = document.querySelector(`#shop-potions [data-pidx="${f.idx}"]`)
  else el = document.getElementById('shop-removal')
  el?.animate?.(Array.from({ length: 25 }, (_, i) => {
    const t = i / 24, p = (1 - (1 - t) * (1 - t)) * 2
    return { translate: `${Math.sin(p * 2 * Math.PI) * 10}px 0` }
  }), { duration: 400 })
}

function updateShopScreen(run: RunState) {
  const shop = run.shop
  if (!shop) return
  updateHud(run, false)
  watchShopFail()
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
      el.className = `shop-card sts-shop-slot ${item.sold ? 'sold' : ''}`
      if (item.sold) delete el.dataset.act
      else el.dataset.act = 'buyCard'
      setHtml(el.querySelector('.shop-price'), shopPriceTag(item.sold, item.price, meS.gold, item.discount))
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
      el.className = `sts-panel shop-item sts-shop-slot ${item.sold ? 'sold' : ''}`
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
        el.innerHTML = `${potionLayersHtml(item.potionId, 42, 48)}
          <div class="sts-body" style="font-size:12px;color:#f5e5c8">${esc(def.name)}</div><span class="shop-price"></span>`
        potsEl.appendChild(el)
      }
      el.className = `sts-panel shop-item sts-shop-slot ${item.sold ? 'sold' : ''}`
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
  // 各幕原版篝火房背景（图集 campfire 区域）
  const campBg = run.act >= 4 ? 'campfire4' : run.act === 3 ? 'campfire3' : run.act === 2 ? 'campfire2' : 'campfire1'
  return `<div class="screen rest-bg center-col" style="background-image:url('${A('bg/' + campBg + '.jpg')}');background-size:cover;background-position:center 30%">
  ${topHudShell()}
  <div class="shade" style="background:rgba(6,3,2,.35)"></div>
  <div class="smoke-slot" style="display:none"></div>
  <div class="big-title sts-title">篝火</div>
  ${mpStatus}
  <div class="row-cards">
    <button class="camp-btn ${canRest && !myChoice ? '' : 'dis'}" data-act="rest" data-r="rest" style="${dim(canRest && !myChoice)}">
      <img src="${A('campfire/sleep.png')}" width="96" height="96" draggable="false" style="filter:drop-shadow(0 6px 0 rgba(0,0,0,.45))">
      <div class="sts-title rest-label" style="font-size:22px;color:#ffd980">休息</div>
      <div class="sts-body">回复 ${Math.floor(me.maxHp * 0.3)} 点生命值（上限的 30%）<br><span style="color:#8fe89a">当前可回复 ${heal} 点</span></div>
    </button>
    <button class="camp-btn ${!myChoice ? '' : 'dis'}" data-act="rest" data-r="smith" style="${dim(!myChoice)}">
      <img src="${A('campfire/smith.png')}" width="96" height="96" draggable="false" style="filter:drop-shadow(0 6px 0 rgba(0,0,0,.45))">
      <div class="sts-title" style="font-size:22px;color:#ffd980">锻造</div>
      <div class="sts-body">升级牌组中的一张牌</div>
    </button>
  </div>
</div>`
}

// ============ 宝箱两步（第六批原版还原：开箱 → 遗物 2× 展示+稀有度光晕 → 拾取；顶栏 HUD 常驻） ============
let lastGoQuote = ''
function rTreasure(run: RunState): string {
  const tr = run.pendingTreasureRelic
  const opened = tr !== undefined
  const def = tr ? RELICS[tr] : null
  const rarityCls = def && (def.rarity === 'rare' || def.rarity === 'uncommon') ? def.rarity : 'common'
  if (!opened) {
    return `<div class="screen treasure-bg center-col hud-pad">
    ${topHudShell()}
    <div class="big-title sts-title">宝箱</div>
    <button data-act="openTreasure" style="filter:drop-shadow(0 0 26px rgba(255,200,60,.55))">
      <img src="${A('mapicons/treasure.png')}" width="180" height="180"></button>
    <button class="sts-btn sts-title" data-act="openTreasure" style="font-size:20px">打开宝箱</button>
  </div>`
  }
  // 开箱后：遗物 2× 展示 + 稀有度光晕脉冲 + hover 2.1/press 1.9（原版 NTreasureRoomRelicHolder）
  return `<div class="screen treasure-bg center-col hud-pad">
  ${topHudShell()}
  <div class="big-title sts-title">${def ? '获得了遗物！' : '箱子是空的……'}</div>
  ${def ? `<div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:12px">
    <div class="sts-chest-glow-${rarityCls}" style="position:absolute;width:340px;height:340px;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none"></div>
    <div class="sts-chest-relic" data-act="confirmTreasure" data-tip="<b>${esc(def.name)}</b><br><span style='color:#d8c8a8'>${esc(def.desc)}</span>" style="cursor:pointer">
      <img src="${A('relics/' + tr + '.png')}" width="140" height="140" style="filter:drop-shadow(0 6px 14px rgba(0,0,0,.6))">
    </div>
    <div class="sts-title" style="font-size:26px;color:#ffe9a0;text-shadow:2px 2px 0 #000">${esc(def.name)}</div>
    <div class="sts-body" style="font-size:15px;color:#d8c8a8;max-width:420px;text-align:center;line-height:1.6">${esc(def.desc)}</div>
  </div>` : ''}
  <button class="sts-btn sts-title" data-act="confirmTreasure" style="font-size:20px">${def ? '拿走' : '离开'}</button>
</div>`
}

// 事件界面打字机（原版 NEventLayout：0.75s 后 1s 内 Sine Out 逐字揭示）
let lastEvTyped = ''
let evTypeRaf = 0
function startEvTypewriter(text: string) {
  cancelAnimationFrame(evTypeRaf)
  const shown = document.getElementById('ev-shown')
  const rest = document.getElementById('ev-rest')
  if (!shown || !rest) return
  shown.textContent = ''
  rest.textContent = text
  const t0 = performance.now()
  const tick = (t: number) => {
    const k = Math.min(1, Math.max(0, (t - t0 - 750) / 1000))
    const n = Math.round(Math.sin((k * Math.PI) / 2) * text.length)
    shown.textContent = text.slice(0, n)
    rest.textContent = text.slice(n)
    if (k < 1) evTypeRaf = requestAnimationFrame(tick)
  }
  evTypeRaf = requestAnimationFrame(tick)
}

// 原版事件插画映射（反编译 events 类的图引用）
const EVENT_IMG: Record<string, string> = {
  bonfireSpirits: 'events/bonfire.jpg',
  bigFish: 'events/fishing.jpg',
  goldenWing: 'events/goldenWing.jpg',
  deadAdventurer: 'events/deadAdventurer.png',
  cleric: 'events/cleric.jpg',
  livingWorkshop: 'events/livingWall.jpg',
}

function rEvent(run: RunState, animate = true): string {
  const ev = EVENTS[run.currentEvent!]
  const msg = g().eventMsg
  const evBg = run.act >= 4 ? 'event4' : run.act === 3 ? 'event3' : run.act === 2 ? 'event2' : 'event1'
  const evImg = EVENT_IMG[run.currentEvent!]
  return `<div class="screen center-col hud-pad" style="background-image:url('${A('bg/' + evBg + '.jpg')}');background-size:cover;background-position:center 30%">
  <div class="shade" style="background:rgba(6,3,2,.42)"></div>
  ${topHudShell()}
  <div class="sts-panel event-panel">
    ${evImg ? `<img src="${A(evImg)}" draggable="false" class="ev-title" style="width:360px;max-height:200px;object-fit:cover;border-radius:6px;border:2px solid #6b4a2e;box-shadow:0 4px 18px rgba(0,0,0,.6)">` : ''}
    <div class="sts-title ev-title" style="font-size:34px;color:#ffd980;text-shadow:2px 2px 0 #000">${esc(ev.name)}</div>
    <div class="sts-body event-desc ev-desc-wrap"><span id="ev-shown"></span><span id="ev-rest" style="opacity:0">${esc(ev.desc)}</span></div>
    ${msg ? `<div class="sts-body ev-msg" style="color:#8fe89a">${esc(msg)}</div>` : ''}
    <div class="event-choices">${ev.choices.map((ch: any, i: number) => {
      const meE = run.players[run.players.length > 1 ? g().net.myIdx : 0] || run.players[0]
      const dis = (ch.effect === 'cleric_heal' && meE.gold < 35) || (ch.effect === 'cleric_purify' && meE.gold < 50)
      const animStyle = animate ? `animation-delay:${0.5 + i * 0.2}s` : 'animation:none'
      return `<button class="sts-btn event-btn ev-opt ${dis ? 'dis' : ''}" data-act="chooseEvent" data-idx="${i}" style="${animStyle}">${esc(ch.text)}</button>`
    }).join('')}</div>
  </div>
</div>`
}

// ============ 死亡引言（原版 NGameOverScreen.AnimateInQuote：随机 QUOTES，红色斜体滑入淡入） ============
const DEATH_QUOTES = [
  '「尖塔从不仁慈。」',
  '「死亡只是循环的一部分。」',
  '「你的旅程在此结束……暂时的。」',
  '「尖塔嘲弄着你的失败。」',
  '「或许下一次，你会爬得更高。」',
  '「死者无法讲述他们的故事。」',
  '「尖塔又添一缕亡魂。」',
  '「攀登者的尸骸铺就了尖塔的石阶。」',
]

function rGameOver(run: RunState): string {
  const info = run.gameOverInfo!
  if (!lastGoQuote) lastGoQuote = DEATH_QUOTES[Math.floor(Math.random() * DEATH_QUOTES.length)]
  const st = g()
  const mp = run.players.length > 1
  const me = run.players[mp ? st.net.myIdx : 0] || run.players[0]
  // 条件徽章（原版 badges：小/大卡组、收藏家、守财奴）
  const badges: { label: string; color: string }[] = []
  const deckN = me.deck.length
  if (deckN <= 20) badges.push({ label: `小卡组 · ${deckN} 张`, color: '#8fe89a' })
  if (deckN >= 40) badges.push({ label: `大卡组 · ${deckN} 张`, color: '#ffd980' })
  if (me.relics.length >= 25) badges.push({ label: `收藏家 · ${me.relics.length} 个遗物`, color: '#c9a8ff' })
  if (me.gold >= 3000) badges.push({ label: `黄金之神 · ${me.gold} 金币`, color: '#ffd980' })
  else if (me.gold >= 1000) badges.push({ label: `守财奴 · ${me.gold} 金币`, color: '#ffe9a0' })
  // 统计行逐项滑入（原版 AnimateBadges：-50px→0 Spring Out 0.3s，间隔 0.1s）
  const statRow = (label: string, val: string | number, i: number) =>
    `<div class="srow sts-go-stat" style="animation-delay:${0.8 + i * 0.1}s"><span>${label}</span><b>${val}</b></div>`
  return `<div class="screen gameover-bg center-col">
  <div class="sts-title sts-go-title" style="font-size:64px;color:${info.victory ? '#ffd980' : '#c85040'};text-shadow:4px 4px 0 #000">${info.victory ? '登顶成功！' : '你死了'}</div>
  ${info.victory ? '' : `<div class="sts-body sts-go-quote" style="font-size:17px;color:#c86858;font-style:italic;letter-spacing:1px">${lastGoQuote}</div>`}
  <div class="sts-panel" style="padding:30px;min-width:320px;display:flex;flex-direction:column;gap:12px">
    ${statRow('到达层数', info.floor, 0)}
    ${statRow('消灭怪物', info.monstersSlain, 1)}
    ${statRow('消灭精英', info.elitesSlain, 2)}
    ${statRow('赚取金币', info.goldEarned, 3)}
    ${mp ? statRow('模式', '联机合作', 4) : ''}
  </div>
  ${badges.length ? `<div class="row" style="gap:12px;flex-wrap:wrap;justify-content:center;max-width:520px">${badges.map((b, i) => `<span class="sts-go-badge sts-body" style="animation-delay:${1.3 + i * 0.12}s;font-size:14px;font-weight:bold;color:${b.color};border:1.5px solid ${b.color}55;background:rgba(0,0,0,.35);padding:6px 16px;border-radius:999px;text-shadow:1px 1px 0 #000">${b.label}</span>`).join('')}</div>` : ''}
  <div class="row sts-go-btn" style="gap:18px;animation-delay:1.5s">
    <button class="sts-btn sts-title" data-act="startRun" style="font-size:22px">再来一局</button>
    <button class="sts-btn sts-title" data-act="backTitle" style="font-size:22px">回到主菜单</button>
  </div>
</div>`
}

// ============ 遮罩层（牌堆查看 / 选牌 / 预见） ============
let scryMarked: Set<string> = new Set()

// ============ 选牌遮罩 / 溢出层 ============
// 战斗内升级预览选中的卡 uid（原版 NUpgradePreview；空 = 未预览）
let armPreviewUid: string | null = null

// ============ 检视屏状态（原版 NInspectCardScreen：大卡+金箭头+升级预览勾选） ============
let inspectUid: string | null = null
let inspectTicked = false
let inspectGen = 0
let inspectDir = 0
let inspectClosing = false

function pileCardsOf(run: RunState, pile: string): CardInstance[] {
  if (pile === 'draw') return [...(run.combat ? AP(run.combat).drawPile : [])].reverse()
  if (pile === 'discard') return [...(run.combat ? AP(run.combat).discardPile : [])].reverse()
  if (pile === 'exhaust') return [...(run.combat ? AP(run.combat).exhaustPile : [])]
  return run.deck
}

// 检视层 HTML：黑0.9背板 + 大卡（切卡±100px滑入）+ 金箭头（端点隐藏）+ 升级预览勾选框
function inspectLayerHtml(cards: CardInstance[]): string {
  const idx = Math.max(0, cards.findIndex(c => c.uid === inspectUid))
  const card = cards[idx]
  if (!card) return ''
  const shown: CardInstance = inspectTicked
    ? { ...card, upgraded: Math.max(1, card.upgraded + 1) }
    : card.upgraded > 0 ? { ...card, upgraded: card.upgraded - 1 } : card
  const animCls = inspectGen === 0 ? 'inspect-card-in' : (inspectDir < 0 ? 'inspect-nav-l' : 'inspect-nav-r')
  const arrow = (left: boolean) => `<svg width="52" height="52" viewBox="0 0 52 52" fill="none"><path d="${left ? 'M33 10 L17 26 L33 42' : 'M19 10 L35 26 L19 42'}" stroke="#e8b855" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`
  return `<div class="inspect-root" onclick="event.stopPropagation()">
    <div class="inspect-backdrop ${inspectClosing ? 'closing' : ''}" data-act="inspectClose"></div>
    <div class="inspect-body">
      <div class="inspect-card-wrap ${animCls}" key="insp-${inspectGen}">${cardHtml(shown, 300)}</div>
      ${idx > 0 ? `<div class="inspect-arrow inspect-arr-in-l" data-act="inspectStep" data-dir="-1" title="上一张 (←)">${arrow(true)}</div>` : ''}
      ${idx < cards.length - 1 ? `<div class="inspect-arrow inspect-arr-in-r" data-act="inspectStep" data-dir="1" title="下一张 (→)">${arrow(false)}</div>` : ''}
      <div class="inspect-tick" data-act="inspectToggle">
        <div class="tickbox ${inspectTicked ? 'on' : ''}">${inspectTicked ? '<span class="tickbox-check">✓</span>' : ''}</div>
        <span class="sts-title" style="font-size:17px;color:${inspectTicked ? '#ffd76a' : '#c8b090'};text-shadow:2px 2px 0 #000;letter-spacing:2px">查看升级</span>
      </div>
      <div class="inspect-count">${idx + 1} / ${cards.length}</div>
      <div class="inspect-hint">←/→ 切换 · 空格升级预览 · Esc 关闭</div>
    </div>
  </div>`
}

function inspectRerender() {
  const layer = document.getElementById('overlay-layer')
  if (layer) { (layer as any).__sig = ''; renderOverlays(g()) }
}

function doInspectStep(d: number) {
  const st = g()
  if (!st.pileView || !st.run || inspectClosing) return
  const cards = pileCardsOf(st.run, st.pileView)
  const idx = cards.findIndex(c => c.uid === inspectUid)
  const i = idx + d
  if (i < 0 || i >= cards.length) return
  inspectDir = d
  inspectGen++
  inspectUid = cards[i].uid
  inspectTicked = cards[i].upgraded > 0
  inspectRerender()
}

function doInspectToggle() {
  if (!inspectUid || inspectClosing) return
  inspectTicked = !inspectTicked
  inspectRerender()
}

function doInspectClose() {
  if (!inspectUid || inspectClosing) return
  inspectClosing = true
  inspectRerender()
  setTimeout(() => { inspectUid = null; inspectClosing = false; inspectGen = 0; inspectRerender() }, 240)
}

function overlayHtml(st: ReturnType<typeof g>): { html: string; sig: string } {
  const run = st.run
  if (!run) return { html: '', sig: '' }
  // 防御：combat 结构不完整（缺 players/activeIdx）时跳过预见层，避免整个渲染循环崩溃
  const apOk = !!run.combat && Array.isArray(run.combat.players) && !!run.combat.players[run.combat.activeIdx]
  if (apOk && AP(run.combat).pendingScry) {
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
    const cards = pileCardsOf(run, pile)
    const sig = `pile:${pile}:${cards.length}:insp:${inspectUid ?? ''}:${inspectTicked ? 1 : 0}:${inspectGen}`
    const grid = cards.map(c => `<div class="pile-card-hover" style="cursor:pointer" title="点击放大检视" data-act="inspectOpen" data-uid="${c.uid}">${cardHtml(c, 128)}</div>`).join('')
    return {
      sig,
      html: `<div class="overlay" data-act="closePile">
        <div class="sts-panel" style="padding:22px;max-width:1440px;max-height:800px;display:flex;flex-direction:column;align-items:center;gap:14px" onclick="event.stopPropagation()">
          <div class="sts-title" style="font-size:24px;color:#ffd980">${titles[pile]} <small style="font-size:15px;color:#a89070">(${cards.length})</small></div>
          <div class="sel-cards" style="max-height:620px">${grid || '<div class="sts-body">空空如也</div>'}</div>
          <button class="sts-btn slide-btn-r" data-act="closePile">关闭</button>
        </div>
        ${inspectUid ? inspectLayerHtml(cards) : ''}
      </div>`
    }
  }
  if (st.select) {
    const sel = st.select
    const ordered: CardInstance[] = sel.source === 'offer' ? (sel.offerCards ?? [])
      : sel.source === 'deck' ? run.deck
        : sel.source === 'hand' ? (run.combat ? AP(run.combat).hand : [])
          : (run.combat ? AP(run.combat).discardPile : [])
    const cards = ordered.filter(c => sel.cardUids.includes(c.uid))
    const cancellable = ['eventUpgrade', 'eventRemove', 'sacrifice', 'restSmith', 'shopRemove'].includes(sel.kind)
    // 战斗内升级（武装等）：点击先出升级预览（原版 NUpgradePreview：原卡 → 三箭头 → 升级后卡）
    const isArm = sel.kind === 'armaments'
    const findC = (uid: string) => cards.find(c => c.uid === uid)
    const pvCard = isArm && armPreviewUid ? findC(armPreviewUid) : null
    const sig = `select:${sel.kind}:${sel.title}:${cards.length}:${isArm ? (armPreviewUid || '') : ''}`
    if (isArm && pvCard) {
      const arrows = [0, 1, 2].map(k => `<span class="arrow-nudge" style="animation-delay:${k * 0.15}s">➤</span>`).join('')
      return {
        sig,
        html: `<div class="overlay" style="display:flex;align-items:center;justify-content:center">
          <div style="display:flex;flex-direction:column;align-items:center;gap:24px">
            <div class="sts-title" style="font-size:26px;color:#ffd980;text-shadow:2px 2px 0 #000">升级预览</div>
            <div style="display:flex;align-items:center;gap:34px">
              <div class="up-preview-card" data-act="armPreview" data-uid="" title="点击返回选择">${cardHtml(pvCard, 170)}</div>
              <div style="display:flex;flex-direction:column;gap:2px;font-size:34px;color:#ffd34d;text-shadow:0 0 10px rgba(255,200,80,.8)">${arrows}</div>
              <div class="up-preview-card">${cardHtml({ ...pvCard, upgraded: Math.max(1, pvCard.upgraded) }, 170)}</div>
            </div>
            <div style="display:flex;gap:16px">
              <button class="sts-btn sts-title" style="font-size:20px;padding:8px 40px" data-act="resolveSelect" data-uid="${pvCard.uid}">确认升级</button>
              <button class="sts-btn" data-act="armPreview" data-uid="">重选</button>
            </div>
          </div>
        </div>`
      }
    }
    return {
      sig,
      html: `<div class="overlay" style="display:flex;align-items:center;justify-content:center">
        <div style="display:flex;flex-direction:column;align-items:center;gap:18px;max-width:1480px">
          <div class="sts-title" style="font-size:26px;color:#ffd980;text-shadow:2px 2px 0 #000">${esc(sel.title)}</div>
          <div class="sel-cards" style="max-height:640px">${cards.map((c, i) => `<div class="card-in card-selectable" style="animation-delay:${Math.min(i, 8) * 0.05}s" data-act="${isArm ? 'armPreview' : 'resolveSelect'}" data-uid="${c.uid}">${cardHtml(c, 136, isArm ? '' : 'playable')}</div>`).join('') || '<div class="sts-body">没有可选择的卡牌</div>'}</div>
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

// ============ 屏幕震动（punch 模型，移植 sts2-web NScreenShake） ============
// 位移 = cos(t·60rad/s)·幅度·cubicOut(剩余/总时长)，只作用于 .sts-shake-layer（背景+角色+敌人）
const shakeCubicOut = (p: number) => (p - 1) ** 3 + 1
let shakePunch: { a: number; t: number; r: number; dx: number; dy: number } | null = null
let shakeRunning = false
function shakeLayerEls(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.sts-shake-layer'))
}
function shakeStep(dt: number): boolean {
  const p = shakePunch
  if (!p) return false
  p.r -= dt
  const els = shakeLayerEls()
  if (p.r <= 0) {
    shakePunch = null
    els.forEach(el => { el.style.translate = '' })
    return false
  }
  const c = Math.cos(p.r * 60) * p.a * shakeCubicOut(p.r / p.t)
  els.forEach(el => { el.style.translate = `${(c * p.dx).toFixed(2)}px ${(c * p.dy).toFixed(2)}px` })
  return true
}
function screenPunch(px: number, duration = 0.3) {
  if (!px) return
  const rad = Math.random() * 360 * Math.PI / 180
  shakePunch = { a: px, t: duration, r: duration, dx: Math.cos(rad), dy: Math.sin(rad) }
  if (shakeRunning) return
  shakeRunning = true
  let last = performance.now()
  const step = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    if (shakeStep(dt)) requestAnimationFrame(step)
    else {
      shakeRunning = false
      shakeLayerEls().forEach(el => { el.style.translate = '' })
    }
  }
  requestAnimationFrame(step)
}
// 受伤红晕（原版 PlayerHurtVignetteHelper.Play：重播即重置）
function playHurtVignette() {
  const el = document.querySelector<HTMLElement>('.sts-hurt-vignette')
  if (!el) return
  el.classList.remove('sts-vignette-play')
  void el.offsetWidth
  el.classList.add('sts-vignette-play')
}
// 玩家受击：按 hpLoss 分档震动 + 红晕；命中敌人：极弱震（原版 NScratchVfx）
function screenShake(hpLoss: number, isPlayer: boolean) {
  if (!isPlayer) { screenPunch(2, 0.3); return }
  screenPunch(hpLoss >= 20 ? 33 : hpLoss >= 10 ? 17 : hpLoss >= 5 ? 8 : 4, 0.3)
  playHurtVignette()
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

// ============ 浮动数字物理（原版 NDamageNumVfx / NHealNumVfx） ============
// 伤害：红#F72B14→奶油#FFF6E2(0.5s)、2.5×→1×(1.2s QuadOut)、重力1000px/s²弧线、vy=-(700±100)、±5°旋转、2s
// 治疗/格挡：减速上浮(2000px/s²)、2.2×→1×(0.5s)、1s后快速淡出、1.3s
function playFloatAnim(el: HTMLElement, kind: string) {
  if (!el.animate) return
  const inner = el.firstElementChild as HTMLElement | null
  if (kind === 'dmg') {
    const vx = (Math.random() * 2 - 1) * 100, vy = -(700 + Math.random() * 100)
    const frames: Keyframe[] = []
    for (let i = 0; i <= 20; i++) {
      const t = (i / 20) * 2
      const x = vx * t, y = vy * t + 1000 * t * t
      const sc = t < 1.2 ? 2.5 - 1.5 * (1 - (1 - t / 1.2) ** 2) : 1
      const op = 1 - (t / 2) ** 2
      frames.push({ offset: i / 20, transform: `translate(calc(-50% + ${x}px), ${y}px) scale(${sc})`, opacity: Math.max(0, op) })
    }
    el.animate(frames, { duration: 2000, easing: 'linear', fill: 'forwards' })
    inner?.animate?.([{ color: 'rgb(247,43,20)' }, { color: '#FFF6E2' }], { duration: 500, easing: 'cubic-bezier(.33,1,.68,1)', fill: 'forwards' })
  } else if (kind === 'heal' || kind === 'block') {
    const vx = (Math.random() * 2 - 1) * 60, vy = -(300 + Math.random() * 300)
    const frames: Keyframe[] = []
    for (let i = 0; i <= 20; i++) {
      const t = (i / 20) * 1.3
      const sp = Math.hypot(vx, vy), stop = sp / 2000, tt = Math.min(t, stop)
      const d = sp * tt - 1000 * tt * tt
      const x = (vx / sp) * d, y = (vy / sp) * d
      const sc = t < 0.5 ? 2.2 - 1.2 * (1 - (1 - t / 0.5) ** 2) : 1
      const op = t < 1 ? 1 : Math.max(0, 1 - ((t - 1) / 0.3) ** 2)
      frames.push({ offset: i / 20, transform: `translate(calc(-50% + ${x}px), ${y}px) scale(${sc})`, opacity: Math.max(0, op) })
    }
    el.animate(frames, { duration: 1300, easing: 'linear', fill: 'forwards' })
  } else {
    el.animate([
      { transform: 'translate(-50%, 6px) scale(.9)', opacity: 0 },
      { transform: 'translate(-50%, -14px) scale(1)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%, -46px) scale(1)', opacity: 0 },
    ], { duration: 1300, easing: 'cubic-bezier(.25,.6,.4,1)', fill: 'forwards' })
  }
}

// 意图执行爆发（原版 NIntent.PlayPerform：四份叠加副本 α0.27、间隔0.25s、1s 内 0.5→1.49）
const INTENT_ICON_MAP: Record<string, string> = {
  attack: 'attack3', attackDebuff: 'attack5', attackDefend: 'attack4',
  defend: 'defend', buff: 'buff', debuff: 'debuff', strongDebuff: 'debuffStrong',
  sleep: 'sleep', unknown: 'unknown',
}
function spawnIntentBurst(uid: string, type: string) {
  const enemyEl = document.querySelector(`.enemy[data-euid="${uid}"] .intent-slot`) as HTMLElement | null
  const holder = enemyEl || fxLayer
  const icon = A('intent/' + (INTENT_ICON_MAP[type] || 'unknown') + '.png')
  const wrap = document.createElement('div')
  wrap.className = 'intent-burst-wrap'
  for (let k = 0; k < 4; k++) {
    const b = document.createElement('div')
    b.className = 'intent-burst'
    b.style.animationDelay = (k * 0.25) + 's'
    b.innerHTML = `<img src="${icon}" width="44" height="44">`
    wrap.appendChild(b)
  }
  holder.appendChild(wrap)
  setTimeout(() => wrap.remove(), 1900)
}

// 洗牌黑色剪影（原版 NCardFlyShuffleVfx：8 张黑色小卡剪影自抽牌堆飞散旋转淡出）
function spawnShuffleFx() {
  const pileBtn = document.getElementById('pile-draw')
  const holder = pileBtn || fxLayer
  const wrap = document.createElement('div')
  wrap.className = 'shuffle-wrap'
  for (let k = 0; k < 8; k++) {
    const b = document.createElement('div')
    b.className = 'shuffle-card'
    b.style.animationDelay = (k * 0.05) + 's'
    wrap.appendChild(b)
  }
  holder.appendChild(wrap)
  setTimeout(() => wrap.remove(), 1300)
}

// 格挡破碎（原版 NBlockBrokenVfx：盾牌左右两半 0.4s 分离 + 0.6s 淡出）
function spawnBlockBreak(hpbarEl: HTMLElement) {
  const el = document.createElement('div')
  el.className = 'bb-break'
  el.innerHTML = `<img class="bb-l" src="${A('status/block.png')}" alt=""><img class="bb-r" src="${A('status/block.png')}" alt="">`
  hpbarEl.appendChild(el)
  setTimeout(() => el.remove(), 1050)
}

function renderNewFx() {
  const st = g()
  if (st.fxList.length === 0 && renderedFx.size > 0) renderedFx.clear()
  for (const f of st.fxList) {
    if (renderedFx.has(f.id)) continue
    renderedFx.add(f.id)
    // 受击闪白 / 屏幕震动（punch 模型 + 分档强度 + 受伤红晕）
    if (f.kind === 'shake') {
      const isPlayer = f.target === 'player' || f.target === 'p0' || f.target === 'p1'
      screenShake(f.value || 5, isPlayer)
      if (!isPlayer) enemyFlash(f.target)
    }
    if (f.kind === 'dmg') enemyFlash(f.target)
    if (f.kind === 'lunge') enemyLunge(f.target)
    if (f.kind === 'cardPlay' && f.text) cardPlayFx(f.text)
    if (f.kind === 'slash') spawnSlash(f.target)
    if (f.kind === 'orb') spawnOrbFx(f.text || '')
    if (f.kind === 'intentBurst') { spawnIntentBurst(f.target, f.text || ''); st.removeFx(f.id); continue }
    if (f.kind === 'shuffle') { spawnShuffleFx(); st.removeFx(f.id); continue }
    const pos = fxPositions[f.target]
    if (!pos) { st.removeFx(f.id); continue }
    const el = document.createElement('div')
    el.className = 'fx-float'
    let color = '#fff', content = '', size = 24
    if (f.kind === 'dmg') { color = '#F72B14'; content = String(f.value); size = 40 }
    else if (f.kind === 'heal') { color = 'rgb(35,247,20)'; content = '+' + f.value; size = 30 }
    else if (f.kind === 'block') { color = '#9ac8f0'; content = '+' + f.value; size = 26 }
    else if (f.kind === 'status') {
      content = `<img src="${A(statusImgKey(f.text || ''))}" width="26" height="26"><span style="color:${(f.value || 0) > 0 ? '#7fe08a' : '#ff8a7a'}">${(f.value || 0) > 0 ? '+' : ''}${f.value}</span>`
    } else if (f.kind === 'text' || f.kind === 'buff') { color = '#ffe9a0'; content = String(f.text); size = 20 }
    el.style.cssText = `left:${pos.x}px;top:${pos.y}px;color:${color};font-size:${size}px;white-space:nowrap;transform:translate(-50%,0);text-shadow:${f.kind === 'dmg' ? '2px 2px 0 #4a0a04,0 0 10px rgba(0,0,0,.6)' : '1px 1px 0 #000'}`
    // 随机旋转（±5°伤害 / ±3°治疗）内层
    const rot = f.kind === 'dmg' ? (Math.random() * 2 - 1) * 5 : f.kind === 'heal' || f.kind === 'block' ? (Math.random() * 2 - 1) * 3 : 0
    el.innerHTML = `<span style="display:inline-block;transform:rotate(${rot}deg)">${content}</span>`
    fxLayer.appendChild(el)
    playFloatAnim(el, f.kind)
    const ms = f.kind === 'dmg' ? 2000 : 1300
    setTimeout(() => { el.remove(); st.removeFx(f.id) }, ms)
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
    if (scr === 'mpLobby') {
      sigScreen(lobbySig(), () => rMpLobby())
      updateLobbyDynamics()
    }
    return
  }
  if (scr === 'mpLobby') {
    sigScreen(lobbySig(), () => rMpLobby())
    updateLobbyDynamics()
  }
  if (scr === 'combat') updateCombatScreen(run)
  else if (scr === 'map') { updateMapScreen(run); maybeActBanner(run) }
  else if (scr === 'reward') updateRewardScreen(run)
  else if (scr === 'shop') updateShopScreen(run)
  else if (scr === 'neow') sigScreen(`neow:${run.character}:${run.neow?.chosen ?? ''}:${run.neow?.options.map(o => o.id).join(',')}:${run.players.length}:${run.neow?.chooserIdx}:${run.neow?.mpOptions?.map(o => o.map(x => x.id).join('+')).join('|')}`, () => rNeow(run))
  else if (scr === 'actTransition') { /* 骨架已含 data-act=continueAct，自动推进 */ autoAdvanceAct() }
  else if (scr === 'event') {
    const evId = run.currentEvent ?? ''
    const first = lastEvTyped !== evId
    sigScreen(`event:${evId}:${g().eventMsg}:${run.gold}`, () => rEvent(run, first))
    // 新事件：启动打字机（仅事件切换时，结果消息更新不重播）
    if (first && run.currentEvent && EVENTS[run.currentEvent]) {
      lastEvTyped = evId
      startEvTypewriter(EVENTS[run.currentEvent].desc)
    }
  }
  else if (scr === 'rest') sigScreen(`rest:${run.hp}:${run.maxHp}:${run.relics.length}:${run.mpRest?.join(',') ?? ''}:${g().net.myIdx}`, () => rRest(run))
  else if (scr === 'treasure') sigScreen(`treasure:${run.pendingTreasureRelic ?? ''}`, () => rTreasure(run))
  else if (scr === 'bossRelic') sigScreen('bossRelic', () => rBossRelic(run))
  else if (scr === 'gameover' || scr === 'victory') sigScreen('gameover', () => rGameOver(run))
}

// ============ 锻造升级卡牌特效（原版 NCardUpgradeVfx） ============
// 升级卡 scale 0→1（0.25s CubicOut）+ 星光出现在屏幕中央，停 1.75s 后飞向牌组（缩小+旋转+淡出）
let upgradeFxShown = 0
function watchUpgradeFx() {
  const st = g()
  const fx = st.upgradeFx
  if (!fx || fx.ts === upgradeFxShown) return
  upgradeFxShown = fx.ts
  if (!CARDS[fx.id]) return
  const holder = document.getElementById('card-play-fx') || fxLayer
  const el = document.createElement('div')
  el.className = 'upgrade-vfx'
  el.innerHTML = `<div class="up-card">${cardHtml({ uid: fx.uid, id: fx.id, upgraded: 1 }, 230)}<div class="up-star"></div></div>`
  holder.appendChild(el)
  setTimeout(() => el.classList.add('flying'), 2000)
  setTimeout(() => { el.remove(); st.clearUpgradeFx() }, 2900)
}

// ============ 房间切换过渡（原版 NTransition：0.5s停顿→0.6s软边黑幕扫落+平黑淡入→全黑切换→0.8s淡出） ============
let roomFading = false
let roomFadePhase: 'out' | 'in' = 'out'
let roomFadeT1: ReturnType<typeof setTimeout> | null = null
let roomFadeT2: ReturnType<typeof setTimeout> | null = null

function killRoomFade() {
  if (roomFadeT1) clearTimeout(roomFadeT1)
  if (roomFadeT2) clearTimeout(roomFadeT2)
  roomFadeT1 = roomFadeT2 = null
  document.querySelectorAll('.room-fade').forEach(e => e.remove())
  roomFading = false
}

function applyScreenNow(scr: string, run: RunState | null) {
  curScreenKey = scr
  ;(app as any).__sig = ''
  app.innerHTML = buildScreen(scr, run)
  updateScreen(scr, run)
}

function makeFadeOverlay(phase: 'out' | 'in') {
  document.querySelectorAll('.room-fade').forEach(e => e.remove())
  const ov = document.createElement('div')
  ov.className = `room-fade ${phase}`
  ov.innerHTML = '<div class="rf-sweep"></div><div class="rf-black"></div>'
  stageEl.appendChild(ov)
}

function startRoomFade() {
  killRoomFade()
  roomFading = true
  roomFadePhase = 'out'
  makeFadeOverlay('out')
  roomFadeT1 = setTimeout(() => {
    // 全黑：读取最新目标画面切换
    const st = g()
    const s2 = st.run ? st.run.screen : (st.menuScreen || 'title')
    applyScreenNow(s2, st.run)
    roomFadePhase = 'in'
    makeFadeOverlay('in')
    roomFadeT2 = setTimeout(() => {
      document.querySelectorAll('.room-fade').forEach(e => e.remove())
      roomFading = false
      const st2 = g()
      const s3 = st2.run ? st2.run.screen : (st2.menuScreen || 'title')
      if (s3 !== curScreenKey) startRoomFade()
    }, 800)
  }, 1100)
}

function render() {
  const st = g()
  const run = st.run
  const scr = run ? run.screen : (st.menuScreen || 'title')
  if (!st.select) armPreviewUid = null
  if (!st.pileView && inspectUid !== null) { inspectUid = null; inspectClosing = false; inspectGen = 0 }
  updateMusic(st)
  lobbyWatchTick(scr)
  if (scr !== curScreenKey) {
    if (curScreenKey === '') {
      // 首次渲染不过渡
      applyScreenNow(scr, run)
    } else if (!roomFading) {
      // 正常房间切换：旧画面保持，黑幕扫落后再换
      startRoomFade()
      updateScreen(curScreenKey, run)
    } else if (roomFadePhase === 'in') {
      // 淡入途中再切换：直接换画面重播淡入
      applyScreenNow(scr, run)
      makeFadeOverlay('in')
      if (roomFadeT2) clearTimeout(roomFadeT2)
      roomFadeT2 = setTimeout(() => {
        document.querySelectorAll('.room-fade').forEach(e => e.remove())
        roomFading = false
        const st2 = g()
        const s3 = st2.run ? st2.run.screen : (st2.menuScreen || 'title')
        if (s3 !== curScreenKey) startRoomFade()
      }, 800)
    } else {
      // 黑幕 out 阶段：旧画面继续更新，切换时读最新
      updateScreen(curScreenKey, run)
    }
  } else {
    updateScreen(scr, run)
  }
  computeFxPositions()
  renderNewFx()
  watchUpgradeFx()
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

// ============ ACT 横幅（原版 NActBanner：黑带α0.25 + 天蓝幕数 450→440 + 金色幕名） ============
// 仅第 1 幕首次进入地图时展示（2-4 幕已有幕间过渡屏）；每幕新 map 对象只展示一次
let actBannerMap: object | null = null
const STS_ACT_NAMES: Record<number, string> = { 1: 'EXORDIUM · 外域' }
function maybeActBanner(run: RunState) {
  if (run.act !== 1 || actBannerMap === run.map) return
  actBannerMap = run.map
  const el = document.createElement('div')
  el.className = 'act-banner bye'
  el.innerHTML = `<div class="act-band"></div>
    <div class="act-num sts-title">第 1 幕</div>
    <div class="act-name">${STS_ACT_NAMES[run.act] ?? '第 1 幕'}</div>`
  stageEl.appendChild(el)
  setTimeout(() => el.remove(), 5000)
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
  el.innerHTML = `<div class="sts-panel" style="padding:28px 50px;display:flex;flex-direction:column;gap:12px;min-width:380px;align-items:center">
    <div class="sts-title" style="font-size:25px;color:#ffd980;letter-spacing:6px;margin-bottom:4px">菜 单</div>
    <button class="sts-btn sts-title" data-act="closeMenu" style="font-size:19px;padding:9px 66px;min-width:240px">继 续 游 戏</button>
    <button class="sts-btn sts-title" data-act="menuSettings" style="font-size:19px;padding:9px 66px;min-width:240px">设　　置</button>
    <div id="ingame-menu-settings" style="display:none;flex-direction:column;gap:11px;width:100%;padding:12px 14px;background:rgba(0,0,0,.3);border-radius:10px;border:1px solid rgba(90,64,32,.5)">
      <div class="row" style="gap:10px"><span class="sts-body" style="color:#c8b090;width:78px;font-size:14px">音乐音量</span>
        <input type="range" data-input="musicVol" min="0" max="1" step="0.05" value="${music.volume}" style="flex:1;accent-color:#c8a060">
        <span class="sts-body" style="color:#d8c8a8;width:30px;font-size:13px" id="menu-vol-label">${music.muted ? 0 : Math.round(music.volume * 100)}</span></div>
      <div class="row" style="gap:10px"><span class="sts-body" style="color:#c8b090;width:78px;font-size:14px">音效音量</span>
        <input type="range" data-input="sfxVol" min="0" max="1" step="0.05" value="${sfx.volume}" style="flex:1;accent-color:#c8a060">
        <span class="sts-body" style="color:#d8c8a8;width:30px;font-size:13px">${Math.round(sfx.volume * 100)}</span></div>
      <div class="row" style="gap:10px"><span class="sts-body" style="color:#c8b090;width:78px;font-size:14px">静音</span>
        <button class="sts-btn sts-body" data-act="menuMute" style="font-size:13px;padding:5px 18px">${music.muted ? '已静音（点击开启）' : '开启中（点击静音）'}</button></div>
      <div class="row" style="gap:10px"><span class="sts-body" style="color:#c8b090;width:78px;font-size:14px">联机昵称</span>
        <input class="sts-body" data-input="mpName" value="${esc(loadSettings().playerName)}" maxlength="10" placeholder="联机时显示的名字"
          style="flex:1;background:rgba(0,0,0,.5);border:1.5px solid #6b4a2e;border-radius:8px;color:#e8d8b8;padding:7px 12px;font-size:14px"></div>
      <div class="row" style="gap:10px"><span class="sts-body" style="color:#c8b090;width:78px;font-size:14px">全屏</span>
        <button class="sts-btn sts-body" data-act="fullscreen" style="font-size:13px;padding:5px 18px">切换全屏</button></div>
    </div>
    ${mp
      ? `<button class="sts-btn sts-title" data-act="mpLeaveMenu" style="font-size:19px;padding:9px 66px;min-width:240px;color:#ffa898">退出联机房间</button>`
      : `<button class="sts-btn sts-title" data-act="abandon" data-confirm="0" id="abandon-btn" style="font-size:19px;padding:9px 66px;min-width:240px;color:#e8d8b8">放 弃 本 局</button>`}
    <button class="sts-btn sts-title" data-act="backTitle" style="font-size:19px;padding:9px 66px;min-width:240px">${mp ? '返回主菜单（断开联机）' : '返回主菜单'}</button>
    <div class="sts-body" style="color:#8a7458;font-size:12px;margin-top:2px">第 ${st.run.act} 幕 · 第 ${Math.max(1, st.run.visitedNodes.length)} 层${mp ? ' · 联机合作中' : ' · 进度已自动保存'}</div>
  </div>`
  stageEl.appendChild(el)
  // 打开菜单时若已展开设置面板则收起（重新打开默认收起）
  const settingsPanel = el.querySelector('#ingame-menu-settings') as HTMLElement | null
  if (settingsPanel) settingsPanel.style.display = 'none'
}

// ============ 全局键盘快捷键（还原原版：1-9 出牌 / E·空格·回车 结束回合 / Esc 菜单） ============
function setupKeyboard() {
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const tgt = e.target as HTMLElement
    if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return
    const st = g()
    // 检视屏导航（原版 NInspectCardScreen：←/→ 切卡，Enter/空格 升级预览）
    if (inspectUid && st.pileView) {
      if (e.key === 'ArrowLeft') { doInspectStep(-1); e.preventDefault(); return }
      if (e.key === 'ArrowRight') { doInspectStep(1); e.preventDefault(); return }
      if (e.key === 'Enter' || e.key === ' ') { doInspectToggle(); e.preventDefault(); return }
    }
    // Esc：检视 → 牌堆 → 菜单（逐层关闭，不抢占）
    if (e.key === 'Escape') {
      if (inspectUid) { doInspectClose(); e.preventDefault(); return }
      if (st.run) {
        if (st.pileView || st.select || st.busy) return
        g().toggleMenu(); e.preventDefault(); return
      }
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
  // 第二十三批：顶栏 settings 齿轮（原版 TopPanel.renderSettingsIcon 位）
  toggleMenu: () => {
    const st = g()
    if (!st.run) return
    st.toggleMenu()
  },
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
  mpJoinRoom: (el) => {
    const name = (document.getElementById('mp-name') as HTMLInputElement)?.value?.trim() || loadSettings().playerName
    const code = el.dataset.code || ''
    if (code.length < 4) return
    g().netJoinRoom(name, code)
  },
  mpRefresh: () => {
    net.listRooms().catch(() => { lobbySrvOk = false; updateLobbyDynamics() })
  },
  mpSrvToggle: () => {
    lobbyShowSrv = !lobbyShowSrv
    sigScreen(lobbySig(), () => rMpLobby())
    updateLobbyDynamics()
  },
  mpMode: (el) => {
    if (g().net.role) return   // 房间内不允许切换
    const m = el.dataset.mode === 'p2p' ? 'p2p' : 'server'
    if (m !== netMode()) {
      setNetMode(m)
      lobbySrvOk = null
      lobbyRooms = []
      sigScreen(lobbySig(), () => rMpLobby())
      lobbyWatchTick('mpLobby')
    }
  },
  mpSrvSave: () => {
    const input = document.querySelector('[data-input="mpSrv"]') as HTMLInputElement | null
    setServerUrl(input?.value || '')
    location.reload()
  },
  mpLeave: () => g().netLeave(),
  lobbyPick: (el) => g().lobbyPickChar(el.dataset.char as any),
  lobbyStart: () => g().lobbyStart(),
  mpSkipCard: () => g().mpSkipCard(),
  pickChar: (el) => {
    const c = el.dataset.char as CharacterId
    if (c && CHARACTER_INFO[c]) {
      selectedChar = c
      // 差异更新角色选择界面（修复：旧代码误渲染 rTitle 导致退回主菜单）
      sigScreen('charSelect:' + c, () => rCharSelect())
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
  chooseNode: (el) => {
    // 选点墨迹（原版：先逐朵点亮 0.55s 再跳转，与房间黑幕时序对齐）
    const id = el.dataset.id!
    if (mapInking) return
    const r = g().run
    if (!r) return
    const from = r.currentNodeId ?? ''
    if (from) {
      mapInking = true
      const dots = [...document.querySelectorAll(`#map-dots .map-dot[data-edge="${from}>${id}"]`)] as HTMLElement[]
      const per = Math.min(0.55 / Math.max(dots.length, 1), 0.1)
      dots.forEach(d => {
        const k = Number(d.dataset.idx || 1)
        d.style.transitionDelay = (k * per).toFixed(3) + 's'
        d.classList.add('traveled')
      })
      const nodeEl = document.querySelector(`#map-nodes [data-nid="${id}"]`)
      nodeEl?.classList.add('map-select')
      setTimeout(() => { mapInking = false; g().chooseNode(id) }, 550)
    } else {
      // 首次移动：无路径可墨迹（原版行为），仍延迟与黑幕对齐
      mapInking = true
      const nodeEl = document.querySelector(`#map-nodes [data-nid="${id}"]`)
      nodeEl?.classList.add('map-select')
      setTimeout(() => { mapInking = false; g().chooseNode(id) }, 550)
    }
  },
  clickCard: (el) => g().clickCard(el.dataset.uid!),
  clickEnemy: (el) => g().clickEnemy(el.dataset.uid!),
  endTurn: () => g().endTurn(),
  openPile: (el) => { inspectUid = null; inspectGen = 0; g().openPile(el.dataset.pile as any) },
  closePile: () => { inspectUid = null; inspectGen = 0; g().closePile() },
  inspectOpen: (el) => {
    inspectUid = el.dataset.uid || null
    inspectGen = 0
    inspectDir = 0
    inspectClosing = false
    const st = g()
    if (st.run && st.pileView) {
      const c = pileCardsOf(st.run, st.pileView).find(x => x.uid === inspectUid)
      inspectTicked = !!c && c.upgraded > 0
    }
    inspectRerender()
  },
  inspectStep: (el) => doInspectStep(Number(el.dataset.dir || 1)),
  inspectToggle: () => doInspectToggle(),
  inspectClose: () => doInspectClose(),
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
  rest: (el) => {
    const act = el.dataset.r as any
    const r = g().run
    if (!r) return
    // 单人休息：先播放去饱和+烟雾（原版 NDesaturateTransitionVfx + NRestSmokeVfx）再结算
    if (act === 'rest' && r.players.length === 1) {
      const scr = document.querySelector('.rest-bg')
      if (scr && !scr.classList.contains('resting')) {
        scr.classList.add('resting')
        const slot = scr.querySelector('.smoke-slot') as HTMLElement | null
        if (slot) {
          slot.style.display = ''
          for (let k = 0; k < 4; k++) {
            const p = document.createElement('div')
            p.className = 'smoke-puff'
            p.style.animationDelay = (k * 0.42) + 's'
            p.style.left = (38 + k * 8) + '%'
            slot.appendChild(p)
          }
        }
        const label = scr.querySelector('.rest-label')
        if (label) label.textContent = '休息中…'
        setTimeout(() => g().restAction(act), 2100)
        return
      }
      if (scr?.classList.contains('resting')) return
    }
    g().restAction(act)
  },
  chooseEvent: (el) => g().chooseEvent(Number(el.dataset.idx)),
  takeTreasure: () => g().takeTreasure(),
  openTreasure: () => g().openTreasure(),
  confirmTreasure: () => g().confirmTreasure(),
  resolveSelect: (el) => { armPreviewUid = null; g().resolveSelect(el.dataset.uid!) },
  armPreview: (el) => {
    armPreviewUid = el.dataset.uid || null
    const layer = document.getElementById('overlay-layer')
    if (layer) { (layer as any).__sig = ''; renderOverlays(g()) }
  },
  cancelSelect: () => { armPreviewUid = null; g().cancelSelect() },
  potion: (el) => {
    const st = g()
    const idx = Number(el.dataset.idx)
    const pid = st.run?.potions[idx]
    if (!pid) return
    lastPotAct = 'use'
    // 非战斗场景（地图）：直接使用；战斗中：先选中再点目标（防误触）
    if (!st.run?.combat) { g().usePotionMap(idx); return }
    useGame.setState({ selectedPotionIdx: st.selectedPotionIdx === idx ? null : idx })
  },
  potionDiscard: (el) => { lastPotAct = 'discard'; g().discardPotion(Number(el.dataset.idx)) },
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
  // 地图图例：悬停条目 → 高亮同类节点（原版 S.highlight 机制）
  const lg = (e.target as HTMLElement).closest('.lg-item') as HTMLElement | null
  if (lg && lg.dataset.ltype) {
    document.querySelectorAll('.lg-item.lg-hot').forEach(x => x.classList.remove('lg-hot'))
    lg.classList.add('lg-hot')
    document.querySelectorAll('#map-nodes .node').forEach((n: Element) => {
      n.classList.toggle('map-hover', (n as HTMLElement).dataset.ntype === lg.dataset.ltype)
    })
  } else if (document.querySelector('.lg-item.lg-hot')) {
    document.querySelectorAll('.lg-item.lg-hot').forEach(x => x.classList.remove('lg-hot'))
    document.querySelectorAll('#map-nodes .node.map-hover').forEach(x => x.classList.remove('map-hover'))
  }
})
document.addEventListener('mousemove', (e) => {
  if (tipEl.style.display === 'block') {
    const pad = 14
    let x = e.clientX + pad, y = e.clientY + pad
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight
    if (x + w > innerWidth - 8) x = e.clientX - w - pad
    if (y + h > innerHeight - 8) y = e.clientY - h - pad
    // 钳制在屏幕内（修复手机端窄屏提示框跑出屏幕）
    if (w >= innerWidth - 16) x = (innerWidth - w) / 2
    else x = Math.max(8, Math.min(innerWidth - w - 8, x))
    if (h >= innerHeight - 16) y = (innerHeight - h) / 2
    else y = Math.max(8, Math.min(innerHeight - h - 8, y))
    tipEl.style.left = x + 'px'
    tipEl.style.top = y + 'px'
  }
})
// 触屏：轻点显示提示 2 秒（上方优先，放不下改下方；整体钳制在屏幕内）
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
    let x = r.left + r.width / 2 - w / 2
    let y = r.top - h - 10
    if (y < 8) y = r.bottom + 10                    // 上方放不下 → 移到下方
    if (w >= innerWidth - 16) x = (innerWidth - w) / 2
    else x = Math.max(8, Math.min(innerWidth - w - 8, x))
    if (h >= innerHeight - 16) y = (innerHeight - h) / 2
    else y = Math.max(8, Math.min(innerHeight - h - 8, y))
    tipEl.style.left = x + 'px'
    tipEl.style.top = y + 'px'
  })
  if (tipTimer) clearTimeout(tipTimer)
  tipTimer = setTimeout(() => { tipEl.style.display = 'none' }, 2000)
}, { passive: true })

// ============ 控制簇（音乐 + 全屏，舞台右上角） ============
function setupControls() {
  // 原版交互音效（全局委托）：按钮=UIClick / 地图节点悬停=MapHover / 手牌悬停=CardSelect
  document.addEventListener('click', (e) => {
    const el = e.target as HTMLElement | null
    if (!el) return
    if (el.closest('.sts-btn, .menu-btn')) sfx.play('uiClick')
    else if (el.closest('.pile-btn')) sfx.play('deckOpen')
  })
  document.addEventListener('mouseover', (e) => {
    const el = e.target as HTMLElement | null
    if (!el) return
    const node = el.closest('#map-nodes [data-nid]') as HTMLElement | null
    if (node && !node.hasAttribute('data-sfx-hov')) {
      node.setAttribute('data-sfx-hov', '1')
      setTimeout(() => node.removeAttribute('data-sfx-hov'), 350)
      sfx.play('mapHover')
      return
    }
    const card = el.closest('.hand-card') as HTMLElement | null
    if (card && !card.hasAttribute('data-sfx-hov')) {
      card.setAttribute('data-sfx-hov', '1')
      setTimeout(() => card.removeAttribute('data-sfx-hov'), 350)
      sfx.play('cardSelect')
    }
  })

  const wrap = document.createElement('div')
  // 第二十三批：改竖排（原横排 ~130px 宽会遮挡顶栏 settings/deck 图标区 right:104）
  wrap.style.cssText = 'position:absolute;top:10px;right:10px;z-index:500;display:flex;flex-direction:column;gap:6px;align-items:center'

  // 第二十三批：齿轮菜单入口移至顶栏 settings 齿轮（topHudShell）；此处不再创建旧 ⚙ 按钮
  // （旧按钮 top:10 right:10 与顶栏 settings 图标位置重叠）

  // 旋转 180 度按钮（仅触屏设备；点击后整个画面翻转 180 度，适配手机倒拿场景）
  if (typeof matchMedia !== 'undefined' && matchMedia('(hover: none)').matches) {
    const rotBtn = document.createElement('button')
    rotBtn.className = 'sts-btn'
    rotBtn.style.cssText = 'font-size:15px;padding:4px 10px;min-width:38px'
    rotBtn.textContent = '🔄'
    rotBtn.title = '旋转 180 度（手机倒拿时点此翻转画面）'
    const syncRotIcon = () => { rotBtn.style.transform = stageFlipped ? 'rotate(180deg)' : '' }
    syncRotIcon()
    rotBtn.addEventListener('click', () => {
      stageFlipped = !stageFlipped
      saveFlip(stageFlipped)
      fitStage()
      syncRotIcon()
    })
    wrap.appendChild(rotBtn)
  }

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
  panel.style.cssText = 'position:absolute;right:130px;top:0;display:none;align-items:center;gap:8px;background:rgba(12,8,5,.92);border:1px solid #6b4a2e;border-radius:8px;padding:8px 12px;box-shadow:0 4px 16px rgba(0,0,0,.6)'
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
  if (kind === 'sfxVol') {
    const v = Number((el as HTMLInputElement).value)
    sfx.setVolume(v)
    const lb = document.getElementById('sfxvol-label')
    if (lb) setText(lb, String(Math.round(v * 100)))
  }
})

// ============ 启动 ============
// 原版字体急切预载（Next.js 版由 next/font preload 完成；此处对齐：消除首次使用时的回退字体闪烁）
if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
  for (const spec of ['400 16px Kreon', '700 16px Kreon', '500 16px "Source Han Serif SC"', '700 16px "Source Han Serif SC"']) {
    document.fonts.load(spec).catch(() => {})
  }
}
setupStage()
setupControls()
setupKeyboard()
// 房间大厅列表订阅（服务器推送 → 差异更新，不重建整屏）
net.onRooms(list => {
  lobbyRooms = list || []
  if (lobbySrvOk !== true) lobbySrvOk = true
  updateLobbyDynamics()
})
useGame.subscribe(render)
render()
console.log('[STS standalone] 游戏就绪 v1.14（单人 + 联机合作 · 服务器中转/P2P双通道 + 房间大厅）')



