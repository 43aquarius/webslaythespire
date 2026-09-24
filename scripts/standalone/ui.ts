// ============ 单文件版 UI（原生 JS，与 gameStore 逻辑复用） ============
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

function cardHtml(card: CardInstance, width = 148, extra = ''): string {
  const def = CARDS[card.id]
  if (!def) return ''
  const rar = raritySuffix(def.rarity)
  const cost = cardCost(card, 0)
  const desc = cardDesc(card)
  const up = card.upgraded > 0
  return `<div class="sts-card ${extra}" style="width:${width}px;height:${width * 1.4003}px">
  <img class="c512" src="${A(TYPE_BG[def.type])}" alt="">
  <img src="${A('cardart/' + card.id + '.png')}" alt="" style="position:absolute;object-fit:cover;left:4%;top:11.5%;width:87.6%;height:49%;border-radius:3px">
  <img class="c512" src="${A('frames/frame' + def.type[0].toUpperCase() + def.type.slice(1) + rar + '.png')}" alt="">
  <img class="c512" src="${A('frames/banner' + rar + '.png')}" alt="">
  <div class="sts-title card-name" style="font-size:${width * 0.088}px;color:${rar === 'Rare' ? '#ffd98a' : '#ffe9c4'}">${esc(def.name)}</div>
  ${cost !== -99 ? `<img class="c512" src="${A('frames/cardRedOrb.png')}" alt="">
  <div class="sts-title card-cost" style="font-size:${width * 0.115}px">${cost === -1 ? 'X' : cost}</div>` : ''}
  <div class="sts-body card-desc" style="font-size:${width * 0.074}px">${up ? '<span style="color:#7fe08a">+ </span>' : ''}${esc(desc)}</div>
  ${up ? '<div class="sts-title card-up">✦</div>' : ''}
</div>`
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

function hpBar(hp: number, maxHp: number, block?: number, width = 170): string {
  const pct = Math.max(0, Math.min(100, hp / maxHp * 100))
  return `<div class="hpbar" style="width:${width}px">
    <div class="hpbar-outer" style="height:22px">
      <div class="hpbar-fill" style="width:${pct}%"></div>
      <span class="hp-text">${hp} / ${maxHp}</span>
      ${block !== undefined && block > 0 ? `<span class="block-badge"><img src="${A('status/block.png')}" alt=""><i>${block}</i></span>` : ''}
    </div>
  </div>`
}

function relicIcon(id: string, size = 34): string {
  const def = RELICS[id]
  if (!def) return ''
  return `<span class="relic" data-tip="<b>${esc(def.name)}</b><br><span style='color:#d8c8a8'>${esc(def.desc)}</span>" style="width:${size}px;height:${size}px"><img src="${A('relics/' + id + '.png')}" alt=""></span>`
}

function potionHtml(pid: string | null, idx: number, combat: boolean): string {
  if (!pid) return `<span class="pslot" style="width:36px;height:42px"></span>`
  const def = POTIONS[pid]
  return `<span class="pslot has" data-act="potion" data-idx="${idx}" data-tip="<b>${esc(def.name)}</b><br><span style='color:#d8c8a8'>${esc(def.desc)}</span>">
    <img src="${A('potions/' + pid + '.png')}" alt="">
    <i class="pdisc" data-act="potionDiscard" data-idx="${idx}">✕</i>
  </span>`
}

// ============ 各界面 ============
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

function rMap(run: RunState): string {
  const map = run.map
  const reach = run.currentNodeId ? (map.nodes[run.currentNodeId]?.edges ?? []) : map.startNodes
  const W = 1100, H = 1450
  const ICON: Record<string, string> = { monster: 'monster', elite: 'elite', event: 'event', shop: 'shop', treasure: 'treasure', rest: 'rest', boss: 'boss' }
  const NAME: Record<string, string> = { monster: '普通敌人', elite: '精英敌人', event: '未知事件', shop: '商店', treasure: '宝箱', rest: '篝火', boss: 'BOSS' }

  const edges = Object.values(map.nodes).flatMap(n =>
    n.edges.map(toId => {
      const to = map.nodes[toId]
      if (!to) return ''
      const visitedEdge = run.visitedNodes.includes(toId) && run.currentNodeId === n.id
      return `<line x1="${(n.x / W) * 100}%" y1="${(n.y / H) * 100}%" x2="${(to.x / W) * 100}%" y2="${(to.y / H) * 100}%" stroke="${visitedEdge ? '#e8c880' : 'rgba(60,40,28,0.65)'}" stroke-width="${visitedEdge ? 5 : 3}" ${visitedEdge ? '' : 'stroke-dasharray="1 12"'} stroke-linecap="round"/>`
    })
  ).join('')

  const nodes = Object.values(map.nodes).map(n => {
    const isCur = run.currentNodeId === n.id
    const isReach = reach.includes(n.id)
    const visited = run.visitedNodes.includes(n.id)
    const size = n.type === 'boss' ? 92 : n.type === 'elite' ? 56 : 48
    const cls = isReach ? 'node reach' : (visited || isCur) ? 'node' : 'node locked'
    return `<div class="${cls}" data-act="${isReach ? 'chooseNode' : ''}" data-id="${n.id}" data-tip="<b>${NAME[n.type]}</b>"
      style="left:calc(${(n.x / W) * 100}% - ${size / 2}px);top:calc(${(n.y / H) * 100}% - ${size / 2}px);width:${size}px;height:${size}px;${visited && !isCur ? 'opacity:.45' : ''}${isCur ? '' : ''}">
      <img src="${A('mapicons/' + ICON[n.type] + '.png')}" alt="" style="${isCur ? 'filter:drop-shadow(0 0 14px #ffd070) brightness(1.2)' : ''}">
      ${isCur ? '<span class="cur-ring"></span>' : ''}
    </div>`
  }).join('')

  return `<div class="screen">
  <div class="topbar">
    <span class="stat" style="color:#ff8a70">❤ ${run.hp}/${run.maxHp}</span>
    <span class="stat" style="color:#ffd980">💰 ${run.gold}</span>
    <span class="relics">${run.relics.map(id => relicIcon(id)).join('')}</span>
    <span class="pots">${run.potions.map((p, i) => potionHtml(p, i, false)).join('')}</span>
    <button class="sts-btn deck-btn" data-act="openPile" data-pile="deck" style="font-size:13px;padding:4px 14px">查看牌组</button>
    <span class="stat right">第 1 幕 · 层 ${run.visitedNodes.length}</span>
  </div>
  <div class="map-scroll" id="mapScroll">
    <div class="map-canvas" style="background-image:url('${A('bg/map.jpg')}')">
      <svg>${edges}</svg>
      ${nodes}
      <div class="map-fade"></div>
    </div>
  </div>
</div>`
}

// ============ 战斗界面 ============
let fxPositions: Record<string, { x: number; y: number }> = {}

function rCombat(run: RunState): string {
  const c = run.combat!
  const p = c.player
  const def0 = (id: string) => ENEMIES[id]

  const enemiesHtml = c.enemies.map((e, i) => {
    const def = def0(e.id)
    const spriteW = def.boss ? 300 : def.elite ? 240 : 190
    const targetable = !!useGame.getState().selectedCardUid || useGame.getState().selectedPotionIdx !== null
    // 意图
    let intent = ''
    if (e.intent && !e.dying) {
      const it = e.intent
      const { dmg, times } = enemyDisplayDamage(e, p.statuses)
      const map: Record<string, string> = {
        attack: 'attack3', attackDebuff: 'attack5', attackDefend: 'attack4',
        defend: 'defend', buff: 'buff', debuff: 'debuff', strongDebuff: 'debuffStrong',
        sleep: 'sleep', unknown: 'unknown',
      }
      const isAtk = it.type.startsWith('attack')
      const mvName = def.moves[e.nextMoveIdx]?.name || ''
      intent = `<div class="intent" data-tip="<b>${esc(mvName)}</b>">
        ${isAtk ? `<img src="${A('intent/' + (map[it.type] || 'unknown') + '.png')}" width="38" height="38">
          <span class="dmg-num">${dmg}${times > 1 ? `<small>x${times}</small>` : ''}</span>
          ${(it.type === 'attackDebuff' || it.type === 'attackDefend') ? `<img src="${A('intent/' + (it.type === 'attackDebuff' ? 'debuff' : 'defend') + '.png')}" width="26" height="26">` : ''}`
        : `<img src="${A('intent/' + (map[it.type] || 'unknown') + '.png')}" width="40" height="40">`}
      </div>`
    }
    return `<div class="enemy ${e.dying ? 'dying' : ''} ${targetable ? 'targetable' : ''}" data-act="${targetable ? 'clickEnemy' : ''}" data-uid="${e.uid}" style="min-width:${spriteW * 0.8}px" data-idx="${i}">
      <div class="intent-slot">${intent}</div>
      <div class="sprite"><img src="${A('enemies/' + def.sprite + '.png')}" alt="" style="width:${spriteW}px;height:${spriteW}px"></div>
      <div class="enemy-info">
        <div class="ename">${esc(def.name)}</div>
        ${hpBar(e.hp, e.maxHp, e.block, def.boss ? 260 : 160)}
        <div style="margin-top:4px">${statusRow(e.statuses, 26)}</div>
      </div>
    </div>`
  }).join('')

  // 手牌
  const n = c.hand.length
  const mid = (n - 1) / 2
  const handHtml = c.hand.map((card, i) => {
    const offset = i - mid
    const spread = Math.min(62, 580 / Math.max(n, 1))
    const rot = n > 1 ? (offset / mid) * (n > 5 ? 13 : 8) : 0
    const ty = Math.abs(offset) * Math.min(7, 40 / Math.max(n, 1)) * 0.9
    const def = CARDS[card.id]
    const cost = cardCost(card, p.hpLostThisCombat)
    const enough = cost === -1 ? true : p.energy >= Math.max(0, cost)
    const isSel = useGame.getState().selectedCardUid === card.uid
    return `<div class="hand-card" data-act="clickCard" data-uid="${card.uid}" style="transform:translateX(${offset * spread}px) translateY(${ty}px) rotate(${rot}deg);z-index:${10 + i}">
      <div class="hand-inner ${isSel ? 'sel' : ''}" style="${isSel ? 'transform:translateY(-96px) scale(1.32)' : ''}">${cardHtml(card, 148, enough ? 'playable' : 'dimmed')}</div>
    </div>`
  }).join('')

  return `<div class="screen bg-cover" data-bg="1" style="background-image:url('${A('bg/combat.jpg')}')">
  <div class="ename-top sts-title">${esc(c.encounterName)}</div>
  <div class="gold-top sts-body">💰 ${run.gold}</div>
  <div class="pots-top">${run.potions.map((p, i) => potionHtml(p, i, true)).join('')}</div>
  <div class="enemies-row">${enemiesHtml}</div>
  <div class="player-zone">
    <img src="${A('hero/ironclad.png')}" alt="" style="width:200px;filter:drop-shadow(0 8px 10px rgba(0,0,0,.5))">
    ${hpBar(run.hp, run.maxHp, p.block, 200)}
    <div style="margin-top:4px">${statusRow(p.statuses, 28)}</div>
    <div class="relics" style="margin-top:6px;max-width:220px">${run.relics.map(id => relicIcon(id, 30)).join('')}</div>
  </div>
  ${(useGame.getState().selectedCardUid || useGame.getState().selectedPotionIdx !== null) ? `<div class="target-hint sts-body">选择目标（点击敌人，点击空白处取消）</div>` : ''}
  <button class="pile-btn" data-act="openPile" data-pile="draw" style="left:14px;bottom:200px"><b>${c.drawPile.length}</b><span>抽牌堆</span></button>
  <button class="pile-btn" data-act="openPile" data-pile="discard" style="right:14px;bottom:200px"><b>${c.discardPile.length}</b><span>弃牌堆</span></button>
  ${c.exhaustPile.length > 0 ? `<button class="pile-btn small" data-act="openPile" data-pile="exhaust" style="right:14px;bottom:132px"><b>${c.exhaustPile.length}</b><span>消耗堆</span></button>` : ''}
  <div class="energy sts-energy"><img src="${A('frames/redEnergy.png')}" alt=""><span>${p.energy}</span></div>
  <button class="sts-btn end-turn sts-title" data-act="endTurn" ${c.phase !== 'player' || g().busy ? 'disabled' : ''}>${c.phase === 'player' ? '结束回合' : '敌方回合…'}</button>
  <div class="hand-row">${handHtml}</div>
  ${g().endBanner ? `<div class="banner">${g().endBanner === 'win' ? '战斗胜利！' : '你倒下了…'}</div>` : ''}
</div>`
}

// ============ 奖励界面 ============
function rReward(run: RunState): string {
  const r = run.reward!
  const rows: string[] = []
  if (r.gold !== undefined) {
    rows.push(`<button class="reward-row ${r.taken.includes('gold') ? 'done' : ''}" data-act="takeGold">
      <img src="${A('mapicons/treasure.png')}" width="42" height="42"><span class="gold-text">${r.gold} 金币</span>${r.taken.includes('gold') ? '' : '<i>点击获取</i>'}</button>`)
  }
  let cardsHtml = ''
  if (r.cards?.length) {
    cardsHtml = `<div class="reward-cards-label sts-body">选择一张卡牌加入牌组（或跳过）</div>
    <div class="reward-cards">${r.cards.map((cid, i) => {
      const taken = r.taken.includes('card_' + cid)
      return `<div class="card-in" style="animation-delay:${i * 0.12}s" data-act="takeCard" data-cid="${cid}">
        ${cardHtml({ uid: 'r_' + cid, id: cid, upgraded: 0 }, 165, taken ? 'dimmed' : '')}
        ${taken ? '<span class="taken-mark sts-title">已选</span>' : ''}
      </div>`
    }).join('')}</div>`
  }
  if (r.potion && !r.taken.includes('potion')) {
    rows.push(`<button class="reward-row" data-act="takePotion">${potionHtml(r.potion, 0, false)}<span class="sts-body">${POTIONS[r.potion]?.name}</span><i>点击获取</i></button>`)
  }
  if (r.relic && !r.taken.includes('relic')) {
    rows.push(`<button class="reward-row" data-act="takeRelic">${relicIcon(r.relic, 44)}<span class="sts-body">${RELICS[r.relic]?.name}</span><i>点击获取</i></button>`)
  }
  return `<div class="screen reward-bg">
  <div class="big-title sts-title">战利品</div>
  <div class="reward-list">${rows.join('')}</div>
  ${cardsHtml}
  <button class="sts-btn sts-title" data-act="proceedReward" style="font-size:22px;margin-top:26px">${run.combat?.isBoss ? '继续' : '返回地图'}</button>
</div>`
}

// ============ Boss 遗物 ============
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

// ============ 篝火 ============
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

// ============ 宝箱 ============
function rTreasure(): string {
  return `<div class="screen treasure-bg center-col">
  <div class="big-title sts-title">宝箱</div>
  <button data-act="takeTreasure" style="filter:drop-shadow(0 0 26px rgba(255,200,60,.55))">
    <img src="${A('mapicons/treasure.png')}" width="180" height="180"></button>
  <button class="sts-btn sts-title" data-act="takeTreasure" style="font-size:20px">打开宝箱</button>
</div>`
}

// ============ 事件 ============
function rEvent(run: RunState): string {
  const ev = EVENTS[run.currentEvent!]
  const msg = g().eventMsg
  return `<div class="screen event-bg center-col">
  <div class="sts-panel event-panel">
    <div class="sts-title" style="font-size:34px;color:#ffd980;text-shadow:2px 2px 0 #000">${esc(ev.name)}</div>
    <div class="sts-body event-desc">${esc(ev.desc)}</div>
    ${msg ? `<div class="sts-body" style="color:#8fe89a">${esc(msg)}</div>` : ''}
    <div class="event-choices">${ev.choices.map((ch, i) => {
      const dis = (ch.effect === 'cleric_heal' && run.gold < 35) || (ch.effect === 'cleric_purify' && run.gold < 50)
      return `<button class="sts-btn event-btn ${dis ? 'dis' : ''}" data-act="chooseEvent" data-idx="${i}">${esc(ch.text)}</button>`
    }).join('')}</div>
  </div>
</div>`
}

// ============ 商店 ============
function rShop(run: RunState): string {
  const shop = run.shop!
  const price = (p: number, ok: boolean) => `<span class="price ${ok ? 'ok' : ''}">${p}</span>`
  const cards = shop.cards.map((item, i) => `
    <div class="shop-card ${item.sold ? 'sold' : ''}" data-act="buyCard" data-idx="${i}">
      ${cardHtml({ uid: 's' + i, id: item.cardId, upgraded: 0 }, 150, item.sold ? 'dimmed' : '')}
      <span class="price-tag ${run.gold >= item.price && !item.sold ? 'ok' : ''}">${item.sold ? '已售出' : '💰 ' + item.price}</span>
    </div>`).join('')
  const relics = shop.relics.map((item, i) => {
    const def = RELICS[item.relicId]
    return `<button class="sts-panel shop-item ${item.sold ? 'sold' : ''}" data-act="buyRelic" data-idx="${i}" data-tip="<b>${esc(def.name)}</b><br>${esc(def.desc)}">
      <img src="${A('relics/' + item.relicId + '.png')}" width="54" height="54">
      <div class="sts-body" style="font-size:13px;color:#f5e5c8">${esc(def.name)}</div>
      <div class="price-tag ${run.gold >= item.price && !item.sold ? 'ok' : ''}">${item.sold ? '已售出' : '💰 ' + item.price}</div>
    </button>`
  }).join('')
  const potions = shop.potions.map((item, i) => {
    const def = POTIONS[item.potionId]
    return `<button class="sts-panel shop-item ${item.sold ? 'sold' : ''}" data-act="buyPotion" data-idx="${i}" data-tip="<b>${esc(def.name)}</b><br>${esc(def.desc)}">
      <img src="${A('potions/' + item.potionId + '.png')}" width="42" height="48">
      <div class="sts-body" style="font-size:12px;color:#f5e5c8">${esc(def.name)}</div>
      <div class="price-tag ${run.gold >= item.price && !item.sold ? 'ok' : ''}">${item.sold ? '已售出' : '💰 ' + item.price}</div>
    </button>`
  }).join('')
  return `<div class="screen shop-bg">
  <div class="center-col" style="padding:26px 16px;gap:22px">
    <div class="row" style="gap:20px;align-items:center">
      <img src="${A('mapicons/shop.png')}" width="88" height="88" style="filter:drop-shadow(0 0 20px rgba(255,180,80,.4))">
      <div><div class="big-title sts-title" style="font-size:38px">商店</div>
      <div class="sts-body" style="color:#c8b090;font-size:14px">「看看有没有中意的？」</div></div>
      <div class="sts-body" style="color:#ffd980;font-size:20px;margin-left:24px">💰 ${run.gold}</div>
    </div>
    <div class="row" style="flex-wrap:wrap;justify-content:center;gap:18px">${cards}</div>
    <div class="row" style="flex-wrap:wrap;justify-content:center;gap:34px;align-items:flex-start">
      <div class="row" style="gap:14px;flex-wrap:wrap">${relics}</div>
      <div class="row" style="gap:14px;flex-wrap:wrap">${potions}</div>
    </div>
    <button class="sts-btn sts-btn-gold sts-title" data-act="buyRemoval" ${shop.removalUsed ? 'disabled' : ''} style="font-size:18px">${shop.removalUsed ? '移除服务已使用' : '🧹 移除一张牌 —— 💰 ' + shop.removalPrice}</button>
    <button class="sts-btn sts-title" data-act="leaveShop" style="font-size:22px">离开商店</button>
  </div>
</div>`
}

// ============ 结算 ============
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

// ============ 遮罩 ============
function rSelect(run: RunState): string {
  const sel = g().select!
  const ordered: CardInstance[] = sel.source === 'deck' ? run.deck
    : sel.source === 'hand' ? (run.combat?.hand ?? [])
      : (run.combat?.discardPile ?? [])
  const cards = ordered.filter(c => sel.cardUids.includes(c.uid))
  const cancellable = ['eventUpgrade', 'eventRemove', 'sacrifice', 'restSmith', 'shopRemove'].includes(sel.kind)
  return `<div class="overlay center-col" style="gap:20px">
  <div class="sts-title" style="font-size:26px;color:#ffd980;text-shadow:2px 2px 0 #000">${esc(sel.title)}</div>
  <div class="sel-cards">${cards.map((c, i) => `<div class="card-in" style="animation-delay:${Math.min(i, 8) * 0.05}s" data-act="resolveSelect" data-uid="${c.uid}">${cardHtml(c, 136, 'playable')}</div>`).join('') || '<div class="sts-body">没有可选择的卡牌</div>'}</div>
  ${cancellable ? `<button class="sts-btn" data-act="cancelSelect">${sel.kind === 'shopRemove' ? '取消购买' : '放弃'}</button>` : ''}
</div>`
}

function rPile(run: RunState): string {
  const pile = g().pileView!
  const titles: Record<string, string> = { draw: '抽牌堆（随机排序）', discard: '弃牌堆', exhaust: '消耗堆', deck: '牌组' }
  let cards: CardInstance[] = []
  if (pile === 'draw') cards = [...(run.combat?.drawPile ?? [])].reverse()
  else if (pile === 'discard') cards = [...(run.combat?.discardPile ?? [])].reverse()
  else if (pile === 'exhaust') cards = [...(run.combat?.exhaustPile ?? [])]
  else cards = run.deck
  return `<div class="overlay" data-act="closePile">
  <div class="sts-panel" style="padding:22px;max-width:92vw;max-height:88vh;display:flex;flex-direction:column;align-items:center;gap:14px" onclick="event.stopPropagation()">
    <div class="sts-title" style="font-size:24px;color:#ffd980">${titles[pile]} <small style="font-size:15px;color:#a89070">(${cards.length})</small></div>
    <div class="sel-cards">${cards.map(c => cardHtml(c, 128)).join('') || '<div class="sts-body">空空如也</div>'}</div>
    <button class="sts-btn" data-act="closePile">关闭</button>
  </div>
</div>`
}

// ============ 主渲染 ============
const app = document.getElementById('app')!

function render() {
  const st = g()
  const run = st.run
  const scr = run ? run.screen : 'title'
  let html = ''
  if (scr === 'title') html = rTitle()
  else if (scr === 'map') html = rMap(run!)
  else if (scr === 'combat') html = rCombat(run!)
  else if (scr === 'reward') html = rReward(run!)
  else if (scr === 'shop') html = rShop(run!)
  else if (scr === 'rest') html = rRest(run!)
  else if (scr === 'treasure') html = rTreasure()
  else if (scr === 'event') html = rEvent(run!)
  else if (scr === 'bossRelic') html = rBossRelic(run!)
  else html = rGameOver(run!)
  app.innerHTML = html

  // 更新 fx 定位（敌人中心坐标）
  fxPositions = {}
  document.querySelectorAll('.enemy').forEach(el => {
    const r = (el as HTMLElement).getBoundingClientRect()
    fxPositions[(el as HTMLElement).dataset.uid!] = { x: r.left + r.width / 2, y: r.top + 90 }
  })
  const pz = document.querySelector('.player-zone') as HTMLElement | null
  if (pz) {
    const r = pz.getBoundingClientRect()
    fxPositions['player'] = { x: r.left + r.width / 2, y: r.top + 20 }
  }
  renderNewFx()

  // 地图自动滚动到当前节点
  const sc = document.getElementById('mapScroll')
  if (sc && run && scr === 'map') {
    const cur = run.currentNodeId ? run.map.nodes[run.currentNodeId] : null
    const y = cur ? cur.y : 1350
    const target = Math.max(0, sc.scrollHeight * (y / 1450) - sc.clientHeight * 0.55)
    sc.scrollTo({ top: target, behavior: 'smooth' })
  }
}

// ============ FX 浮动数字层 ============
const renderedFx = new Set<number>()
function renderNewFx() {
  const layer = document.getElementById('fx-layer')!
  const st = g()
  for (const f of st.fxList) {
    if (renderedFx.has(f.id)) continue
    renderedFx.add(f.id)
    const pos = fxPositions[f.target]
    if (!pos) { st.removeFx(f.id); continue }
    const el = document.createElement('div')
    el.className = 'fx-float'
    let color = '#fff', content = '', size = 22
    if (f.kind === 'dmg') { color = '#ff5a4a'; content = String(f.value); size = 34 }
    else if (f.kind === 'heal') { color = '#7fe08a'; content = '+' + f.value }
    else if (f.kind === 'block') { color = '#9ac8f0'; content = '+' + f.value }
    else if (f.kind === 'status') {
      const info = STATUS_INFO[f.text || '']
      content = `<img src="${A(statusImgKey(f.text || ''))}" width="24" height="24"><span style="color:${(f.value || 0) > 0 ? '#7fe08a' : '#ff8a7a'}">${(f.value || 0) > 0 ? '+' : ''}${f.value}</span>`
    } else if (f.kind === 'text') { color = '#ffe9a0'; content = String(f.text) }
    el.style.cssText = `left:${pos.x}px;top:${pos.y}px;color:${color};font-size:${size}px`
    el.innerHTML = content
    layer.appendChild(el)
    setTimeout(() => { el.remove(); st.removeFx(f.id) }, 1150)
  }
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
    // 非战斗场景（地图）：血瓶/果汁可直接使用，其余提示
    if (!st.run?.combat) { g().usePotionMap(idx); return }
    const def = POTIONS[pid]
    const living = st.run.combat.enemies.filter(e => !e.dying && e.hp > 0)
    if (def.target === 'enemy' && living.length > 1) {
      useGame.setState({ selectedPotionIdx: st.selectedPotionIdx === idx ? null : idx })
    } else {
      g().usePotion(idx, living[0]?.uid ?? null)
    }
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

// ============ 悬浮提示 ============
const tipEl = document.createElement('div')
tipEl.className = 'tooltip sts-body'
document.body.appendChild(tipEl)
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

// ============ 启动 ============
useGame.subscribe(render)
render()
console.log('[STS standalone] 游戏就绪')
