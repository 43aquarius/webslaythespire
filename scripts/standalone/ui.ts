// ============ 单文件版 UI（原生 JS，区域化渲染修复闪动） ============
// 架构：1600×900 舞台等比缩放 + 屏幕切换时构建骨架 + 状态更新时仅差异更新区域
// 修复：innerHTML 全量重建导致的画面闪动；补上选牌/牌堆遮罩渲染
import { useGame } from '@/store/gameStore'
import { CARDS, cardCost, cardDesc } from '@/game/cards'
import { ENEMIES } from '@/game/enemies'
import { RELICS } from '@/game/relics'
import { POTIONS } from '@/game/potions'
import { enemyDisplayDamage } from '@/game/engine'
import { EVENTS } from '@/game/events'
import type { RunState, CombatState, CardInstance, EnemyInstance } from '@/game/types'

declare const ASSETS: Record<string, string>
const A = (k: string) => ASSETS[k] || ''

// 状态图标映射（修复缺失素材：angry→anger、metallicizeE→metallicize、asleep→意图 Zzz）
const STATUS_IMG_FIX: Record<string, string> = {
  angry: 'status/anger.png',
  metallicizeE: 'status/metallicize.png',
  asleep: 'intent/sleep.png',
}
function statusImgKey(id: string): string {
  return STATUS_IMG_FIX[id] || ('status/' + id + '.png')
}

const STATUS_INFO: Record<string, { name: string; desc: string; buff?: boolean }> = {
  strength: { name: '力量', desc: '每点力量使攻击伤害 +1。', buff: true },
  dexterity: { name: '敏捷', desc: '每点敏捷使获得的格挡 +1。', buff: true },
  vulnerable: { name: '易伤', desc: '受到的攻击伤害 ×1.5。每回合结束 -1。' },
  weak: { name: '虚弱', desc: '造成的攻击伤害 ×0.75。每回合结束 -1。' },
  frail: { name: '脆弱', desc: '获得的格挡 ×0.75。每回合结束 -1。' },
  thorns: { name: '尖刺', desc: '被攻击时对攻击者造成 N 点伤害。', buff: true },
  metallicize: { name: '金属化', desc: '回合结束时获得 N 点格挡。', buff: true },
  regen: { name: '回复', desc: '回合开始时回复 N 点生命，然后 -1。', buff: true },
  ritual: { name: '仪式', desc: '回合开始时获得 N 点力量。', buff: true },
  demonForm: { name: '恶魔形态', desc: '回合开始时获得 N 点力量。', buff: true },
  barricade: { name: '壁垒', desc: '格挡不再在回合开始时消失。', buff: true },
  brutality: { name: '残暴', desc: '回合开始时失去 1 点生命并抽 1 张牌。', buff: true },
  corruption: { name: '堕落', desc: '技能牌费用为 0，打出后消耗。', buff: true },
  combust: { name: '燃烧', desc: '回合结束时失去 1 点生命，对所有敌人造成 N 点伤害。', buff: true },
  darkEmbrace: { name: '暗黑拥抱', desc: '每当有牌被消耗时抽 1 张牌。', buff: true },
  evolve: { name: '进化', desc: '抽到状态牌时额外抽 N 张牌。', buff: true },
  feelNoPain: { name: '无痛', desc: '每当有牌被消耗时获得 N 点格挡。', buff: true },
  fireBreathing: { name: '火焰吐息', desc: '抽到状态/诅咒牌时对所有敌人造成 N 点伤害。', buff: true },
  rupture: { name: '破裂', desc: '因打牌失去生命时获得 N 点力量。', buff: true },
  juggernaut: { name: '主宰', desc: '获得格挡时对随机敌人造成 N 点伤害。', buff: true },
  berserk: { name: '狂暴', desc: '回合开始时获得 1 点能量。', buff: true },
  rage: { name: '狂怒', desc: '本回合每打出一张攻击牌获得 N 点格挡。', buff: true },
  doubleTap: { name: '连击', desc: '接下来 N 张攻击牌被打出两次。', buff: true },
  noDraw: { name: '无法抽牌', desc: '本回合无法再抽牌。' },
  angry: { name: '激怒', desc: '你每打出一张技能牌，获得 N 点力量。' },
  asleep: { name: '沉睡', desc: '沉睡中，受到攻击会立即醒来。' },
  curlUp: { name: '蜷缩', desc: '首次受到攻击伤害时获得 N 点格挡。' },
  metallicizeE: { name: '金属化', desc: '回合结束时获得 N 点格挡。' },
  flameBarrier: { name: '火焰屏障', desc: '本回合被攻击时对攻击者造成 N 点伤害。', buff: true },
  modeShift: { name: '模式切换', desc: '守卫者的防御模式，格挡攒满后切换攻击模式。' },
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

function fitStage() {
  const k = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H)
  stageEl.style.transform = `translate(-50%, -50%) scale(${k})`
  const rp = document.getElementById('rotate-prompt')
  if (rp) rp.style.display = (window.innerHeight > window.innerWidth && Math.min(window.innerWidth, window.innerHeight) < 760) ? 'flex' : 'none'
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
  // 竖屏提示
  const rp = document.createElement('div'); rp.id = 'rotate-prompt'
  rp.innerHTML = `<div class="rotate-phone"></div>
    <div class="sts-title" style="font-size:30px;color:#ffd980;text-shadow:2px 2px 0 #000">请横屏游玩</div>
    <div class="sts-body" style="color:#a89070;font-size:15px;line-height:1.8;text-align:center">杀戮尖塔为横屏游戏<br>旋转设备以获得最佳体验</div>`
  document.body.appendChild(rp)
  stageEl = stage
  fxLayer = fx
  fitStage()
  window.addEventListener('resize', fitStage)
  window.addEventListener('orientationchange', fitStage)
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
  if (scr === 'shop') key = 'merchant'
  else if (scr === 'event') key = 'shrine'
  else if (scr === 'bossRelic') key = 'credits'
  else if (scr === 'combat') {
    const c = run.combat
    key = c?.isBoss ? 'boss' : c?.isElite ? 'elite' : 'level'
  }
  music.play(key)
}

// ============ 卡牌 HTML ============
function raritySuffix(rarity: string): string {
  if (rarity === 'rare') return 'Rare'
  if (rarity === 'uncommon') return 'Uncommon'
  return 'Common'
}
const TYPE_BG: Record<string, string> = {
  attack: 'frames/bgAttackRed.png',
  skill: 'frames/bgSkillRed.png',
  power: 'frames/bgPowerRed.png',
}

// 卡面内容（不含外层 .sts-card 包装，供手牌做差异更新）
function cardInner(card: CardInstance, width = 148): string {
  const def = CARDS[card.id]
  if (!def) return ''
  const rar = raritySuffix(def.rarity)
  const cost = cardCost(card, 0)
  const desc = cardDesc(card)
  const up = card.upgraded > 0
  return `<img class="c512" src="${A(TYPE_BG[def.type])}" alt="">
  <img src="${A('cardart/' + card.id + '.png')}" alt="" style="position:absolute;object-fit:cover;left:4%;top:11.5%;width:87.6%;height:49%;border-radius:3px">
  <img class="c512" src="${A('frames/frame' + def.type[0].toUpperCase() + def.type.slice(1) + rar + '.png')}" alt="">
  <img class="c512" src="${A('frames/banner' + rar + '.png')}" alt="">
  <div class="sts-title card-name" style="font-size:${width * 0.088}px;color:${rar === 'Rare' ? '#ffd98a' : '#ffe9c4'}">${esc(def.name)}</div>
  ${cost !== -99 ? `<img class="c512" src="${A('frames/cardRedOrb.png')}" alt="">
  <div class="sts-title card-cost" style="font-size:${width * 0.115}px">${cost === -1 ? 'X' : cost}</div>` : ''}
  <div class="sts-body card-desc" style="font-size:${width * 0.076}px">${up ? '<span style="color:#7fe08a">+ </span>' : ''}${esc(desc)}</div>
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
  setText(deck, String(run.deck.length))
  updateHpBar(document.getElementById('hud-hp'), run.hp, run.maxHp, combat ? (run.combat?.player.block ?? 0) : 0)
  const floorEl = document.getElementById('hud-floor')
  if (floorEl) {
    if (combat) floorEl.style.display = 'none'
    else { floorEl.style.display = ''; setText(floorEl, `第 1 幕 · 第 ${run.visitedNodes.length} 层`) }
  }
  setText(document.getElementById('hud-gold'), `💰 ${run.gold}`)
  setHtml(document.getElementById('hud-potions'), run.potions.map((p, i) => potionHtml(p, i, combat)).join(''))
  setHtml(document.getElementById('hud-relics'), run.relics.map(id => relicIcon(id)).join(''))
}

// ============ 标题 ============
function rTitle(): string {
  return `<div class="screen bg-cover" style="background-image:url('${A('bg/combat.jpg')}')">
  <div class="shade"></div>
  <div class="center-col">
    <img src="${A('hero/ironclad.png')}" alt="ironclad" style="width:300px;filter:drop-shadow(0 14px 22px rgba(0,0,0,.8))">
    <h1 class="sts-title game-title">杀戮尖塔</h1>
    <div class="sts-title subtitle">—— SLAY THE SPIRE · WEB 复刻版 ——</div>
    <button class="sts-btn" data-act="startRun" style="font-size:28px;padding:14px 60px;margin-top:18px">开始攀登</button>
    <div class="sts-body hint">扮演铁甲战士，征服第一幕的尖塔。<br>60+ 张卡牌 · 26 件遗物 · 14 种药水 · 15 种敌人 · 3 位首领</div>
  </div>
</div>`
}

// ============ 战斗界面（骨架 + 区域更新） ============
function buildCombatScreen(): string {
  return `<div class="screen bg-cover" id="combat-screen" data-bg="1" style="background-image:url('${A('bg/combat.jpg')}')">
  ${topHudShell()}
  <div class="player-zone">
    <div class="player-fx-slot" id="player-fx-slot"></div>
    <div id="player-status"></div>
    <img src="${A('hero/ironclad.png')}" alt="" style="width:240px;filter:drop-shadow(0 8px 10px rgba(0,0,0,.5))">
  </div>
  <div class="enemies-row" id="enemies-row"></div>
  <div id="hint-holder"></div>
  <button class="pile-btn" id="pile-draw" data-act="openPile" data-pile="draw" style="left:26px;bottom:158px"><b>0</b><span>抽牌堆</span></button>
  <button class="pile-btn" id="pile-discard" data-act="openPile" data-pile="discard" style="right:26px;bottom:158px"><b>0</b><span>弃牌堆</span></button>
  <span id="exhaust-holder"></span>
  <div class="energy" id="energy-box"><img src="${A('frames/redEnergy.png')}" alt=""><span id="energy-num"></span></div>
  <button class="sts-btn end-turn sts-title" data-act="endTurn" id="end-turn-btn"></button>
  <div class="hand-row" id="hand-row"></div>
  <div id="banner-holder"></div>
</div>`
}

function intentHtml(e: EnemyInstance, c: CombatState): string {
  if (!e.intent || e.dying) return ''
  const it = e.intent
  const { dmg, times } = enemyDisplayDamage(e, c.player.statuses)
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
      ${(it.type === 'attackDebuff' || it.type === 'attackDefend') ? `<img src="${A('intent/' + (it.type === 'attackDebuff' ? 'debuff' : 'defend') + '.png')}" width="28" height="28">` : ''}`
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
  const n = c.hand.length
  const mid = (n - 1) / 2
  const playableNow = c.phase === 'player' && !st.busy && !c.combatOver
  const seen = new Set<string>()
  c.hand.forEach((card, i) => {
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
    const sig = `${card.id}|${card.upgraded}|${cardCost(card, c.player.hpLostThisCombat)}`
    if ((cardEl as any).__sig !== sig) {
      (cardEl as any).__sig = sig
      cardEl.innerHTML = cardInner(card, 168)
    }
    const cost = cardCost(card, c.player.hpLostThisCombat)
    const enough = cost === -1 ? true : c.player.energy >= Math.max(0, cost)
    const cls = 'sts-card ' + (playableNow && enough ? 'playable' : 'dimmed')
    if (cardEl.className !== cls) cardEl.className = cls
  })
  row.querySelectorAll('[data-cuid]').forEach(el => {
    if (!seen.has((el as HTMLElement).dataset.cuid!)) el.remove()
  })
}

function updateCombatScreen(run: RunState) {
  const c = run.combat
  if (!c) return
  const st = g()
  updateHud(run, true)
  setHtml(document.getElementById('player-status'), statusRow(c.player.statuses, 30))
  updateEnemies(run)
  updateHand(run)
  setText(document.getElementById('energy-num'), String(c.player.energy))
  const pd = document.getElementById('pile-draw')
  if (pd) setText(pd.querySelector('b'), String(c.drawPile.length))
  const pc = document.getElementById('pile-discard')
  if (pc) setText(pc.querySelector('b'), String(c.discardPile.length))
  setHtml(document.getElementById('exhaust-holder'), c.exhaustPile.length > 0
    ? `<button class="pile-btn small" data-act="openPile" data-pile="exhaust" style="right:26px;bottom:88px"><b>${c.exhaustPile.length}</b><span>消耗堆</span></button>` : '')
  const et = document.getElementById('end-turn-btn') as HTMLButtonElement | null
  if (et) {
    const dis = c.phase !== 'player' || st.busy
    et.disabled = dis || c.combatOver
    et.style.opacity = dis ? '0.5' : '1'
    setText(et, c.phase === 'player' ? '结束回合' : '敌方回合…')
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
  const rows: string[] = []
  if (r.gold !== undefined) {
    rows.push(`<button class="reward-row ${r.taken.includes('gold') ? 'done' : ''}" data-act="takeGold">
      <img src="${A('mapicons/treasure.png')}" width="42" height="42"><span class="gold-text">${r.gold} 金币</span>${r.taken.includes('gold') ? '' : '<i>点击获取</i>'}</button>`)
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
  if (r.cards?.length) {
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
  setText(document.getElementById('shop-gold'), `💰 ${run.gold}`)
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
      setHtml(el.querySelector('.shop-price'), shopPriceTag(item.sold, item.price, run.gold))
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
      setHtml(el.querySelector('.shop-price'), shopPriceTag(item.sold, item.price, run.gold))
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
      setHtml(el.querySelector('.shop-price'), shopPriceTag(item.sold, item.price, run.gold))
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
      const dis = (ch.effect === 'cleric_heal' && run.gold < 35) || (ch.effect === 'cleric_purify' && run.gold < 50)
      return `<button class="sts-btn event-btn ${dis ? 'dis' : ''}" data-act="chooseEvent" data-idx="${i}">${esc(ch.text)}</button>`
    }).join('')}</div>
  </div>
</div>`
}

function rGameOver(run: RunState): string {
  const info = run.gameOverInfo!
  return `<div class="screen gameover-bg center-col">
  <div class="sts-title" style="font-size:64px;color:${info.victory ? '#ffd980' : '#c85040'};text-shadow:4px 4px 0 #000">${info.victory ? '第一幕 通关！' : '你死了'}</div>
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

// ============ 遮罩层（牌堆查看 / 选牌） ============
function overlayHtml(st: ReturnType<typeof g>): { html: string; sig: string } {
  const run = st.run
  if (!run) return { html: '', sig: '' }
  if (st.pileView) {
    const pile = st.pileView
    const titles: Record<string, string> = { draw: '抽牌堆（随机排序）', discard: '弃牌堆', exhaust: '消耗堆', deck: '牌组' }
    let cards: CardInstance[] = []
    if (pile === 'draw') cards = [...(run.combat?.drawPile ?? [])].reverse()
    else if (pile === 'discard') cards = [...(run.combat?.discardPile ?? [])].reverse()
    else if (pile === 'exhaust') cards = [...(run.combat?.exhaustPile ?? [])]
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
      : sel.source === 'hand' ? (run.combat?.hand ?? [])
        : (run.combat?.discardPile ?? [])
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
  const pz = document.querySelector('.player-zone')
  if (pz) {
    const r = pz.getBoundingClientRect()
    fxPositions['player'] = { x: (r.left + r.width / 2 - sr.left) / k, y: (r.top + 50 - sr.top) / k }
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

function renderNewFx() {
  const st = g()
  if (st.fxList.length === 0 && renderedFx.size > 0) renderedFx.clear()
  for (const f of st.fxList) {
    if (renderedFx.has(f.id)) continue
    renderedFx.add(f.id)
    // 受击闪白 / 屏幕震动（Web Animations API，不重建 DOM）
    if (f.kind === 'shake') {
      if (f.target === 'player') screenShake()
      else enemyFlash(f.target)
    }
    if (f.kind === 'dmg') enemyFlash(f.target)
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
  if (scr === 'title' || !run) return rTitle()
  if (scr === 'map') return buildMapScreen()
  if (scr === 'combat') return buildCombatScreen()
  if (scr === 'reward') return buildRewardScreen()
  if (scr === 'shop') return buildShopScreen()
  return '' // 简单界面由 sigScreen 构建
}

function sigScreen(sig: string, build: () => string) {
  const a = app as any
  if (a.__sig !== sig) { a.__sig = sig; app.innerHTML = build() }
}

function updateScreen(scr: string, run: RunState | null) {
  if (!run) return
  if (scr === 'combat') updateCombatScreen(run)
  else if (scr === 'map') updateMapScreen(run)
  else if (scr === 'reward') updateRewardScreen(run)
  else if (scr === 'shop') updateShopScreen(run)
  else if (scr === 'event') sigScreen(`event:${run.currentEvent}:${g().eventMsg}:${run.gold}`, () => rEvent(run))
  else if (scr === 'rest') sigScreen(`rest:${run.hp}:${run.maxHp}:${run.relics.length}`, () => rRest(run))
  else if (scr === 'treasure') sigScreen('treasure', () => rTreasure())
  else if (scr === 'bossRelic') sigScreen('bossRelic', () => rBossRelic(run))
  else if (scr === 'gameover' || scr === 'victory') sigScreen('gameover', () => rGameOver(run))
}

function render() {
  const st = g()
  const run = st.run
  const scr = run ? run.screen : 'title'
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
}

// ============ 事件委托 ============
const ACTIONS: Record<string, (el: HTMLElement) => void> = {
  startRun: () => g().startRun(),
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

// ============ 启动 ============
setupStage()
setupControls()
useGame.subscribe(render)
render()
console.log('[STS standalone] 游戏就绪')



