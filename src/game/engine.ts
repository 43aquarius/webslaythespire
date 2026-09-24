// ============ 战斗引擎（核心逻辑） ============
// 可变状态设计：store 层负责克隆，本层直接修改传入的 state
import {
  CombatState, EnemyInstance, CardInstance, StatusMap,
  RunState, FxEvent, Intent, OrbType, StanceId, Orb,
} from './types'
import { CARDS, cardCost, cardValues, makeCard, isStatusCard } from './cards'
import { ENEMIES } from './enemies'
import { POTIONS } from './potions'
import { RELICS } from './relics'

let fxId = 1
export function fx(combat: CombatState, kind: FxEvent['kind'], target: FxEvent['target'], value?: number, text?: string) {
  combat.fx.push({ kind, target, value, text, id: fxId++ })
}

export function rnd(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ============ 伤害计算 ============
export function calcPlayerAttack(base: number, player: StatusMap, target: StatusMap, strMult = 1, stance?: string): number {
  let dmg = base + Math.floor((player.strength || 0) * strMult)
  if (player.weak) dmg = Math.floor(dmg * 0.75)
  if (target.vulnerable) dmg = Math.floor(dmg * 1.5)
  // 观者姿态：怒相双倍 / 神格三倍
  if (stance === 'wrath') dmg *= 2
  if (stance === 'divinity') dmg *= 3
  return Math.max(0, dmg)
}

export function calcEnemyAttack(base: number, enemy: StatusMap, player: StatusMap, playerStance?: string): number {
  let dmg = base + (enemy.strength || 0)
  if (enemy.weak) dmg = Math.floor(dmg * 0.75)
  if (player.vulnerable) dmg = Math.floor(dmg * 1.5)
  // 怒相：受到的攻击伤害也翻倍
  if (playerStance === 'wrath') dmg *= 2
  return Math.max(0, dmg)
}

export function calcBlock(base: number, statuses: StatusMap): number {
  let blk = base + (statuses.dexterity || 0)
  if (statuses.frail) blk = Math.floor(blk * 0.75)
  return Math.max(0, blk)
}

export function enemyDisplayDamage(enemy: EnemyInstance, playerStatuses: StatusMap, playerStance?: string): { dmg: number; times: number } {
  const i = enemy.intent
  if (!i || !i.damage) return { dmg: 0, times: 0 }
  // 实时计算（力量/虚弱/易伤变化后意图显示同步更新）
  return { dmg: calcEnemyAttack(i.damage, enemy.statuses, playerStatuses, playerStance), times: i.times || 1 }
}

// ============ 状态施加 ============
// 负面状态集合：反制（Artifact）可无效化的效果
const DEBUFF_STATUSES = new Set(['vulnerable', 'weak', 'frail'])
export function applyStatus(combat: CombatState, target: 'player' | EnemyInstance, id: string, amount: number) {
  if (amount === 0) return
  const map: StatusMap = target === 'player' ? combat.player.statuses : target.statuses
  // 反制：负面状态（易伤/虚弱/脆弱）或力量/敏捷降低被无效化
  const isDebuff = DEBUFF_STATUSES.has(id) ||
    ((id === 'strength' || id === 'dexterity') && amount < 0)
  // 姜/萝卜：免疫虚弱/脆弱
  if (target === 'player' && amount > 0) {
    if (id === 'weak' && combat.player.customFlags?.gingerImmune) return
    if (id === 'frail' && combat.player.customFlags?.turnipImmune) return
  }
  if (map.artifact && isDebuff) {
    map.artifact -= 1
    if (map.artifact <= 0) delete map.artifact
    fx(combat, 'text', target === 'player' ? 'player' : target.uid, undefined, '反制!')
    return
  }
  map[id] = (map[id] || 0) + amount
  if (map[id] === 0) delete map[id]
  fx(combat, 'status', target === 'player' ? 'player' : target.uid, amount, id)
}

// ============ 生命/格挡 ============
export function healPlayer(run: RunState, combat: CombatState | null, amount: number) {
  const before = run.hp
  run.hp = Math.min(run.maxHp, run.hp + amount)
  if (combat && run.hp > before) fx(combat, 'heal', 'player', run.hp - before)
}

export function playerGainBlock(combat: CombatState, run: RunState, base: number) {
  if (run.hp <= 0) return
  const amount = calcBlock(base, combat.player.statuses)
  combat.player.block += amount
  if (amount > 0) fx(combat, 'block', 'player', amount)
  // 主宰：获得格挡时对随机敌人造成伤害
  if (combat.player.statuses.juggernaut) {
    const living = combat.enemies.filter(e => !e.dying && e.hp > 0)
    if (living.length > 0 && amount > 0) {
      damageEnemy(combat, run, pick(living), combat.player.statuses.juggernaut, false)
    }
  }
}

export function enemyGainBlock(combat: CombatState, e: EnemyInstance, base: number) {
  e.block += base
  fx(combat, 'block', e.uid, base)
}

export function damageEnemy(combat: CombatState, run: RunState, e: EnemyInstance, amount: number, isAttack = true): number {
  if (e.hp <= 0 || e.dying) return 0
  let dmg = amount
  // 虚无形体：受到的伤害变为 1
  if (e.statuses.intangible) dmg = 1
  // 飞行（百鸟）：受到的攻击伤害降低 40%
  if (isAttack && e.statuses.flying) dmg = Math.floor(dmg * 0.6)
  let hpLoss = dmg
  if (e.block > 0) {
    const absorbed = Math.min(e.block, dmg)
    e.block -= absorbed
    hpLoss = dmg - absorbed
  }
  e.hp -= hpLoss
  e.flash = true
  fx(combat, 'dmg', e.uid, dmg)
  if (isAttack) fx(combat, 'slash', e.uid)
  if (hpLoss > 0) fx(combat, 'shake', e.uid)
  // 拉格维林被攻击会醒来
  if (e.statuses.asleep && e.hp > 0) {
    delete e.statuses.asleep
    delete e.statuses.metallicizeE
    e.custom.awoken = 1
    rollEnemyIntent(combat, e)
  }
  if (e.hp <= 0) {
    e.hp = 0
    onEnemyDeath(combat, run, e)
  }
  return hpLoss
}

export function damagePlayer(combat: CombatState, run: RunState, amount: number, attacker: EnemyInstance | null, isAttack = true): number {
  if (run.hp <= 0) return 0
  let dmg = amount
  // 虚无形体：受到的伤害变为 1
  if (combat.player.statuses.intangible) dmg = 1
  let hpLoss = dmg
  if (combat.player.block > 0) {
    const absorbed = Math.min(combat.player.block, dmg)
    combat.player.block -= absorbed
    hpLoss = dmg - absorbed
  }
  run.hp -= hpLoss
  // 钨钢棒：失去生命时减 1
  if (hpLoss > 0 && run.relics.includes('tungstenRod')) {
    run.hp += 1
    hpLoss -= 1
    if (hpLoss < 0) hpLoss = 0
  }
  combat.player.hpLostThisCombat += hpLoss
  if (dmg > 0) fx(combat, 'dmg', 'player', dmg)
  if (hpLoss > 0) {
    fx(combat, 'shake', 'player')
    // 世纪魔方：战斗中第一次因攻击失去生命 → 抽1张
    if (isAttack && run.relics.includes('centennialPuzzle') && !combat.player.customFlags?.puzzleUsed) {
      combat.player.customFlags = combat.player.customFlags || {}
      combat.player.customFlags.puzzleUsed = 1
      drawCards(combat, run, 1)
    }
    // 静电释放：受到攻击伤害 → 引导闪电
    if (isAttack && combat.player.statuses.staticDischargeS) {
      for (let i = 0; i < combat.player.statuses.staticDischargeS; i++) channelOrb(combat, run, 'lightning')
    }
  }
  // 反伤
  if (isAttack && attacker && attacker.hp > 0 && !attacker.dying) {
    const fb = combat.player.statuses.flameBarrier || 0
    const thorns = combat.player.statuses.thorns || 0
    const back = fb + thorns
    if (back > 0) damageEnemy(combat, run, attacker, back, false)
  }
  if (run.hp <= 0) {
    run.hp = 0
    // 瓶中仙女
    const fairyIdx = run.potions.findIndex(p => p === 'fairyInBottle')
    if (fairyIdx >= 0) {
      run.potions[fairyIdx] = null
      run.hp = Math.floor(run.maxHp * 0.3)
      fx(combat, 'heal', 'player', run.hp)
      fx(combat, 'text', 'player', undefined, '瓶中仙女!')
    }
  }
  return hpLoss
}

// ============ 死亡处理 ============
function onEnemyDeath(combat: CombatState, run: RunState, e: EnemyInstance) {
  if (e.dying) return
  const def = ENEMIES[e.id]
  // 觉醒者重生：首次死亡时复活至半血并获得力量
  if (def?.onDeath === 'rebirth' && !e.custom.rebirthDone) {
    e.custom.rebirthDone = 1
    e.hp = Math.floor(e.maxHp / 2)
    e.block = 0
    applyStatus(combat, e, 'strength', 3)
    fx(combat, 'text', e.uid, undefined, '重生!')
    rollEnemyIntent(combat, e)
    return
  }
  // 尸体爆炸：对全体敌人造成其最大生命伤害
  if (e.statuses.corpseExplosionS) {
    const maxHp = e.maxHp
    combat.enemies.filter(x => !x.dying && x.hp > 0 && x.uid !== e.uid).forEach(x => damageEnemy(combat, run, x, maxHp, false))
    fx(combat, 'text', e.uid, undefined, '尸体爆炸!')
  }
  e.dying = true
  e.intent = null
  // 真菌兽孢子云
  if (def?.onDeath === 'sporeCloud') {
    applyStatus(combat, 'player', 'vulnerable', 2)
  }
  if (def?.onDeath === 'splitAcid' || def?.onDeath === 'splitBoss') {
    // 分裂出小型史莱姆
    if (def.onDeath === 'splitBoss') {
      spawnEnemyAt(combat, run, 'acidSlimeM', e, Math.ceil(e.maxHp * 0.25))
      spawnEnemyAt(combat, run, 'spikeSlimeM', e, Math.ceil(e.maxHp * 0.25))
    } else {
      spawnEnemyAt(combat, run, 'acidSlimeS', e, 7)
      spawnEnemyAt(combat, run, 'acidSlimeS', e, 7)
    }
  }
  if (def?.onDeath === 'splitSpike') {
    spawnEnemyAt(combat, run, 'spikeSlimeS', e, 7)
    spawnEnemyAt(combat, run, 'spikeSlimeS', e, 7)
  }
  checkCombatEnd(combat, run)
}

function spawnEnemyAt(combat: CombatState, run: RunState, id: string, source: EnemyInstance | null, hp: number) {
  const def = ENEMIES[id]
  if (!def) return
  const inst: EnemyInstance = {
    uid: `e${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    id, hp: Math.min(hp, def.maxHp), maxHp: Math.min(hp, def.maxHp),
    block: 0, statuses: def.startStatuses ? { ...def.startStatuses } : {},
    history: [], intent: null, nextMoveIdx: 0, flash: false, dying: false, custom: {},
  }
  if (id === 'spikeSlimeM') inst.statuses.thorns = 3
  // 插到原位置附近（无源则加到末尾）
  if (source) {
    const idx = combat.enemies.findIndex(x => x.uid === source.uid)
    combat.enemies.splice(idx + 1, 0, inst)
  } else {
    combat.enemies.push(inst)
  }
  rollEnemyIntent(combat, inst)
  fx(combat, 'text', inst.uid, undefined, '召唤!')
}

// ============ 抽牌/洗牌 ============
export function drawCards(combat: CombatState, run: RunState, n: number) {
  for (let i = 0; i < n; i++) {
    if (combat.hand.length >= 10) break
    if (combat.player.statuses.noDraw) break
    if (combat.drawPile.length === 0) {
      if (combat.discardPile.length === 0) break
      combat.drawPile = shuffle(combat.discardPile)
      combat.discardPile = []
      // 日晷
      if (run.relics.includes('sundial')) {
        run.relicCounters.sundial = (run.relicCounters.sundial || 0) + 1
        if (run.relicCounters.sundial % 3 === 0) {
          combat.player.energy += 2
          fx(combat, 'text', 'player', undefined, '日晷 +2能量')
        }
      }
    }
    const card = combat.drawPile.pop()!
    combat.hand.push(card)
    // 火焰吐息 / 进化
    if (isStatusCard(card.id)) {
      if (combat.player.statuses.fireBreathing) {
        const living = combat.enemies.filter(e => !e.dying && e.hp > 0)
        living.forEach(e => damageEnemy(combat, run, e, combat.player.statuses.fireBreathing, false))
      }
      if (combat.player.statuses.evolve) drawCards(combat, run, combat.player.statuses.evolve)
    }
  }
}

export function exhaustCard(combat: CombatState, run: RunState, card: CardInstance, from: 'hand' | 'discard') {
  if (from === 'hand') {
    const i = combat.hand.findIndex(c => c.uid === card.uid)
    if (i >= 0) combat.hand.splice(i, 1)
  } else {
    const i = combat.discardPile.findIndex(c => c.uid === card.uid)
    if (i >= 0) combat.discardPile.splice(i, 1)
  }
  combat.exhaustPile.push(card)
  onCardExhausted(combat, run, card)
}

function discardHandCard(combat: CombatState, card: CardInstance) {
  const i = combat.hand.findIndex(c => c.uid === card.uid)
  if (i >= 0) combat.hand.splice(i, 1)
  const def = CARDS[card.id]
  // 本回合弃牌计数
  combat.player.cardsDiscardedThisTurn = (combat.player.cardsDiscardedThisTurn || 0) + 1
  if (def?.onDiscardDraw) {
    // 本能反应：被弃时抽牌（升级版多抽1）
    drawCards(combat, combat_run_ref, def.onDiscardDraw + (card.upgraded > 0 ? 1 : 0))
  }
  if (def?.exhaustOnDiscard) combat.exhaustPile.push(card)
  else combat.discardPile.push(card)
}
// run 引用（弃牌触发抽牌需要）
let combat_run_ref: RunState = null as unknown as RunState
export function setCombatRunRef(run: RunState) { combat_run_ref = run }

// ============ 敌人 AI ============
export function rollEnemyIntent(combat: CombatState, e: EnemyInstance) {
  const def = ENEMIES[e.id]
  if (!def || e.hp <= 0) { e.intent = null; return }
  const n = def.moves.length
  let idx = 0

  // 特殊逻辑
  if (e.id === 'gremlinNob' && !e.custom.bellowed) {
    idx = 0
    e.custom.bellowed = 1
  } else if (e.id === 'chosen') {
    // 首次黑暗仪式，之后 Poke/Hex 交替，偶尔吸收
    const cnt = e.history.length
    if (cnt === 0) idx = 2
    else {
      const r = Math.random()
      if (r < 0.15) idx = 3
      else idx = cnt % 2 === 1 ? 0 : 1
    }
  } else if (e.id === 'transient') {
    // 伤害逐回合递增
    idx = Math.min(e.history.length, def.moves.length - 1)
  } else if (e.id === 'lagavulin') {
    if (e.statuses.asleep) {
      e.intent = { type: 'sleep' }
      e.nextMoveIdx = -1
      return
    }
    // 醒后：55% 虹吸 / 45% 攻击（不连续虹吸3次）
    const last = e.history[e.history.length - 1]
    if (last === 0 && e.history.slice(-2).join() === '0,0') idx = 1
    else idx = Math.random() < 0.55 ? 0 : 1
  } else if (e.id === 'theGuardian') {
    // 蓄能模式 vs 攻击模式
    if (e.custom.attackMode) {
      e.custom.attackLeft = e.custom.attackLeft || 2
      const opts = [0, 1, 3] // 猛击/滚动/蒸汽
      idx = pick(opts)
    } else {
      idx = 2 // 蓄力
    }
  } else if (e.id === 'slimeBoss') {
    // 循环: 粘液喷射 → 蓄力 → 猛击
    const last = e.history[e.history.length - 1]
    if (last === undefined || last === 2) idx = 0
    else if (last === 0) idx = 1
    else idx = 2
  } else if (e.id === 'hexaghost') {
    const cnt = e.history.length
    // 循环: 地狱火 → 分裂 → 灼烧 → 屏障 → 分裂 → 灼烧...
    const cycle = [1, 2, 0, 3, 2, 0]
    idx = cycle[cnt % cycle.length]
  } else if (e.id === 'cultist') {
    idx = e.history.length === 0 ? 0 : 1
  } else if (def.moveLogic === 'cycle') {
    const used = e.history.length
    const offset = e.custom.cycleOffset || 0
    idx = (used + offset) % n
  } else {
    // 带权重的随机
    const w = def.weights || def.moves.map(() => 1)
    // 避免三连
    let guard = 0
    do {
      let total = w.reduce((a, b) => a + b, 0)
      let r = Math.random() * total
      idx = 0
      while (r >= w[idx]) { r -= w[idx]; idx++ }
      guard++
    } while (
      def.noTripleRepeat &&
      e.history.length >= 2 &&
      e.history[e.history.length - 1] === idx &&
      e.history[e.history.length - 2] === idx &&
      guard < 30
    )
  }
  e.nextMoveIdx = idx
  const mv = def.moves[idx]
  const intent: Intent = { ...mv.intent }
  // damage 保存基础值，显示时实时计算（rollEnemyIntent 不再预计算）
  e.intent = intent
}

// 哨卫三人组相位偏移
export function initEncounter(combat: CombatState, enemyIds: string[]) {
  combat.enemies.forEach((e, i) => {
    if (e.id === 'sentry') e.custom.cycleOffset = i % 2
    rollEnemyIntent(combat, e)
  })
}

// ============ 宝球系统（故障机器人） ============
function orbBase(combat: CombatState, type: string): number {
  const focus = combat.player.statuses.focus || 0
  if (type === 'lightning') return 3 + focus
  if (type === 'frost') return 2 + focus
  return 0
}

export function channelOrb(combat: CombatState, run: RunState, type: OrbType) {
  combat.player.orbs = combat.player.orbs || []
  combat.player.orbSlots = combat.player.orbSlots ?? 3
  // 超出上限：唤起最旧（最左）的球
  while (combat.player.orbs.length >= combat.player.orbSlots) {
    const old = combat.player.orbs.shift()!
    evokeOrbEffect(combat, run, old)
  }
  combat.player.orbs.push({ type, damage: type === 'dark' ? 6 : undefined })
  combat.player.channeledThisCombat = (combat.player.channeledThisCombat || 0) + 1
  if (type === 'lightning') combat.player.lightningChanneled = (combat.player.lightningChanneled || 0) + 1
  fx(combat, 'orb', 'player', undefined, type)
}

export function evokeOrbEffect(combat: CombatState, run: RunState, orb: Orb) {
  const focus = combat.player.statuses.focus || 0
  const living = () => combat.enemies.filter(e => !e.dying && e.hp > 0)
  if (orb.type === 'lightning') {
    if (combat.player.statuses.electro) {
      living().forEach(e => damageEnemy(combat, run, e, 9 + focus, false))
    } else if (living().length) {
      damageEnemy(combat, run, pick(living()), 9 + focus, false)
    }
  } else if (orb.type === 'frost') {
    playerGainBlock(combat, run, 5 + focus)
  } else if (orb.type === 'dark') {
    if (living().length) damageEnemy(combat, run, pick(living()), (orb.damage || 6) + focus, false)
  } else if (orb.type === 'plasma') {
    combat.player.energy += 2
    fx(combat, 'text', 'player', undefined, '等离子 +2能量')
  }
}

// 唤起最右侧的球
export function evokeTopOrb(combat: CombatState, run: RunState) {
  const orbs = combat.player.orbs || []
  if (!orbs.length) return
  const orb = orbs.pop()!
  evokeOrbEffect(combat, run, orb)
}

// 回合结束：所有球触发被动
function orbsPassiveEnd(combat: CombatState, run: RunState) {
  const orbs = combat.player.orbs || []
  if (!orbs.length) return
  const living = () => combat.enemies.filter(e => !e.dying && e.hp > 0)
  orbs.forEach(orb => {
    if (orb.type === 'lightning') {
      if (combat.player.statuses.electro) {
        living().forEach(e => damageEnemy(combat, run, e, orbBase(combat, 'lightning'), false))
      } else if (living().length) {
        damageEnemy(combat, run, pick(living()), orbBase(combat, 'lightning'), false)
      }
    } else if (orb.type === 'frost') {
      playerGainBlock(combat, run, orbBase(combat, 'frost'))
    } else if (orb.type === 'dark') {
      orb.damage = (orb.damage || 6) + 6
    } else if (orb.type === 'plasma') {
      combat.player.energy = Math.min(combat.player.energy + 1, 99)
      fx(combat, 'text', 'player', undefined, '等离子 +1能量')
    }
  })
}

// 回合开始：循环触发最右球被动
function loopPassiveStart(combat: CombatState, run: RunState) {
  const n = combat.player.statuses.loopS || 0
  const orbs = combat.player.orbs || []
  if (!n || !orbs.length) return
  const orb = orbs[orbs.length - 1]
  for (let i = 0; i < n; i++) {
    if (orb.type === 'lightning') {
      const living = combat.enemies.filter(e => !e.dying && e.hp > 0)
      if (living.length) damageEnemy(combat, run, pick(living), orbBase(combat, 'lightning'), false)
    } else if (orb.type === 'frost') {
      playerGainBlock(combat, run, orbBase(combat, 'frost'))
    } else if (orb.type === 'dark') {
      orb.damage = (orb.damage || 6) + 6
    } else if (orb.type === 'plasma') {
      combat.player.energy += 1
    }
  }
}

// ============ 姿态系统（观者） ============
export function enterStance(combat: CombatState, run: RunState, newStance: StanceId) {
  const cur = combat.player.stance || 'none'
  if (cur === newStance) return
  // 退出静相：获得 2 能量
  if (cur === 'calm' && newStance !== 'calm') {
    combat.player.energy += 2
    fx(combat, 'text', 'player', undefined, '静相 +2能量')
  }
  combat.player.stance = newStance
  if (cur !== 'none' && newStance !== 'none') combat.player.exitedStanceThisTurn = true
  if (cur !== 'none') combat.player.exitedStanceThisTurn = true
  // 心灵壁垒：切换姿态获得格挡
  if (combat.player.statuses.mentalFortressS) {
    playerGainBlock(combat, run, combat.player.statuses.mentalFortressS)
  }
  // 进入神格：获得 3 能量
  if (newStance === 'divinity') {
    combat.player.energy += 3
    fx(combat, 'text', 'player', undefined, '神格!')
  }
  const names: Record<StanceId, string> = { none: '退出姿态', wrath: '进入怒相', calm: '进入静相', divinity: '进入神格' }
  if (newStance !== 'none') fx(combat, 'text', 'player', undefined, names[newStance])
}

export function exitStance(combat: CombatState, run: RunState) {
  const cur = combat.player.stance || 'none'
  if (cur === 'none') return
  combat.player.stance = 'none'
  combat.player.exitedStanceThisTurn = true
  if (cur === 'calm') {
    combat.player.energy += 2
    fx(combat, 'text', 'player', undefined, '静相 +2能量')
  }
  if (combat.player.statuses.mentalFortressS) {
    playerGainBlock(combat, run, combat.player.statuses.mentalFortressS)
  }
}

// 获得真言
export function gainMantra(combat: CombatState, run: RunState, n: number) {
  // 光辉：获得真言时对随机敌人造成伤害
  if (combat.player.statuses.brillianceS) {
    const living = combat.enemies.filter(e => !e.dying && e.hp > 0)
    if (living.length) damageEnemy(combat, run, pick(living), combat.player.statuses.brillianceS, false)
  }
  combat.player.mantra = (combat.player.mantra || 0) + n
  if (combat.player.mantra >= 10) {
    combat.player.mantra -= 10
    enterStance(combat, run, 'divinity')
  }
}

// ============ 预见 ============
export function beginScry(combat: CombatState, n: number) {
  if (n <= 0 || combat.drawPile.length === 0) return
  combat.pendingScry = Math.min(n, combat.drawPile.length)
  combat.scryDiscarded = []
  // 涅槃：每预见一张牌获得格挡
  if (combat.player.statuses.nirvanaS) {
    playerGainBlock(combat, run_ref, combat.player.statuses.nirvanaS * combat.pendingScry)
  }
}
// run 引用占位（beginScry 由 playCard 调用时一定有 run）
let run_ref: RunState = null as unknown as RunState
export function setRunRef(run: RunState) { run_ref = run }

// ============ 开始战斗 ============
export function startCombat(run: RunState, encounterName: string, enemyIds: string[], isElite: boolean, isBoss: boolean): CombatState {
  const combat: CombatState = {
    enemies: [],
    player: {
      block: 0, statuses: {}, energy: 0, maxEnergy: 3,
      hpLostThisCombat: 0, attacksThisTurn: 0, tempStr: 0, customFlags: {},
      stance: 'none', mantra: 0, exitedStanceThisTurn: false,
      cardsDiscardedThisTurn: 0,
      orbs: [], orbSlots: 3, channeledThisCombat: 0, lightningChanneled: 0,
      cardsDrawnThisTurn: 0, lastCardType: 'none',
    },
    drawPile: shuffle(run.deck.map(c => ({ ...c }))),
    hand: [], discardPile: [], exhaustPile: [],
    turn: 0, phase: 'player',
    encounterName, isElite, isBoss,
    goldReward: isBoss ? rnd(95, 105) : isElite ? rnd(25, 35) : rnd(10, 20),
    potionDrop: !run.relics.includes('sozu') && (isBoss ? true : Math.random() < (isElite ? 0.6 : 0.4)),
    fx: [], log: [],
    combatOver: false, playerWon: false, combatEndTriggered: false,
  }
  combat.player.maxEnergy = 3 + (run.relics.filter(r => ['ectoplasm', 'sozu', 'velvetChoker', 'philosophersStone', 'coffeeDripper', 'bustedCrown'].includes(r)).length ? 1 : 0)

  enemyIds.forEach(id => {
    const def = ENEMIES[id]
    let hp = rnd(def.minHp, def.maxHp)
    if (isElite && run.relics.includes('preservedInsect')) hp = Math.ceil(hp * 0.75)
    const inst: EnemyInstance = {
      uid: `e${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      id, hp, maxHp: hp, block: 0,
      statuses: def.startStatuses ? { ...def.startStatuses } : {},
      history: [], intent: null, nextMoveIdx: 0, flash: false, dying: false, custom: {},
    }
    combat.enemies.push(inst)
  })
  initEncounter(combat, enemyIds)

  // ===== 战斗开始时遗物 =====
  if (run.relics.includes('vajra')) applyStatus(combat, 'player', 'strength', 1)
  if (run.relics.includes('smoothlyStone')) applyStatus(combat, 'player', 'dexterity', 1)
  if (run.relics.includes('oddlySmoothStone')) applyStatus(combat, 'player', 'dexterity', 1)
  if (run.relics.includes('bronzeScales')) applyStatus(combat, 'player', 'thorns', 3)
  if (run.relics.includes('bloodVial')) healPlayer(run, combat, 2)
  if (run.relics.includes('bagOfMarbles')) {
    combat.enemies.forEach(e => applyStatus(combat, e, 'vulnerable', 1))
  }
  if (run.relics.includes('philosophersStone')) {
    combat.enemies.forEach(e => applyStatus(combat, e, 'strength', 1))
  }
  // 角色专属初始遗物
  if (run.relics.includes('crackedCore')) channelOrb(combat, run, 'lightning')
  // 姜/萝卜免疫标记
  if (run.relics.includes('ginger')) { combat.player.customFlags = combat.player.customFlags || {}; combat.player.customFlags.gingerImmune = 1 }
  if (run.relics.includes('turnip')) { combat.player.customFlags = combat.player.customFlags || {}; combat.player.customFlags.turnipImmune = 1 }

  startPlayerTurn(combat, run, true)
  // 圣水：开战获得奇迹
  if (run.relics.includes('pureWater')) combat.hand.push(makeCard('miracle'))
  return combat
}

// ============ 玩家回合 ============
export function startPlayerTurn(combat: CombatState, run: RunState, first = false) {
  combat.turn += 1
  combat.phase = 'player'
  combat.player.attacksThisTurn = 0
  combat.player.cardsPlayedThisTurn = 0
  combat.player.cardsDiscardedThisTurn = 0
  combat.player.cardsDrawnThisTurn = 0
  combat.player.exitedStanceThisTurn = false
  const P = combat.player

  // 壁垒：保留格挡
  if (!P.statuses.barricade) P.block = 0

  // 亵渎：下回合开始时死亡
  if (P.statuses.blasphemyD) {
    delete P.statuses.blasphemyD
    damagePlayer(combat, run, 9999, null, false)
    fx(combat, 'text', 'player', undefined, '亵渎的代价!')
  }

  // 玩家中毒
  if (P.statuses.poison && run.hp > 0) {
    damagePlayer(combat, run, P.statuses.poison, null, false)
    P.statuses.poison -= 1
    if (P.statuses.poison <= 0) delete P.statuses.poison
  }

  // 能量
  let energy = P.maxEnergy
  if (first && run.relics.includes('lantern')) energy += 1
  if (P.statuses.berserk) energy += 1
  // 下回合能量加成（飞膝踢/智取/充电电池等）
  if (P.customFlags?.nextEnergy) { energy += P.customFlags.nextEnergy; delete P.customFlags.nextEnergy }
  P.energy = energy

  // 回合开始触发
  if (P.statuses.demonForm) applyStatus(combat, 'player', 'strength', P.statuses.demonForm)
  if (P.statuses.brutality) {
    damagePlayer(combat, run, 1, null, false)
    if (run.hp > 0) drawCards(combat, run, 1)
  }
  if (P.statuses.regen) {
    healPlayer(run, combat, P.statuses.regen)
    P.statuses.regen -= 1
    if (P.statuses.regen <= 0) delete P.statuses.regen
  }
  if (first && run.relics.includes('anchor')) playerGainBlock(combat, run, 10)

  // 观者：奉献获得真言
  if (P.statuses.devotionS) gainMantra(combat, run, P.statuses.devotionS)

  // 阿尔法/贝塔链
  if (P.statuses.alphaS) {
    combat.hand.push(makeCard('beta', P.statuses.alphaS >= 2 ? 1 : 0))
    P.statuses.alphaS -= 1
    if (P.statuses.alphaS <= 0) delete P.statuses.alphaS
    fx(combat, 'text', 'player', undefined, '阿尔法→贝塔')
  }
  if (P.statuses.betaActive) {
    combat.hand.push(makeCard('omega'))
    delete P.statuses.betaActive
    fx(combat, 'text', 'player', undefined, '贝塔→欧米茄')
  }

  // 噩梦：下回合入手副本
  if (combat.pendingNightmare) {
    const nm = combat.pendingNightmare
    for (let i = 0; i < nm.count; i++) combat.hand.push(makeCard(nm.cardId, nm.upgraded))
    fx(combat, 'text', 'player', undefined, '噩梦实现!')
    combat.pendingNightmare = null
  }

  // 故障机器人：循环
  loopPassiveStart(combat, run)

  // 翻滚闪避：下回合格挡
  if (P.customFlags?.nextBlock) { playerGainBlock(combat, run, P.customFlags.nextBlock); delete P.customFlags.nextBlock }

  // 抽牌
  let drawN = 5
  if (first && run.relics.includes('bagOfPreparation')) drawN += 2
  if (first && run.relics.includes('ringOfTheSnake')) drawN += 2
  if (P.customFlags?.nextDraw) { drawN += P.customFlags.nextDraw; delete P.customFlags.nextDraw }
  if (P.statuses.machineLearning) drawN += P.statuses.machineLearning
  drawCards(combat, run, drawN)

  // 创造AI：随机能力入手
  if (P.statuses.creativeAI) {
    const powers = Object.values(CARDS).filter(c => c.type === 'power' && c.rarity !== 'special' && (c.color || 'red') === (CARDS[run.deck[0]?.id || 'strike']?.color || 'red'))
    if (powers.length) {
      const c = makeCard(pick(powers).id)
      c.freeThisTurn = true
      combat.hand.push(c)
    }
  }
}

export function endPlayerTurn(combat: CombatState, run: RunState) {
  const P = combat.player
  // 灼伤
  combat.hand.forEach(c => {
    if (c.id === 'burn') {
      const dmg = c.upgraded > 0 ? 4 : 2
      damagePlayer(combat, run, dmg, null, false)
    }
  })
  // 虚空：失去能量
  const voids = combat.hand.filter(c => c.id === 'void').length
  if (voids > 0) {
    P.energy = Math.max(0, P.energy - voids)
    fx(combat, 'text', 'player', undefined, `虚空 -${voids}能量`)
  }
  // 束缚（尖塔生长体）
  if (P.statuses.constricted) {
    damagePlayer(combat, run, P.statuses.constricted, null, false)
  }
  // 欧米茄
  if (P.statuses.omegaActive) {
    combat.enemies.filter(e => !e.dying && e.hp > 0).forEach(e => damageEnemy(combat, run, e, 50, false))
  }
  // 先见之明：回合开始时改为自动触发（预见在 UI 层弹出）
  if (P.statuses.foresight && combat.drawPile.length > 0) {
    beginScry(combat, P.statuses.foresight)
  }
  // 静如水：静相获得格挡
  if (P.statuses.likeWaterS && P.stance === 'calm') {
    playerGainBlock(combat, run, P.statuses.likeWaterS)
  }
  // 金属化
  if (P.statuses.metallicize) playerGainBlock(combat, run, P.statuses.metallicize)
  // 燃烧
  if (P.statuses.combust) {
    damagePlayer(combat, run, 1, null, false)
    combat.enemies.filter(e => !e.dying && e.hp > 0).forEach(e => damageEnemy(combat, run, e, P.statuses.combust, false))
  }
  // 宝球被动（回合结束）
  orbsPassiveEnd(combat, run)
  // 幽魂形态：失去敏捷
  if (P.statuses.wraithFormS) {
    applyStatus(combat, 'player', 'dexterity', -1)
  }
  // 屈伸力量移除
  if (P.tempStr) {
    applyStatus(combat, 'player', 'strength', -P.tempStr)
    P.tempStr = 0
  }
  // 怒相/神格回合结束自动退出
  if (P.stance === 'wrath' || P.stance === 'divinity') {
    P.stance = 'none'
  }
  // 虚无牌消耗
  combat.hand.filter(c => CARDS[c.id]?.ethereal).forEach(c => exhaustCard(combat, run, c, 'hand'))
  // 手牌弃掉（保留的不弃；平衡保留全部）
  const keepAll = !!P.statuses.equilibriumS
  if (!keepAll) {
    combat.hand.filter(c => !CARDS[c.id]?.retain).forEach(c => discardHandCard(combat, c))
    combat.hand = combat.hand.filter(c => CARDS[c.id]?.retain)
  }
  delete P.statuses.equilibriumS
  // 回合结束类状态清理
  delete P.statuses.rage
  delete P.statuses.flameBarrier
  delete P.statuses.doubleTap
  delete P.statuses.noDraw
  delete P.statuses.burstS
  delete P.statuses.amplifyS
  delete P.statuses.entangled
  combat.phase = 'enemy'
  checkCombatEnd(combat, run)
  // 玩家 debuff 递减
  ;['vulnerable', 'weak', 'frail'].forEach(s => {
    if (P.statuses[s]) {
      P.statuses[s] -= 1
      if (P.statuses[s] <= 0) delete P.statuses[s]
    }
  })
}

// ============ 敌人回合（分步执行，供 UI 播放动画） ============
export function enemyTurnStart(combat: CombatState) {
  combat.enemies.forEach(e => {
    if (e.hp <= 0 || e.dying) return
    if (!e.statuses.barricade) e.block = 0
  })
}

// 执行单个敌人的行动。返回 false 表示没有更多行动
export function enemyStep(combat: CombatState, run: RunState): boolean {
  const actor = combat.enemies.find(e => !e.dying && e.hp > 0 && !e.custom.acted)
  if (!actor) return false

  // 敌人中毒：回合开始受到等同层数伤害（无视格挡），然后 -1
  if (actor.statuses.poison) {
    const pd = actor.statuses.poison
    actor.hp -= pd
    fx(combat, 'dmg', actor.uid, pd)
    fx(combat, 'text', actor.uid, undefined, `中毒 -${pd}`)
    actor.statuses.poison -= 1
    if (actor.statuses.poison <= 0) delete actor.statuses.poison
    if (actor.hp <= 0) {
      actor.hp = 0
      onEnemyDeath(combat, run, actor)
      return combat.enemies.some(e => !e.dying && e.hp > 0 && !e.custom.acted)
    }
  }

  // 敌人回合开始触发（该敌人）
  if (actor.statuses.ritual) applyStatus(combat, actor, 'strength', actor.statuses.ritual)
  if (actor.statuses.regen) {
    actor.hp = Math.min(actor.maxHp, actor.hp + actor.statuses.regen)
    actor.statuses.regen -= 1
    if (actor.statuses.regen <= 0) delete actor.statuses.regen
  }

  // 沉睡（保留 Zzz 意图显示）
  if (actor.statuses.asleep) {
    actor.statuses.asleep -= 1
    if (actor.statuses.asleep <= 0) {
      delete actor.statuses.asleep
      delete actor.statuses.metallicizeE
      actor.custom.awoken = 1
    } else if (actor.statuses.metallicizeE) {
      enemyGainBlock(combat, actor, actor.statuses.metallicizeE)
    }
    actor.custom.acted = 1
    return true
  }

  // 行动瞬间清除意图显示（原版行为）
  actor.intent = null

  const def = ENEMIES[actor.id]
  const mvIdx = actor.nextMoveIdx
  if (mvIdx >= 0 && mvIdx < def.moves.length) {
    const mv = def.moves[mvIdx]
    actor.history.push(mvIdx)
    // 攻击前突进动画 fx
    if (mv.dmg) fx(combat, 'lunge', actor.uid)
    // 执行
    if (mv.dmg) {
      const times = mv.times || 1
      for (let t = 0; t < times; t++) {
        const dmg = calcEnemyAttack(mv.dmg, actor.statuses, combat.player.statuses, combat.player.stance)
        damagePlayer(combat, run, dmg, actor, true)
        if (run.hp <= 0) break
      }
    }
    if (mv.block) enemyGainBlock(combat, actor, mv.block)
    if (mv.heal) {
      actor.hp = Math.min(actor.maxHp, actor.hp + mv.heal)
      fx(combat, 'heal', actor.uid, mv.heal)
    }
    if (mv.healAllies) {
      combat.enemies.filter(x => x.hp > 0 && !x.dying && x.uid !== actor.uid).forEach(x => {
        x.hp = Math.min(x.maxHp, x.hp + mv.healAllies!)
        fx(combat, 'heal', x.uid, mv.healAllies!)
      })
    }
    if (mv.summon) {
      const total = combat.enemies.filter(x => x.hp > 0 && !x.dying).length
      const room = Math.max(0, 6 - total)
      for (let i = 0; i < Math.min(mv.summon.count, room); i++) {
        spawnEnemyAt(combat, run, mv.summon.id, null, ENEMIES[mv.summon.id].maxHp)
      }
    }
    if (mv.status) {
      const tgt = mv.status.target === 'player' ? 'player' : actor
      if (mv.status.target === 'allies' || mv.status.target === 'allAllies') {
        combat.enemies.filter(x => x.hp > 0 && !x.dying).forEach(x => applyStatus(combat, x, mv.status!.id, mv.status!.amount))
      } else {
        applyStatus(combat, tgt as any, mv.status.id, mv.status.amount)
      }
    }
    if (mv.status2) {
      const tgt = mv.status2.target === 'player' ? 'player' : actor
      if (mv.status2.target === 'allies' || mv.status2.target === 'allAllies') {
        combat.enemies.filter(x => x.hp > 0 && !x.dying).forEach(x => applyStatus(combat, x, mv.status2!.id, mv.status2!.amount))
      } else {
        applyStatus(combat, tgt as any, mv.status2.id, mv.status2.amount)
      }
    }
    if (mv.addCards) {
      for (let i = 0; i < mv.addCards.count; i++) {
        const card = makeCard(mv.addCards.cardId)
        if (mv.addCards.pile === 'discard') combat.discardPile.push(card)
        else {
          // 随机位置插入抽牌堆
          const pos = Math.floor(Math.random() * (combat.drawPile.length + 1))
          combat.drawPile.splice(pos, 0, card)
        }
      }
    }
    // 特殊招式
    if (mv.custom === 'nobBellow') {
      applyStatus(combat, actor, 'angry', 2)
    }
    if (mv.custom === 'wizardCharge') {
      fx(combat, 'text', actor.uid, undefined, '蓄力中...')
    }
    if (mv.custom === 'guardianCharge') {
      // 守卫者蓄能：格挡≥30 切换攻击模式
      if (actor.block >= 30) {
        actor.custom.attackMode = 1
        actor.custom.attackLeft = 2
        delete actor.statuses.modeShift
        fx(combat, 'text', actor.uid, undefined, '模式切换!')
      }
    }
    if (mv.custom === 'slimePreparing') {
      fx(combat, 'text', actor.uid, undefined, '蓄力中...')
    }
  }
  actor.custom.acted = 1
  // 短暂者：N 回合后逃跑（视作胜利）
  if (def?.escapeAfter && actor.history.length >= def.escapeAfter) {
    actor.dying = true
    actor.intent = null
    fx(combat, 'text', actor.uid, undefined, '消失了...')
  }
  checkCombatEnd(combat, run)
  if (combat.combatOver) return false

  // 守卫者攻击模式计数
  if (actor.id === 'theGuardian' && actor.custom.attackMode) {
    actor.custom.attackLeft -= 1
    if (actor.custom.attackLeft <= 0) {
      actor.custom.attackMode = 0
      actor.block = 0
      applyStatus(combat, actor, 'modeShift', 30)
    }
  }
  return true
}

// 敌人回合收尾
export function enemyTurnEnd(combat: CombatState, run: RunState) {
  combat.enemies.forEach(e => {
    if (e.hp <= 0 || e.dying) return
    delete e.custom.acted
    // 敌人 debuff 递减
    ;['vulnerable', 'weak', 'frail'].forEach(s => {
      if (e.statuses[s]) {
        e.statuses[s] -= 1
        if (e.statuses[s] <= 0) delete e.statuses[s]
      }
    })
    rollEnemyIntent(combat, e)
  })
  // 拉格维林沉睡时的金属化在回合开始处理过了
}

// ============ 战斗结束检查 ============
export function checkCombatEnd(combat: CombatState, run: RunState) {
  if (combat.combatOver) return
  const alive = combat.enemies.filter(e => e.hp > 0 && !e.dying)
  if (alive.length === 0) {
    combat.combatOver = true
    combat.playerWon = true
    combat.phase = 'over'
    combat.combatEndTriggered = true
  } else if (run.hp <= 0) {
    combat.combatOver = true
    combat.playerWon = false
    combat.phase = 'over'
    combat.combatEndTriggered = true
  }
}

// ============ 卡牌打出 ============
export function canPlayCard(combat: CombatState, run: RunState, card: CardInstance): { ok: boolean; reason?: string } {
  const def = CARDS[card.id]
  if (!def) return { ok: false, reason: '未知卡牌' }
  if (def.cost === -99 || def.unplayable) return { ok: false, reason: '不可打出' }
  // 纠缠：无法打出攻击牌
  if (def.type === 'attack' && combat.player.statuses.entangled) return { ok: false, reason: '纠缠：无法打出攻击牌' }
  // 压轴大戏：抽牌堆为空
  if (def.id === 'grandFinale' && combat.drawPile.length > 0) return { ok: false, reason: '抽牌堆必须为空' }
  // 药水墨牌本回合 0 费
  let cost = card.freeThisTurn ? 0 : cardCost(card, combat.player.hpLostThisCombat, combat.player.cardsDiscardedThisTurn || 0)
  // 堕落：技能 0 费
  if (def.type === 'skill' && combat.player.statuses.corruption) cost = 0
  if (def.id === 'clash') {
    const nonAttack = combat.hand.filter(c => CARDS[c.id].type !== 'attack')
    if (nonAttack.length > 0) return { ok: false, reason: '手牌中必须全是攻击牌' }
  }
  if (cost === -1) return { ok: true } // X 费只要有能量就能打
  if (combat.player.energy < Math.max(0, cost)) return { ok: false, reason: '能量不足' }
  // 天鹅绒项圈
  if (run.relics.includes('velvetChoker') && (combat.player.cardsPlayedThisTurn || 0) >= 6) return { ok: false, reason: '天鹅绒项圈：每回合最多6张' }
  return { ok: true }
}

export function playCard(combat: CombatState, run: RunState, uid: string, targetUid: string | null) {
  const card = combat.hand.find(c => c.uid === uid)
  if (!card || combat.phase !== 'player' || combat.combatOver) return
  const def = CARDS[card.id]
  const check = canPlayCard(combat, run, card)
  if (!check.ok) return

  const target = targetUid ? (combat.enemies.find(e => e.uid === targetUid && !e.dying && e.hp > 0) ?? null) : null
  if (def.target === 'enemy' && !target) return

  setCombatRunRef(run)
  setRunRef(run)

  // 费用（药水墨牌本回合 0 费；堕落使技能 0 费）
  let cost = card.freeThisTurn ? 0 : cardCost(card, combat.player.hpLostThisCombat, combat.player.cardsDiscardedThisTurn || 0)
  if (def.type === 'skill' && combat.player.statuses.corruption) cost = 0
  let X = 0
  if (cost === -1) {
    X = combat.player.energy
    combat.player.energy = 0
  } else {
    combat.player.energy -= Math.max(0, cost)
  }
  combat.player.cardsPlayedThisTurn = (combat.player.cardsPlayedThisTurn || 0) + 1

  // 从手牌移除
  const hi = combat.hand.findIndex(c => c.uid === uid)
  combat.hand.splice(hi, 1)

  // 出牌动画 fx（UI 展示卡牌飞入屏幕中央）
  fx(combat, 'cardPlay', 'player', undefined, card.id + '|' + card.upgraded)

  // 咒术（天选者）：打出非攻击牌受到伤害
  if (def.type !== 'attack' && combat.player.statuses.hex) {
    damagePlayer(combat, run, 3 * combat.player.statuses.hex, null, false)
    combat.player.statuses.hex -= 1
    if (combat.player.statuses.hex <= 0) delete combat.player.statuses.hex
  }
  // 腐朽之心死亡节拍：每打出一张牌受到伤害
  combat.enemies.forEach(e => {
    if (e.statuses.beatOfDeath && !e.dying && e.hp > 0) {
      damagePlayer(combat, run, e.statuses.beatOfDeath, null, false)
    }
  })
  // 时间吞噬者：计数
  combat.enemies.forEach(e => {
    if (e.statuses.time !== undefined && !e.dying && e.hp > 0) {
      e.statuses.time += 1
      if (e.statuses.time >= 8) {
        e.statuses.time = 0
        applyStatus(combat, e, 'strength', 2)
        fx(combat, 'text', e.uid, undefined, '时间加速!')
      }
    }
  })
  if (combat.combatOver || run.hp <= 0) return

  // 重复打出：连击（攻击）/ 连发（技能）/ 扩增（能力）/ 回声形态（每回合首张）
  let repeat = 1
  if (def.type === 'attack' && combat.player.statuses.doubleTap) {
    repeat = 2
    combat.player.statuses.doubleTap -= 1
    if (combat.player.statuses.doubleTap <= 0) delete combat.player.statuses.doubleTap
  } else if (def.type === 'skill' && combat.player.statuses.burstS) {
    repeat = 2
    combat.player.statuses.burstS -= 1
    if (combat.player.statuses.burstS <= 0) delete combat.player.statuses.burstS
  } else if (def.type === 'power' && combat.player.statuses.amplifyS) {
    repeat = 2
    combat.player.statuses.amplifyS -= 1
    if (combat.player.statuses.amplifyS <= 0) delete combat.player.statuses.amplifyS
  } else if (combat.player.statuses.echoForm && (combat.player.cardsPlayedThisTurn || 0) <= 1) {
    repeat = 2
  }

  const v = cardValues(card, {
    strikesInDeck: countStrikesSafe(run),
    hpLost: combat.player.hpLostThisCombat,
    rampageBonus: combat.rampage?.[uid] || 0,
    glassKnifePenalty: combat.glassKnife?.[uid] || 0,
    clawBonus: combat.clawBonus || 0,
    shivBonus: combat.player.statuses.accuracy || 0,
  })

  for (let rep = 0; rep < repeat; rep++) {
    applyCardEffect(combat, run, card, def.id, v, target, X, uid)
    if (combat.combatOver) break
  }

  // 狂怒：打出攻击牌获得格挡
  if (def.type === 'attack' && combat.player.statuses.rage) {
    playerGainBlock(combat, run, combat.player.statuses.rage)
  }
  // 残像：打出任意牌获得格挡
  if (combat.player.statuses.afterImage) {
    playerGainBlock(combat, run, combat.player.statuses.afterImage)
  }
  // 千刀万剐：打出任意牌对所有敌人伤害
  if (combat.player.statuses.aThousandCuts) {
    combat.enemies.filter(e => !e.dying && e.hp > 0).forEach(e => damageEnemy(combat, run, e, combat.player.statuses.aThousandCuts, false))
  }
  // 风暴：打出能力牌引导闪电
  if (def.type === 'power' && combat.player.statuses.stormS) {
    for (let i = 0; i < combat.player.statuses.stormS; i++) channelOrb(combat, run, 'lightning')
  }
  // 编织：退出过姿态时返回手牌
  if (def.id === 'weave' && combat.player.exitedStanceThisTurn) {
    combat.hand.push({ ...card, uid: card.uid + '_w' + Math.random().toString(36).slice(2, 5) })
    return
  }

  // 卡牌去向
  const alreadyExhausted = def.exhaust || (def.type === 'skill' && combat.player.statuses.corruption) || card.limitBreakExhaust
  if (alreadyExhausted) {
    combat.exhaustPile.push(card)
    onCardExhausted(combat, run, card)
  } else if (def.id === 'tantrum' || def.id === 'miracle') {
    // 发怒返回手牌；奇迹消耗
    if (def.id === 'tantrum') combat.hand.push(card)
    else { combat.exhaustPile.push(card); onCardExhausted(combat, run, card) }
  } else {
    combat.discardPile.push(card)
  }

  // 攻击牌计数（手里剑/苦无/装饰扇/钢笔笔尖）
  if (def.type === 'attack') {
    combat.player.attacksThisTurn += 1
    const cnt = combat.player.attacksThisTurn
    if (cnt % 3 === 0) {
      if (run.relics.includes('shuriken')) applyStatus(combat, 'player', 'strength', 1)
      if (run.relics.includes('kunai')) applyStatus(combat, 'player', 'dexterity', 1)
      if (run.relics.includes('ornamentalFan')) playerGainBlock(combat, run, 4)
    }
    if (run.relics.includes('penNib')) {
      run.relicCounters.penNib = (run.relicCounters.penNib || 0) + 1
    }
  }

  // 记录最后打出的牌型（观者）
  combat.player.lastCardType = def.type

  // 哥布林大王激怒：玩家打出技能牌
  if (def.type === 'skill') {
    combat.enemies.forEach(e => {
      if (e.statuses.angry && e.hp > 0 && !e.dying) {
        applyStatus(combat, e, 'strength', e.statuses.angry)
      }
    })
  }

  checkCombatEnd(combat, run)
}

// 卡牌进入消耗堆的触发（不搜索牌堆，直接调用）
function onCardExhausted(combat: CombatState, run: RunState, card: CardInstance) {
  if (card.id === 'sentinel') {
    const v = cardValues(card)[1] || 2
    combat.player.energy += v
    fx(combat, 'text', 'player', undefined, `哨卫 +${v}能量`)
  }
  if (combat.player.statuses.feelNoPain) {
    playerGainBlock(combat, run, combat.player.statuses.feelNoPain)
  }
  if (combat.player.statuses.darkEmbrace) {
    drawCards(combat, run, combat.player.statuses.darkEmbrace)
  }
}

function countStrikesSafe(run: RunState): number {
  return run.deck.filter(c => c.id === 'strike' || (CARDS[c.id] && CARDS[c.id].nameEn.includes('Strike'))).length
}

// 玩家攻击敌人（含钢笔笔尖/姿态/幻影杀手）
function playerAttack(combat: CombatState, run: RunState, base: number, target: EnemyInstance | null, strMult = 1, allEnemies = false): number {
  let total = 0
  const doOne = (e: EnemyInstance) => {
    let dmg = calcPlayerAttack(base, combat.player.statuses, e.statuses, strMult, combat.player.stance)
    // 钢笔笔尖
    if (run.relics.includes('penNib') && run.relicCounters.penNib >= 10) {
      dmg *= 2
      run.relicCounters.penNib = 0
      fx(combat, 'text', 'player', undefined, '钢笔笔尖!')
    }
    // 幻影杀手：下一张攻击翻倍
    if (combat.player.statuses.phantasmal) {
      dmg *= 2
      delete combat.player.statuses.phantasmal
      fx(combat, 'text', 'player', undefined, '幻影杀手!')
    }
    const loss = damageEnemy(combat, run, e, dmg, true)
    total += loss
    // 淬毒：未被格挡的攻击伤害施加中毒
    if (loss > 0 && combat.player.statuses.envenomS && target) {
      applyStatus(combat, e, 'poison', combat.player.statuses.envenomS)
    }
  }
  if (allEnemies) {
    combat.enemies.filter(e => !e.dying && e.hp > 0).forEach(doOne)
  } else if (target) {
    doOne(target)
  }
  return total
}

function applyCardEffect(combat: CombatState, run: RunState, card: CardInstance, id: string, v: number[], target: EnemyInstance | null, X: number, uid: string) {
  const P = combat.player
  const all = () => combat.enemies.filter(e => !e.dying && e.hp > 0)
  switch (id) {
    // ---- 基础 ----
    case 'strike': case 'anger': case 'wildStrike':
      playerAttack(combat, run, v[0], target)
      if (id === 'anger') combat.discardPile.push({ ...card, uid: card.uid + '_copy' + Math.random().toString(36).slice(2, 5) })
      if (id === 'wildStrike') {
        const w = makeCard('wound')
        const pos = Math.floor(Math.random() * (combat.drawPile.length + 1))
        combat.drawPile.splice(pos, 0, w)
      }
      break
    case 'defend': case 'shrugItOff': case 'ghostlyArmor':
      playerGainBlock(combat, run, v[0])
      if (id === 'shrugItOff') drawCards(combat, run, 1)
      break
    case 'bash': case 'clothesline': case 'uppercut':
      playerAttack(combat, run, v[0], target)
      if (target && target.hp > 0) {
        if (id === 'bash') applyStatus(combat, target, 'vulnerable', v[1])
        if (id === 'clothesline') applyStatus(combat, target, 'weak', v[1])
        if (id === 'uppercut') { applyStatus(combat, target, 'weak', v[1]); applyStatus(combat, target, 'vulnerable', v[1]) }
      }
      break
    // ---- 普通 ----
    case 'armaments':
      playerGainBlock(combat, run, v[0])
      // 升级选择由 store 层处理（pendingSelect）
      combat.pendingArmaments = card.upgraded > 0 ? 'all' : 'one'
      break
    case 'bodySlam':
      playerAttack(combat, run, P.block, target)
      break
    case 'clash':
      playerAttack(combat, run, v[0], target)
      break
    case 'cleave': case 'immolate': case 'reaper': case 'thunderclap': {
      const healed = playerAttack(combat, run, v[0], null, 1, true)
      if (id === 'thunderclap') all().forEach(e => applyStatus(combat, e, 'vulnerable', v[1]))
      if (id === 'immolate') combat.discardPile.push(makeCard('burn'))
      if (id === 'reaper') healPlayer(run, combat, healed)
      break
    }
    case 'flex':
      applyStatus(combat, 'player', 'strength', v[0])
      P.tempStr = (P.tempStr || 0) + v[0]
      break
    case 'headbutt':
      playerAttack(combat, run, v[0], target)
      combat.pendingHeadbutt = true
      break
    case 'ironWave':
      playerAttack(combat, run, v[0], target)
      playerGainBlock(combat, run, v[1])
      break
    case 'pommelStrike': case 'twinStrike':
      playerAttack(combat, run, v[0], target)
      if (id === 'pommelStrike') drawCards(combat, run, v[1])
      else playerAttack(combat, run, v[0], target)
      break
    case 'perfectedStrike':
      playerAttack(combat, run, v[0] + v[1] * countStrikesSafe(run), target)
      break
    case 'searingBlow':
      playerAttack(combat, run, v[0], target)
      break
    case 'spotWeakness':
      if (target && target.intent && target.intent.type.startsWith('attack')) {
        applyStatus(combat, 'player', 'strength', v[0])
      }
      break
    case 'swordBoomerang':
      for (let i = 0; i < v[1]; i++) {
        const living = all()
        if (living.length === 0) break
        playerAttack(combat, run, v[0], pick(living))
      }
      break
    case 'trueGrit':
      playerGainBlock(combat, run, v[0])
      if (card.upgraded > 0) combat.pendingTrueGrit = true
      else {
        const cands = combat.hand.filter(c => c.uid !== card.uid && !CARDS[c.id].exhaust)
        if (cands.length > 0) exhaustCard(combat, run, pick(cands), 'hand')
      }
      break
    case 'warcry':
      drawCards(combat, run, v[0])
      combat.pendingWarcry = true
      break
    case 'heavyBlade':
      playerAttack(combat, run, v[0], target, v[1])
      break
    case 'inflame':
      applyStatus(combat, 'player', 'strength', v[0])
      break
    // ---- 罕见 ----
    case 'battleTrance':
      drawCards(combat, run, v[0])
      applyStatus(combat, 'player', 'noDraw', 1)
      break
    case 'bloodForBlood':
      playerAttack(combat, run, v[0], target)
      break
    case 'carnage': case 'bludgeon':
      playerAttack(combat, run, v[0], target)
      break
    case 'dropkick':
      playerAttack(combat, run, v[0], target)
      if (target && target.statuses.vulnerable) {
        P.energy += 1
        drawCards(combat, run, 1)
      }
      break
    case 'hemokinesis':
      damagePlayer(combat, run, 2, null, false)
      playerAttack(combat, run, v[0], target)
      break
    case 'pummel':
      for (let i = 0; i < v[1]; i++) {
        if (!target || target.hp <= 0) break
        playerAttack(combat, run, v[0], target)
      }
      break
    case 'rampage':
      playerAttack(combat, run, v[0], target)
      combat.rampage = combat.rampage || {}
      combat.rampage[uid] = (combat.rampage[uid] || 0) + v[1]
      break
    case 'recklessCharge':
      playerAttack(combat, run, v[0], target)
      combat.drawPile.push(makeCard('dazed'))
      break
    case 'whirlwind':
      for (let i = 0; i < X; i++) {
        playerAttack(combat, run, v[0], null, 1, true)
      }
      break
    case 'disarm':
      if (target) applyStatus(combat, target, 'strength', -v[0])
      break
    case 'entrench':
      P.block *= 2
      fx(combat, 'block', 'player', P.block)
      break
    case 'feelNoPain': case 'fireBreathing': case 'evolve': case 'metallicize': case 'rupture': case 'combust': case 'darkEmbrace':
      applyStatus(combat, 'player', id === 'rupture' ? 'rupture' : id, v[0])
      break
    case 'flameBarrier':
      playerGainBlock(combat, run, v[0])
      applyStatus(combat, 'player', 'flameBarrier', v[1])
      break
    case 'intimidate': case 'shockwave':
      all().forEach(e => {
        applyStatus(combat, e, 'weak', v[0])
        if (id === 'shockwave') applyStatus(combat, e, 'vulnerable', v[0])
      })
      break
    case 'powerThrough':
      combat.hand.push(makeCard('wound'), makeCard('wound'))
      playerGainBlock(combat, run, v[0])
      break
    case 'rage':
      applyStatus(combat, 'player', 'rage', v[0])
      break
    case 'secondWind': {
      const nonAttack = combat.hand.filter(c => CARDS[c.id].type !== 'attack')
      nonAttack.forEach(c => exhaustCard(combat, run, c, 'hand'))
      playerGainBlock(combat, run, v[0] * nonAttack.length)
      break
    }
    case 'seeingRed':
      damagePlayer(combat, run, 1, null, false)
      P.energy += v[0]
      break
    case 'sentinel':
      playerGainBlock(combat, run, v[0])
      break
    // ---- 稀有 ----
    case 'feed':
      if (target) {
        const before = target.hp
        playerAttack(combat, run, v[0], target)
        if (before > 0 && target.hp <= 0) {
          run.maxHp += v[1]
          run.hp += v[1]
          fx(combat, 'text', 'player', undefined, `最大生命+${v[1]}`)
        }
      }
      break
    case 'fiendFire': {
      const cnt = combat.hand.length
      combat.hand.forEach(c => exhaustCard(combat, run, c, 'hand'))
      for (let i = 0; i < cnt; i++) playerAttack(combat, run, v[0], target)
      break
    }
    case 'impervious':
      playerGainBlock(combat, run, v[0])
      break
    case 'barricade': case 'brutality': case 'corruption': case 'demonForm':
      applyStatus(combat, 'player', id, v[0] || 1)
      break
    case 'berserk':
      applyStatus(combat, 'player', 'vulnerable', v[0])
      applyStatus(combat, 'player', 'berserk', 1)
      break
    case 'doubleTap':
      applyStatus(combat, 'player', 'doubleTap', v[0])
      break
    case 'juggernaut':
      applyStatus(combat, 'player', 'juggernaut', v[0])
      break
    case 'limitBreak': {
      const str = P.statuses.strength || 0
      if (str > 0) applyStatus(combat, 'player', 'strength', str)
      if (card.upgraded === 0) card.limitBreakExhaust = true
      break
    }
    case 'offering':
      damagePlayer(combat, run, 6, null, false)
      P.energy += 2
      drawCards(combat, run, v[0])
      // 破裂
      if (P.statuses.rupture) applyStatus(combat, 'player', 'strength', P.statuses.rupture)
      break
    // ================= 寂静猎手 =================
    case 'strikeG': case 'slice': case 'neutralize':
      playerAttack(combat, run, v[0], target)
      if (id === 'neutralize' && target && target.hp > 0) applyStatus(combat, target, 'poison', v[1])
      break
    case 'defendG': case 'deflect':
      playerGainBlock(combat, run, v[0])
      break
    case 'survivor':
      playerGainBlock(combat, run, v[0])
      if (combat.hand.length > 0) {
        const c = pick(combat.hand)
        discardHandCard(combat, c)
      }
      break
    case 'bladeDance': {
      for (let i = 0; i < v[0]; i++) combat.hand.push(makeCard('shiv'))
      break
    }
    case 'cloakAndDagger': {
      playerGainBlock(combat, run, v[0])
      const n = v[1]
      const up = card.upgraded > 0 ? 1 : 0
      for (let i = 0; i < n; i++) combat.hand.push(makeCard('shiv', up))
      break
    }
    case 'cripplingCloud':
      for (const e of all()) {
        applyStatus(combat, e, 'poison', v[0])
        applyStatus(combat, e, 'weak', v[1])
        applyStatus(combat, e, 'vulnerable', v[1])
      }
      break
    case 'daggerSpray':
      for (let i = 0; i < v[1]; i++) playerAttack(combat, run, v[0], null, 1, true)
      break
    case 'daggerThrow':
      playerAttack(combat, run, v[0], target)
      drawCards(combat, run, 1)
      if (combat.hand.length > 0) discardHandCard(combat, pick(combat.hand))
      break
    case 'deadlyPoison': case 'corpseExplosion':
      if (target) {
        applyStatus(combat, target, 'poison', v[0])
        if (id === 'corpseExplosion') applyStatus(combat, target, 'corpseExplosionS', 1)
      }
      break
    case 'dodgeAndRoll':
      playerGainBlock(combat, run, v[0])
      P.customFlags = P.customFlags || {}
      P.customFlags.nextBlock = (P.customFlags.nextBlock || 0) + v[0]
      break
    case 'flyingKnee':
      playerAttack(combat, run, v[0], target)
      P.customFlags = P.customFlags || {}
      P.customFlags.nextEnergy = (P.customFlags.nextEnergy || 0) + 1
      break
    case 'outmaneuver':
      P.customFlags = P.customFlags || {}
      P.customFlags.nextEnergy = (P.customFlags.nextEnergy || 0) + v[0]
      break
    case 'poisonedStab':
      playerAttack(combat, run, v[0], target)
      if (target && target.hp > 0) applyStatus(combat, target, 'poison', v[1])
      break
    case 'prepared': case 'acrobatics': {
      const draw = v[0]
      const discardN = id === 'prepared' ? v[0] : 1
      drawCards(combat, run, draw)
      for (let i = 0; i < discardN; i++) {
        if (combat.hand.length > 0) discardHandCard(combat, pick(combat.hand))
      }
      break
    }
    case 'sneakyStrike':
      playerAttack(combat, run, v[0], target)
      if ((P.cardsDiscardedThisTurn || 0) > 0) P.energy += 2
      break
    case 'suckerPunch':
      playerAttack(combat, run, v[0], target)
      if (target && target.hp > 0) applyStatus(combat, target, 'weak', v[1])
      break
    case 'accuracy': case 'footwork':
      applyStatus(combat, 'player', id === 'accuracy' ? 'accuracy' : 'dexterity', v[0])
      break
    case 'backflip':
      playerGainBlock(combat, run, v[0])
      playerAttack(combat, run, v[1], null, 1, true)
      break
    case 'bane':
      playerAttack(combat, run, v[0], target)
      if (target && target.hp > 0 && target.statuses.poison) playerAttack(combat, run, v[0], target)
      break
    case 'bouncingFlask':
      for (let i = 0; i < v[1]; i++) {
        const living = all()
        if (living.length === 0) break
        applyStatus(combat, pick(living), 'poison', v[0])
      }
      break
    case 'calculatedGamble': {
      const cnt = combat.hand.length
      combat.hand.forEach(c => discardHandCard(combat, c))
      combat.hand = []
      drawCards(combat, run, cnt)
      break
    }
    case 'caltropsS':
      applyStatus(combat, 'player', 'caltropsS', v[0])
      break
    case 'catalyst':
      if (target && target.statuses.poison) {
        const cur = target.statuses.poison
        applyStatus(combat, target, 'poison', cur * (v[0] - 1))
      }
      break
    case 'concentrate': {
      const n = v[0]
      for (let i = 0; i < n; i++) {
        if (combat.hand.length > 0) discardHandCard(combat, pick(combat.hand))
      }
      P.energy += v[1]
      break
    }
    case 'dash':
      playerGainBlock(combat, run, v[1])
      playerAttack(combat, run, v[0], target)
      break
    case 'distraction': {
      const pool = Object.values(CARDS).filter(c => c.type === 'skill' && c.rarity !== 'special' && c.color === 'green')
      for (let i = 0; i < v[0]; i++) {
        if (pool.length) {
          const c = makeCard(pick(pool).id)
          c.freeThisTurn = true
          combat.hand.push(c)
        }
      }
      break
    }
    case 'endlessAgony':
      playerAttack(combat, run, v[0], target)
      break
    case 'eviscerate':
      for (let i = 0; i < v[1]; i++) {
        if (!target || target.hp <= 0) break
        playerAttack(combat, run, v[0], target)
      }
      break
    case 'expertise': case 'scrawl': {
      const target2 = id === 'scrawl' ? v[0] : v[0]
      while (combat.hand.length < target2 && combat.drawPile.length + combat.discardPile.length > 0) {
        const before = combat.hand.length
        drawCards(combat, run, 1)
        if (combat.hand.length === before) break
      }
      break
    }
    case 'finisher': {
      const times = Math.max(1, P.attacksThisTurn)
      for (let i = 0; i < times; i++) {
        if (!target || target.hp <= 0) break
        playerAttack(combat, run, v[0], target)
      }
      break
    }
    case 'heelHook':
      playerAttack(combat, run, v[0], target)
      if (target && target.statuses.weak) {
        P.energy += 1
        drawCards(combat, run, 1)
      }
      break
    case 'legSweep':
      applyStatus(combat, target!, 'weak', v[1])
      playerGainBlock(combat, run, v[0])
      break
    case 'predator':
      playerAttack(combat, run, v[0], target)
      P.customFlags = P.customFlags || {}
      P.customFlags.nextDraw = (P.customFlags.nextDraw || 0) + 2
      break
    case 'terror':
      applyStatus(combat, target!, 'vulnerable', v[0])
      break
    case 'aThousandCuts':
      applyStatus(combat, 'player', 'aThousandCuts', v[0])
      break
    case 'adrenaline':
      P.energy += v[0]
      drawCards(combat, run, v[1])
      if (card.upgraded > 0) applyStatus(combat, 'player', 'dexterity', 1)
      break
    case 'afterImage':
      applyStatus(combat, 'player', 'afterImage', v[0])
      break
    case 'burst':
      applyStatus(combat, 'player', 'burstS', v[0])
      break
    case 'dieDieDie':
      playerAttack(combat, run, v[0], null, 1, true)
      break
    case 'envenomS':
      applyStatus(combat, 'player', 'envenomS', v[0])
      break
    case 'glassKnife':
      for (let i = 0; i < 2; i++) {
        if (!target || target.hp <= 0) break
        playerAttack(combat, run, v[0], target)
      }
      combat.glassKnife = combat.glassKnife || {}
      combat.glassKnife[uid] = (combat.glassKnife[uid] || 0) + v[1]
      break
    case 'grandFinale':
      playerAttack(combat, run, v[0], null, 1, true)
      break
    case 'nightmare':
      combat.pendingNightmare = null
      combat.player.customFlags = combat.player.customFlags || {}
      combat.player.customFlags.pendingNightmareSelect = v[0]
      break
    case 'phantasmalKiller':
      applyStatus(combat, 'player', 'phantasmal', 1)
      break
    case 'stormOfSteel': {
      const cnt = combat.hand.length
      const up = card.upgraded > 0 ? 1 : 0
      combat.hand.forEach(c => discardHandCard(combat, c))
      combat.hand = []
      for (let i = 0; i < cnt; i++) combat.hand.push(makeCard('shiv', up))
      break
    }
    case 'wraithForm':
      applyStatus(combat, 'player', 'intangible', v[0])
      applyStatus(combat, 'player', 'wraithFormS', 1)
      break
    case 'shiv':
      playerAttack(combat, run, v[0], target)
      break
    // ================= 故障机器人 =================
    case 'strikeB':
      playerAttack(combat, run, v[0], target)
      break
    case 'defendB': case 'leap': case 'autoShields':
      if (id === 'autoShields' && P.block > 0) break
      playerGainBlock(combat, run, v[0])
      break
    case 'zap': case 'darkness': {
      const n = v[0]
      for (let i = 0; i < n; i++) channelOrb(combat, run, id === 'zap' ? 'lightning' : 'dark')
      break
    }
    case 'dualcast':
      for (let i = 0; i < v[0]; i++) evokeTopOrb(combat, run)
      break
    case 'ballLightning':
      playerAttack(combat, run, v[0], target)
      channelOrb(combat, run, 'lightning')
      break
    case 'barrage': {
      const n = (P.orbs || []).length
      for (let i = 0; i < n; i++) {
        if (!target || target.hp <= 0) break
        playerAttack(combat, run, v[0], target)
      }
      break
    }
    case 'beamCell':
      playerAttack(combat, run, v[0], target)
      if (target && target.hp > 0) applyStatus(combat, target, 'vulnerable', v[1])
      break
    case 'claw':
      playerAttack(combat, run, v[0], target)
      combat.clawBonus = (combat.clawBonus || 0) + 2
      break
    case 'coldSnap':
      playerAttack(combat, run, v[0], target)
      channelOrb(combat, run, 'frost')
      break
    case 'compileDriver': {
      const types = new Set((P.orbs || []).map(o => o.type))
      playerAttack(combat, run, v[0], target)
      drawCards(combat, run, Math.max(1, types.size))
      break
    }
    case 'goForTheEyes':
      playerAttack(combat, run, v[0], target)
      if (target && target.hp > 0 && target.intent && target.intent.type.startsWith('attack')) {
        applyStatus(combat, target, 'weak', v[1])
      }
      break
    case 'hologram':
      playerGainBlock(combat, run, v[0])
      combat.player.customFlags = combat.player.customFlags || {}
      combat.player.customFlags.pendingHologram = 1
      break
    case 'reprogram':
      applyStatus(combat, 'player', 'focus', -1)
      applyStatus(combat, 'player', 'strength', v[0])
      applyStatus(combat, 'player', 'dexterity', v[0])
      break
    case 'sweepBeam':
      playerAttack(combat, run, v[0], null, 1, true)
      channelOrb(combat, run, 'lightning')
      break
    case 'blizzard': {
      const n = (P.orbs || []).filter(o => o.type === 'frost').length
      if (n > 0) playerAttack(combat, run, v[0] * n, null, 1, true)
      break
    }
    case 'capacitor':
      applyStatus(combat, 'player', 'capacitor', v[0])
      P.orbSlots = (P.orbSlots ?? 3) + v[0]
      break
    case 'chargeBattery':
      playerGainBlock(combat, run, v[0])
      P.customFlags = P.customFlags || {}
      P.customFlags.nextEnergy = (P.customFlags.nextEnergy || 0) + 1
      break
    case 'chill': {
      const n = Math.floor(combat.hand.length / 2) * v[0]
      for (let i = 0; i < n; i++) channelOrb(combat, run, 'frost')
      break
    }
    case 'consume':
      applyStatus(combat, 'player', 'focus', v[0])
      P.orbSlots = Math.max(0, (P.orbSlots ?? 3) - 1)
      break
    case 'defragment':
      applyStatus(combat, 'player', 'focus', v[0])
      break
    case 'doomAndGloom':
      playerAttack(combat, run, v[0], null, 1, true)
      channelOrb(combat, run, 'dark')
      break
    case 'equilibrium':
      playerGainBlock(combat, run, v[0])
      applyStatus(combat, 'player', 'equilibriumS', 1)
      break
    case 'glacier':
      playerGainBlock(combat, run, v[0])
      for (let i = 0; i < v[1]; i++) channelOrb(combat, run, 'frost')
      break
    case 'loopS':
      applyStatus(combat, 'player', 'loopS', v[0])
      break
    case 'melter':
      if (target) target.block = 0
      playerAttack(combat, run, v[0], target)
      break
    case 'overclock':
      drawCards(combat, run, v[0])
      combat.discardPile.push(makeCard('burn'))
      break
    case 'skim':
      drawCards(combat, run, v[0])
      break
    case 'staticDischargeS':
      applyStatus(combat, 'player', 'staticDischargeS', v[0])
      break
    case 'stormS':
      applyStatus(combat, 'player', 'stormS', v[0])
      break
    case 'tempest': {
      const n = X + (card.upgraded > 0 ? 1 : 0)
      for (let i = 0; i < n; i++) channelOrb(combat, run, 'lightning')
      break
    }
    case 'whiteNoise': {
      const pool = Object.values(CARDS).filter(c => c.type === 'power' && c.rarity !== 'special' && c.color === 'blue')
      if (pool.length) {
        const c = makeCard(pick(pool).id)
        c.freeThisTurn = true
        combat.hand.push(c)
      }
      break
    }
    case 'allForOne':
      playerAttack(combat, run, v[0], target)
      // 弃牌堆所有0费牌返回手牌
      const zeroCost = combat.discardPile.filter(c => {
        const d = CARDS[c.id]
        return d && d.cost === 0
      })
      zeroCost.forEach(c => {
        const i = combat.discardPile.findIndex(x => x.uid === c.uid)
        if (i >= 0) {
          combat.discardPile.splice(i, 1)
          combat.hand.push(c)
        }
      })
      break
    case 'amplifyS':
      applyStatus(combat, 'player', 'amplifyS', v[0])
      break
    case 'electrodynamics': {
      // 电动力学：闪电命中所有敌人（本场战斗）+ 引导闪电
      applyStatus(combat, 'player', 'electro', v[1] || 1)
      for (let i = 0; i < v[0]; i++) channelOrb(combat, run, 'lightning')
      break
    }
    case 'coreSurge':
      playerAttack(combat, run, v[0], target)
      applyStatus(combat, 'player', 'artifact', 1)
      break
    case 'creativeAI':
      applyStatus(combat, 'player', 'creativeAI', 1)
      break
    case 'echoForm':
      applyStatus(combat, 'player', 'echoForm', 1)
      break
    case 'hyperbeam':
      playerAttack(combat, run, v[0], null, 1, true)
      applyStatus(combat, 'player', 'focus', -v[1])
      break
    case 'machineLearning':
      applyStatus(combat, 'player', 'machineLearning', v[0])
      break
    case 'meteorStrike':
      playerAttack(combat, run, v[0], target)
      for (let i = 0; i < v[1]; i++) channelOrb(combat, run, 'plasma')
      break
    case 'multiCast': {
      const n = X + (card.upgraded > 0 ? 1 : 0)
      for (let i = 0; i < n; i++) evokeTopOrb(combat, run)
      break
    }
    case 'rainbow':
      for (let i = 0; i < v[0]; i++) {
        channelOrb(combat, run, 'lightning')
        channelOrb(combat, run, 'frost')
        channelOrb(combat, run, 'dark')
        channelOrb(combat, run, 'plasma')
      }
      break
    case 'reboot':
      combat.drawPile = shuffle([...combat.drawPile, ...combat.discardPile])
      combat.discardPile = []
      drawCards(combat, run, v[0])
      break
    case 'seek':
      combat.player.customFlags = combat.player.customFlags || {}
      combat.player.customFlags.pendingSeek = v[0]
      break
    case 'thunderStrike': {
      const n = P.lightningChanneled || 0
      for (let i = 0; i < n; i++) {
        const living = all()
        if (living.length === 0) break
        playerAttack(combat, run, v[0], pick(living))
      }
      break
    }
    // ================= 观者 =================
    case 'strikeP':
      playerAttack(combat, run, v[0], target)
      break
    case 'defendP': case 'protect': case 'emptyBody': case 'sanctity':
      playerGainBlock(combat, run, v[0])
      if (id === 'emptyBody') exitStance(combat, run)
      if (id === 'sanctity' && P.lastCardType === 'skill') drawCards(combat, run, 1)
      break
    case 'eruption':
      playerAttack(combat, run, v[0], target)
      enterStance(combat, run, 'wrath')
      break
    case 'vigilance':
      playerGainBlock(combat, run, v[0])
      enterStance(combat, run, 'calm')
      break
    case 'bowlingBash': case 'consecration':
      playerAttack(combat, run, v[0], null, 1, true)
      break
    case 'crushJoint':
      playerAttack(combat, run, v[0], target)
      if (target && target.hp > 0 && (P.cardsPlayedThisTurn || 0) === 2) applyStatus(combat, target, 'vulnerable', v[1])
      break
    case 'cutThroughFate':
      playerAttack(combat, run, v[0], target)
      beginScry(combat, v[1])
      break
    case 'emptyFist':
      playerAttack(combat, run, v[0], target)
      exitStance(combat, run)
      break
    case 'flyingSleeves':
      for (let i = 0; i < v[1]; i++) {
        if (!target || target.hp <= 0) break
        playerAttack(combat, run, v[0], target)
      }
      break
    case 'followUp':
      playerAttack(combat, run, v[0], target)
      if (P.lastCardType === 'attack') P.energy += 1
      break
    case 'foresight':
      applyStatus(combat, 'player', 'foresight', v[0])
      break
    case 'halt':
      playerGainBlock(combat, run, v[0] + (P.stance === 'wrath' ? v[1] : 0))
      break
    case 'justLucky':
      beginScry(combat, 1)
      playerGainBlock(combat, run, v[0])
      drawCards(combat, run, 1)
      break
    case 'pressurePoints':
      all().forEach(e => applyStatus(combat, e, 'mark', v[0]))
      all().forEach(e => {
        if (e.statuses.mark) damageEnemy(combat, run, e, e.statuses.mark, false)
      })
      break
    case 'prostrate':
      gainMantra(combat, run, v[0])
      playerGainBlock(combat, run, v[1])
      break
    case 'tranquility':
      enterStance(combat, run, 'calm')
      break
    case 'carveReality':
      playerAttack(combat, run, v[0], target)
      if (P.stance === 'wrath') combat.hand.push(makeCard('smite'))
      break
    case 'conclude':
      playerAttack(combat, run, v[0], null, 1, true)
      P.customFlags = P.customFlags || {}
      P.customFlags.endTurnNow = 1
      break
    case 'emptyMind':
      if (P.exitedStanceThisTurn) drawCards(combat, run, v[0])
      break
    case 'fasting':
      applyStatus(combat, 'player', 'strength', v[0])
      applyStatus(combat, 'player', 'dexterity', -2)
      break
    case 'fearNoEvil':
      playerAttack(combat, run, v[0], target)
      if (target && target.intent && target.intent.type.startsWith('attack')) enterStance(combat, run, 'calm')
      break
    case 'indignation':
      if (P.stance === 'wrath') all().forEach(e => applyStatus(combat, e, 'vulnerable', v[0]))
      else enterStance(combat, run, 'wrath')
      break
    case 'innerPeace':
      if (P.stance === 'calm') drawCards(combat, run, v[0])
      else enterStance(combat, run, 'calm')
      break
    case 'likeWaterS':
      applyStatus(combat, 'player', 'likeWaterS', v[0])
      break
    case 'mentalFortressS':
      applyStatus(combat, 'player', 'mentalFortressS', v[0])
      break
    case 'nirvanaS':
      applyStatus(combat, 'player', 'nirvanaS', v[0])
      break
    case 'tantrum':
      playerAttack(combat, run, v[0], target)
      enterStance(combat, run, 'wrath')
      break
    case 'wallop': {
      const before = target ? target.hp + target.block : 0
      playerAttack(combat, run, v[0], target)
      const dealt = target ? before - (target.hp + target.block) : 0
      if (dealt > 0) playerGainBlock(combat, run, dealt)
      break
    }
    case 'waveOfTheHand':
      playerAttack(combat, run, v[0], null, 1, true)
      all().forEach(e => applyStatus(combat, e, 'weak', v[1]))
      break
    case 'weave':
      playerAttack(combat, run, v[0], target)
      break
    case 'wheelKick':
      playerAttack(combat, run, v[0], target)
      drawCards(combat, run, 2)
      if (combat.hand.length > 0) discardHandCard(combat, pick(combat.hand))
      break
    case 'alphaS':
      applyStatus(combat, 'player', 'alphaS', 1)
      break
    case 'blasphemy':
      applyStatus(combat, 'player', 'blasphemyD', 1)
      enterStance(combat, run, 'divinity')
      break
    case 'brillianceS':
      applyStatus(combat, 'player', 'brillianceS', v[0])
      break
    case 'devotionS':
      applyStatus(combat, 'player', 'devotionS', v[0])
      break
    case 'omniscience':
      combat.player.customFlags = combat.player.customFlags || {}
      combat.player.customFlags.pendingOmniscience = 2
      break
    case 'spiritShield':
      playerGainBlock(combat, run, v[0] * combat.hand.length)
      break
    case 'vault':
      applyStatus(combat, 'player', 'vaultS', 1)
      P.customFlags = P.customFlags || {}
      P.customFlags.endTurnNow = 1
      break
    case 'smite':
      playerAttack(combat, run, v[0], target)
      break
    case 'miracle':
      P.energy += v[0]
      break
    case 'beta':
      applyStatus(combat, 'player', 'betaActive', 1)
      break
    case 'omega':
      applyStatus(combat, 'player', 'omegaActive', 1)
      break
    default:
      // 状态牌等
      break
  }

  // 破裂：因打牌失去生命的其他场合已在各处处理
}

// ============ 药水 ============
export function usePotion(combat: CombatState, run: RunState, idx: number, targetUid: string | null): boolean {
  const pid = run.potions[idx]
  if (!pid || !combat || combat.combatOver) return false
  const target = targetUid ? (combat.enemies.find(e => e.uid === targetUid && !e.dying && e.hp > 0) ?? null) : null
  switch (pid) {
    case 'firePotion':
      if (!target) return false
      damageEnemy(combat, run, target, 20, false)
      break
    case 'blockPotion': playerGainBlock(combat, run, 12); break
    case 'strengthPotion': applyStatus(combat, 'player', 'strength', 2); break
    case 'dexterityPotion': applyStatus(combat, 'player', 'dexterity', 2); break
    case 'energyPotion': combat.player.energy += 2; break
    case 'explosivePotion':
      combat.enemies.filter(e => !e.dying && e.hp > 0).forEach(e => damageEnemy(combat, run, e, 10, false))
      break
    case 'fearPotion':
      if (!target) return false
      applyStatus(combat, target, 'vulnerable', 3)
      break
    case 'weakPotion':
      combat.enemies.filter(e => !e.dying && e.hp > 0).forEach(e => applyStatus(combat, e, 'weak', 3))
      break
    case 'swiftPotion': drawCards(combat, run, 3); break
    case 'bloodPotion': healPlayer(run, combat, Math.floor(run.maxHp * 0.2)); break
    case 'fruitJuice': run.maxHp += 5; run.hp += 5; break
    case 'poisonPotion':
      if (!target) return false
      applyStatus(combat, target, 'poison', 6)
      break
    case 'ghostInAJar':
      applyStatus(combat, 'player', 'intangible', 1)
      break
    case 'liquidBronze':
      applyStatus(combat, 'player', 'metallicize', 3)
      break
    case 'cultistPotion':
      applyStatus(combat, 'player', 'ritual', 1)
      break
    case 'skillPotion': case 'attackPotion': {
      const pool = Object.values(CARDS).filter(c => c.rarity !== 'special' && c.rarity !== 'starter' && c.type === (pid === 'skillPotion' ? 'skill' : 'attack') && c.rarity !== 'rare')
      const c = makeCard(pick(pool).id)
      c.freeThisTurn = true
      combat.hand.push(c)
      break
    }
    case 'fairyInBottle': return false // 不能主动使用
  }
  run.potions[idx] = null
  checkCombatEnd(combat, run)
  return true
}

// ============ 非战斗场景使用药水（地图/事件等） ============
export function usePotionOutOfCombat(run: RunState, idx: number): { ok: boolean; msg?: string } {
  const pid = run.potions[idx]
  if (!pid) return { ok: false }
  const def = POTIONS[pid]
  switch (pid) {
    case 'bloodPotion': {
      run.potions[idx] = null
      const heal = Math.min(Math.floor(run.maxHp * 0.2), run.maxHp - run.hp)
      healPlayer(run, null, Math.floor(run.maxHp * 0.2))
      return { ok: true, msg: `血液药水：回复 ${heal} 点生命` }
    }
    case 'fruitJuice':
      run.potions[idx] = null
      run.maxHp += 5
      run.hp += 5
      return { ok: true, msg: '果汁：最大生命值永久提高 5 点' }
    default:
      // 其余药水仅战斗中可用（firePotion: '对一名敌人造成 20 点伤害'）
      return { ok: false, msg: `${def?.name ?? '该药水'} 仅能在战斗中使用` }
  }
}
