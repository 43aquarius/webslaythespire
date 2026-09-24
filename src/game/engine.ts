// ============ 战斗引擎（核心逻辑） ============
// 可变状态设计：store 层负责克隆，本层直接修改传入的 state
import {
  CombatState, EnemyInstance, CardInstance, StatusMap,
  RunState, FxEvent, Intent,
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
export function calcPlayerAttack(base: number, player: StatusMap, target: StatusMap, strMult = 1): number {
  let dmg = base + Math.floor((player.strength || 0) * strMult)
  if (player.weak) dmg = Math.floor(dmg * 0.75)
  if (target.vulnerable) dmg = Math.floor(dmg * 1.5)
  return Math.max(0, dmg)
}

export function calcEnemyAttack(base: number, enemy: StatusMap, player: StatusMap): number {
  let dmg = base + (enemy.strength || 0)
  if (enemy.weak) dmg = Math.floor(dmg * 0.75)
  if (player.vulnerable) dmg = Math.floor(dmg * 1.5)
  return Math.max(0, dmg)
}

export function calcBlock(base: number, statuses: StatusMap): number {
  let blk = base + (statuses.dexterity || 0)
  if (statuses.frail) blk = Math.floor(blk * 0.75)
  return Math.max(0, blk)
}

export function enemyDisplayDamage(enemy: EnemyInstance, playerStatuses: StatusMap): { dmg: number; times: number } {
  const i = enemy.intent
  if (!i || !i.damage) return { dmg: 0, times: 0 }
  return { dmg: calcEnemyAttack(i.damage, enemy.statuses, playerStatuses), times: i.times || 1 }
}

// ============ 状态施加 ============
export function applyStatus(combat: CombatState, target: 'player' | EnemyInstance, id: string, amount: number) {
  if (amount === 0) return
  const map: StatusMap = target === 'player' ? combat.player.statuses : target.statuses
  if (map.artifact && amount < 0) {
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
  let hpLoss = amount
  if (e.block > 0) {
    const absorbed = Math.min(e.block, amount)
    e.block -= absorbed
    hpLoss = amount - absorbed
  }
  e.hp -= hpLoss
  e.flash = true
  fx(combat, 'dmg', e.uid, amount)
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
  let hpLoss = amount
  if (combat.player.block > 0) {
    const absorbed = Math.min(combat.player.block, amount)
    combat.player.block -= absorbed
    hpLoss = amount - absorbed
  }
  run.hp -= hpLoss
  combat.player.hpLostThisCombat += hpLoss
  if (amount > 0) fx(combat, 'dmg', 'player', amount)
  if (hpLoss > 0) {
    fx(combat, 'shake', 'player')
    // 世纪魔方：战斗中第一次因攻击失去生命 → 抽1张
    if (isAttack && run.relics.includes('centennialPuzzle') && !combat.player.customFlags?.puzzleUsed) {
      combat.player.customFlags = combat.player.customFlags || {}
      combat.player.customFlags.puzzleUsed = 1
      drawCards(combat, run, 1)
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
  e.dying = true
  e.intent = null
  // 真菌兽孢子云
  const def = ENEMIES[e.id]
  if (def?.onDeath === 'sporeCloud') {
    applyStatus(combat, 'player', 'vulnerable', 2)
  }
  if (def?.onDeath === 'splitAcid' || def?.onDeath === 'splitBoss') {
    // 分裂出小型史莱姆
    const spawnId = def.onDeath === 'splitBoss' ? null : 'acidSlimeS'
    if (def.onDeath === 'splitBoss') {
      spawnEnemyAt(combat, run, 'acidSlimeM', e, Math.ceil(e.maxHp * 0.25))
      spawnEnemyAt(combat, run, 'spikeSlimeM', e, Math.ceil(e.maxHp * 0.25))
    } else {
      spawnEnemyAt(combat, run, spawnId, e, 7)
      spawnEnemyAt(combat, run, spawnId, e, 7)
    }
  }
  if (def?.onDeath === 'splitSpike') {
    spawnEnemyAt(combat, run, 'spikeSlimeS', e, 7)
    spawnEnemyAt(combat, run, 'spikeSlimeS', e, 7)
  }
  checkCombatEnd(combat, run)
}

function spawnEnemyAt(combat: CombatState, run: RunState, id: string, source: EnemyInstance, hp: number) {
  const def = ENEMIES[id]
  const inst: EnemyInstance = {
    uid: `e${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    id, hp: Math.min(hp, def.maxHp), maxHp: Math.min(hp, def.maxHp),
    block: 0, statuses: def.startStatuses ? { ...def.startStatuses } : {},
    history: [], intent: null, nextMoveIdx: 0, flash: false, dying: false, custom: {},
  }
  if (id === 'spikeSlimeM') inst.statuses.thorns = 3
  // 插到原位置附近
  const idx = combat.enemies.findIndex(x => x.uid === source.uid)
  combat.enemies.splice(idx + 1, 0, inst)
  rollEnemyIntent(combat, inst)
  fx(combat, 'text', inst.uid, undefined, '分裂!')
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
  if (def?.exhaustOnDiscard) combat.exhaustPile.push(card)
  else combat.discardPile.push(card)
}

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
  if (intent.damage) {
    intent.damage = calcEnemyAttack(intent.damage, e.statuses, combat.player.statuses)
  }
  e.intent = intent
}

// 哨卫三人组相位偏移
export function initEncounter(combat: CombatState, enemyIds: string[]) {
  combat.enemies.forEach((e, i) => {
    if (e.id === 'sentry') e.custom.cycleOffset = i % 2
    rollEnemyIntent(combat, e)
  })
}

// ============ 开始战斗 ============
export function startCombat(run: RunState, encounterName: string, enemyIds: string[], isElite: boolean, isBoss: boolean): CombatState {
  const combat: CombatState = {
    enemies: [],
    player: {
      block: 0, statuses: {}, energy: 0, maxEnergy: 3,
      hpLostThisCombat: 0, attacksThisTurn: 0, tempStr: 0, customFlags: {},
    },
    drawPile: shuffle(run.deck.map(c => ({ ...c }))),
    hand: [], discardPile: [], exhaustPile: [],
    turn: 0, phase: 'player',
    encounterName, isElite, isBoss,
    goldReward: isBoss ? rnd(95, 105) : isElite ? rnd(25, 35) : rnd(10, 20),
    potionDrop: !run.relics.includes('sozu') && Math.random() < 0.40,
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
  if (run.relics.includes('bronzeScales')) applyStatus(combat, 'player', 'thorns', 3)
  if (run.relics.includes('bloodVial')) healPlayer(run, combat, 2)
  if (run.relics.includes('bagOfMarbles')) {
    combat.enemies.forEach(e => applyStatus(combat, e, 'vulnerable', 1))
  }
  if (run.relics.includes('philosophersStone')) {
    combat.enemies.forEach(e => applyStatus(combat, e, 'strength', 1))
  }

  startPlayerTurn(combat, run, true)
  return combat
}

// ============ 玩家回合 ============
export function startPlayerTurn(combat: CombatState, run: RunState, first = false) {
  combat.turn += 1
  combat.phase = 'player'
  combat.player.attacksThisTurn = 0
  combat.player.cardsPlayedThisTurn = 0

  // 壁垒：保留格挡
  if (!combat.player.statuses.barricade) combat.player.block = 0

  // 能量
  let energy = combat.player.maxEnergy
  if (first && run.relics.includes('lantern')) energy += 1
  if (combat.player.statuses.berserk) energy += 1
  combat.player.energy = energy

  // 回合开始触发
  if (combat.player.statuses.demonForm) applyStatus(combat, 'player', 'strength', combat.player.statuses.demonForm)
  if (combat.player.statuses.brutality) {
    damagePlayer(combat, run, 1, null, false)
    if (run.hp > 0) drawCards(combat, run, 1)
  }
  if (combat.player.statuses.regen) {
    healPlayer(run, combat, combat.player.statuses.regen)
    combat.player.statuses.regen -= 1
    if (combat.player.statuses.regen <= 0) delete combat.player.statuses.regen
  }
  if (first && run.relics.includes('anchor')) playerGainBlock(combat, run, 10)

  // 抽牌
  let drawN = 5
  if (first && run.relics.includes('bagOfPreparation')) drawN += 2
  drawCards(combat, run, drawN)
}

export function endPlayerTurn(combat: CombatState, run: RunState) {
  // 灼伤
  combat.hand.forEach(c => {
    if (c.id === 'burn') {
      const dmg = c.upgraded > 0 ? 4 : 2
      damagePlayer(combat, run, dmg, null, false)
    }
  })
  // 金属化
  if (combat.player.statuses.metallicize) playerGainBlock(combat, run, combat.player.statuses.metallicize)
  // 燃烧
  if (combat.player.statuses.combust) {
    damagePlayer(combat, run, 1, null, false)
    combat.enemies.filter(e => !e.dying && e.hp > 0).forEach(e => damageEnemy(combat, run, e, combat.player.statuses.combust, false))
  }
  // 屈伸力量移除
  if (combat.player.tempStr) {
    applyStatus(combat, 'player', 'strength', -combat.player.tempStr)
    combat.player.tempStr = 0
  }
  // 虚无牌消耗
  combat.hand.filter(c => CARDS[c.id]?.ethereal).forEach(c => exhaustCard(combat, run, c, 'hand'))
  // 手牌弃掉（保留的不弃）
  combat.hand.filter(c => !CARDS[c.id]?.retain).forEach(c => discardHandCard(combat, c))
  combat.hand = combat.hand.filter(c => CARDS[c.id]?.retain)
  // 回合结束类状态清理
  delete combat.player.statuses.rage
  delete combat.player.statuses.flameBarrier
  delete combat.player.statuses.doubleTap
  delete combat.player.statuses.noDraw
  combat.phase = 'enemy'
  checkCombatEnd(combat, run)
  // 玩家 debuff 递减
  ;['vulnerable', 'weak', 'frail'].forEach(s => {
    if (combat.player.statuses[s]) {
      combat.player.statuses[s] -= 1
      if (combat.player.statuses[s] <= 0) delete combat.player.statuses[s]
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

  // 敌人回合开始触发（该敌人）
  if (actor.statuses.ritual) applyStatus(combat, actor, 'strength', actor.statuses.ritual)
  if (actor.statuses.regen) {
    actor.hp = Math.min(actor.maxHp, actor.hp + actor.statuses.regen)
    actor.statuses.regen -= 1
    if (actor.statuses.regen <= 0) delete actor.statuses.regen
  }

  // 沉睡
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

  const def = ENEMIES[actor.id]
  const mvIdx = actor.nextMoveIdx
  if (mvIdx >= 0 && mvIdx < def.moves.length) {
    const mv = def.moves[mvIdx]
    actor.history.push(mvIdx)
    // 执行
    if (mv.dmg) {
      const times = mv.times || 1
      for (let t = 0; t < times; t++) {
        const dmg = calcEnemyAttack(mv.dmg, actor.statuses, combat.player.statuses)
        damagePlayer(combat, run, dmg, actor, true)
        if (run.hp <= 0) break
      }
    }
    if (mv.block) enemyGainBlock(combat, actor, mv.block)
    if (mv.status) {
      const tgt = mv.status.target === 'player' ? 'player' : actor
      applyStatus(combat, tgt as any, mv.status.id, mv.status.amount)
    }
    if (mv.status2) {
      const tgt = mv.status2.target === 'player' ? 'player' : actor
      applyStatus(combat, tgt as any, mv.status2.id, mv.status2.amount)
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
  if (def.cost === -99) return { ok: false, reason: '不可打出' }
  let cost = cardCost(card, combat.player.hpLostThisCombat)
  // 堕落：技能 0 费
  if (def.type === 'skill' && combat.player.statuses.corruption) cost = 0
  if (def.id === 'clash') {
    const nonAttack = combat.hand.filter(c => CARDS[c.id].type !== 'attack')
    if (nonAttack.length > 0) return { ok: false, reason: '手牌中必须全是攻击牌' }
  }
  if (cost === -1) return { ok: true } // X 费只要有能量就能打
  if (combat.player.energy < Math.max(0, cost)) return { ok: false, reason: '能量不足' }
  // 天鹅绒项圈
  if (run.relics.includes('velvetChoker') && combat.player.cardsPlayedThisTurn >= 6) return { ok: false, reason: '天鹅绒项圈：每回合最多6张' }
  return { ok: true }
}

export function playCard(combat: CombatState, run: RunState, uid: string, targetUid: string | null) {
  const card = combat.hand.find(c => c.uid === uid)
  if (!card || combat.phase !== 'player' || combat.combatOver) return
  const def = CARDS[card.id]
  const check = canPlayCard(combat, run, card)
  if (!check.ok) return

  const target = targetUid ? combat.enemies.find(e => e.uid === targetUid && !e.dying && e.hp > 0) : null
  if (def.target === 'enemy' && !target) return

  // 费用
  let cost = cardCost(card, combat.player.hpLostThisCombat)
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

  // 药水墨牌：费用为 0
  if (card.freeThisTurn) cost = 0

  // 连击：攻击牌双倍
  const repeat = def.type === 'attack' && combat.player.statuses.doubleTap ? 2 : 1
  if (def.type === 'attack' && combat.player.statuses.doubleTap) {
    combat.player.statuses.doubleTap -= 1
    if (combat.player.statuses.doubleTap <= 0) delete combat.player.statuses.doubleTap
  }

  const v = cardValues(card, {
    strikesInDeck: countStrikesSafe(run),
    hpLost: combat.player.hpLostThisCombat,
    rampageBonus: combat.rampage?.[uid] || 0,
  })

  for (let rep = 0; rep < repeat; rep++) {
    applyCardEffect(combat, run, card, def.id, v, target, X, uid)
    if (combat.combatOver) break
  }

  // 狂怒：打出攻击牌获得格挡
  if (def.type === 'attack' && combat.player.statuses.rage) {
    playerGainBlock(combat, run, combat.player.statuses.rage)
  }

  // 卡牌去向
  if (def.exhaust || (def.type === 'skill' && combat.player.statuses.corruption) || card.limitBreakExhaust) {
    combat.exhaustPile.push(card)
    onCardExhausted(combat, run, card)
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

// 玩家攻击敌人（含钢笔笔尖）
function playerAttack(combat: CombatState, run: RunState, base: number, target: EnemyInstance | null, strMult = 1, allEnemies = false): number {
  let total = 0
  const doOne = (e: EnemyInstance) => {
    let dmg = calcPlayerAttack(base, combat.player.statuses, e.statuses, strMult)
    // 钢笔笔尖
    if (run.relics.includes('penNib') && run.relicCounters.penNib >= 10) {
      dmg *= 2
      run.relicCounters.penNib = 0
      fx(combat, 'text', 'player', undefined, '钢笔笔尖!')
    }
    total += damageEnemy(combat, run, e, dmg, true)
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
      P.tempStr += v[0]
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
  const target = targetUid ? combat.enemies.find(e => e.uid === targetUid && !e.dying && e.hp > 0) : null
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
