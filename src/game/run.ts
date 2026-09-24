// ============ 运行级逻辑：角色/涅奥/奖励、商店、事件、幕间推进 ============
import {
  RunState, RewardState, ShopState, CardInstance, Screen,
  CharacterId, NeowOption,
} from './types'
import { CARDS, makeCard, poolByRarity, starterDeckIds, cardColor } from './cards'
import { RELICS, shopRelicPool, bossRelicPool } from './relics'
import { POTIONS, potionPool } from './potions'
import { EVENTS } from './events'
import {
  ACT1_EASY_ENCOUNTERS, ACT1_HARD_ENCOUNTERS, ACT1_ELITE_ENCOUNTERS, ACT1_BOSS_ENCOUNTERS,
  ACT2_EASY_ENCOUNTERS, ACT2_HARD_ENCOUNTERS, ACT2_ELITE_ENCOUNTERS, ACT2_BOSS_ENCOUNTERS,
  ACT3_EASY_ENCOUNTERS, ACT3_HARD_ENCOUNTERS, ACT3_ELITE_ENCOUNTERS, ACT3_BOSS_ENCOUNTERS,
  ACT4_ELITE_ENCOUNTERS, ACT4_BOSS_ENCOUNTERS, Encounter,
} from './enemies'
import { generateMap, generateAct4Map, reachableNodes } from './map'

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function rnd(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ============ 角色信息 ============
export const CHARACTER_INFO: Record<CharacterId, {
  name: string; nameEn: string; hp: number; relic: string; desc: string; sprite: string
}> = {
  ironclad: { name: '铁甲战士', nameEn: 'Ironclad', hp: 75, relic: 'burningBlood', desc: '被放逐的战士，以燃烧之血作战。', sprite: 'ironclad' },
  silent: { name: '寂静猎手', nameEn: 'The Silent', hp: 70, relic: 'ringOfTheSnake', desc: '致命的猎手，用毒刃与小刀猎杀。', sprite: 'silent' },
  defect: { name: '故障机器人', nameEn: 'Defect', hp: 75, relic: 'crackedCore', desc: '战斗傀儡，以充能球毁灭敌人。', sprite: 'defect' },
  watcher: { name: '观者', nameEn: 'Watcher', hp: 72, relic: 'pureWater', desc: '盲眼修女，以姿态与真言审判。', sprite: 'watcher' },
}

// ============ 涅奥祝福选项 ============
export function makeNeowOptions(): NeowOption[] {
  const opts: NeowOption[] = []
  // 槽位1：力量（随机遗物）
  opts.push({
    id: 'power', title: '「我会赐予你力量」',
    desc: '获得一件随机普通遗物。', effect: 'relic',
  })
  // 槽位2：生命（最大生命提升 或 痊愈）
  if (Math.random() < 0.5) {
    opts.push({
      id: 'maxhp', title: '「我会强化你的身躯」',
      desc: '最大生命值提高 8 点。', effect: 'maxHp', value: 8,
    })
  } else {
    opts.push({
      id: 'heal', title: '「我会治愈你的伤痛」',
      desc: '回复所有生命值。', effect: 'heal',
    })
  }
  // 槽位3：财富（金币 或 药水）
  if (Math.random() < 0.6) {
    opts.push({
      id: 'gold', title: '「我会赐予你财富」',
      desc: '获得 100 金币。', effect: 'gold', value: 100,
    })
  } else {
    opts.push({
      id: 'potions', title: '「我会赐予你补给」',
      desc: '获得 3 瓶随机药水。', effect: 'potions', value: 3,
    })
  }
  // 槽位4：卡牌（移除/升级/转化/复制）
  const cardEffects = [
    { id: 'remove', title: '「我会净化你的卡组」', desc: '移除一张牌。', effect: 'removeCard' },
    { id: 'upgrade', title: '「我会锤炼你的卡牌」', desc: '升级一张牌。', effect: 'upgradeCard' },
    { id: 'transform', title: '「我会改变你的命运」', desc: '转化一张牌（变为随机牌）。', effect: 'transformCard' },
    { id: 'duplicate', title: '「我会复制你的精华」', desc: '复制一张牌。', effect: 'duplicateCard' },
  ]
  opts.push(pick(cardEffects))
  return opts
}

// ============ 新开一局 ============
export function newRun(character: CharacterId = 'ironclad'): RunState {
  const info = CHARACTER_INFO[character]
  const deck = starterDeckIds(character).map(id => makeCard(id))
  return {
    hp: info.hp, maxHp: info.hp, gold: 99,
    character,
    deck,
    relics: [info.relic],
    potions: [null, null, null],
    map: generateMap(Math.floor(Math.random() * 1e9)),
    currentNodeId: null,
    visitedNodes: [],
    screen: 'neow',
    combat: null, reward: null, shop: null,
    currentEvent: null, eventsSeen: [],
    removalCount: 0, eliteKilled: 0, monsterKilled: 0, goldEarned: 0,
    act: 1,
    relicCounters: {},
    gameOverInfo: null,
    neow: { options: makeNeowOptions(), chosen: null },
    bossesSeen: [],
    nextActInfo: null,
  }
}

// ============ 幕间推进 ============
export function advanceAct(run: RunState): void {
  run.act += 1
  run.currentNodeId = null
  run.visitedNodes = []
  run.currentEvent = null
  run.reward = null
  run.shop = null
  run.map = run.act >= 4
    ? generateAct4Map(Math.floor(Math.random() * 1e9))
    : generateMap(Math.floor(Math.random() * 1e9))
  run.screen = 'map'
}

// ============ 遭遇选择 ============
export function pickEncounter(run: RunState, isElite: boolean, isBoss: boolean): { name: string; enemies: string[] } {
  const act = run.act
  const bossPool = act === 1 ? ACT1_BOSS_ENCOUNTERS : act === 2 ? ACT2_BOSS_ENCOUNTERS : act === 3 ? ACT3_BOSS_ENCOUNTERS : ACT4_BOSS_ENCOUNTERS
  const elitePool = act === 1 ? ACT1_ELITE_ENCOUNTERS : act === 2 ? ACT2_ELITE_ENCOUNTERS : act === 3 ? ACT3_ELITE_ENCOUNTERS : ACT4_ELITE_ENCOUNTERS
  const easyPool = act === 1 ? ACT1_EASY_ENCOUNTERS : act === 2 ? ACT2_EASY_ENCOUNTERS : act === 3 ? ACT3_EASY_ENCOUNTERS : ACT1_EASY_ENCOUNTERS
  const hardPool = act === 1 ? ACT1_HARD_ENCOUNTERS : act === 2 ? ACT2_HARD_ENCOUNTERS : act === 3 ? ACT3_HARD_ENCOUNTERS : ACT1_HARD_ENCOUNTERS
  if (isBoss) {
    // 本局未见过的 boss 优先
    let pool = bossPool.filter(e => !run.bossesSeen.includes(e.name))
    if (pool.length === 0) pool = bossPool
    const enc = pick(pool)
    run.bossesSeen.push(enc.name)
    return enc
  }
  if (isElite) return pick(elitePool)
  // 前几层简单，后面困难
  const floor = run.visitedNodes.length
  const pool: Encounter[] = floor <= 4 ? easyPool : [...easyPool, ...hardPool]
  // 避免与上次相同
  const last = run.combat?.encounterName
  let enc = pick(pool)
  if (pool.length > 1 && enc.name === last) enc = pick(pool.filter(e => e.name !== last))
  return enc
}

// ============ 战斗奖励生成 ============
export function makeCombatReward(run: RunState, isElite: boolean, isBoss: boolean): RewardState {
  const reward: RewardState = { taken: [] }

  // 金币
  let gold = run.combat?.goldReward ?? 10
  gold = Math.floor(gold * (1 + 0.1 * (run.act - 1)))
  if (run.relics.includes('goldenIdol')) gold = Math.floor(gold * 1.25)
  reward.gold = gold

  // 卡牌奖励（3 张，按稀有度概率；按角色卡池）
  const nCards = run.relics.includes('bustedCrown') ? 2 : 3
  let rareChance = 0.04 + (isElite ? 0.10 : 0) + Math.min(0.08, run.monsterKilled * 0.005)
  const cards: string[] = []
  const poolCommon = shuffle(poolByRarity('common', run.character))
  const poolUncommon = shuffle(poolByRarity('uncommon', run.character))
  const poolRare = shuffle(poolByRarity('rare', run.character))
  for (let i = 0; i < nCards; i++) {
    const r = Math.random()
    if (r < rareChance && poolRare.length) cards.push(poolRare.pop()!)
    else if (r < rareChance + 0.37 && poolUncommon.length) cards.push(poolUncommon.pop()!)
    else if (poolCommon.length) cards.push(poolCommon.pop()!)
    else if (poolUncommon.length) cards.push(poolUncommon.pop()!)
  }
  reward.cards = cards

  // 精英掉遗物
  if (isElite) {
    const owned = new Set(run.relics)
    const pool = shuffle(shopRelicPool().filter(id => !owned.has(id)))
    if (pool.length) reward.relic = pool[0]
  }

  // 药水掉落
  if (run.combat?.potionDrop && !run.relics.includes('sozu')) {
    reward.potion = pick(potionPool())
  }

  return reward
}

// ============ 商店生成 ============
export function makeShop(run: RunState): ShopState {
  const owned = new Set(run.relics)
  const cards: ShopState['cards'] = []
  const seen = new Set<string>()
  // 5 张卡：2 普通 2 罕见 1 稀有（近似原版；按角色卡池）
  const slots: Array<'common' | 'common' | 'uncommon' | 'uncommon' | 'rare'> = ['common', 'common', 'uncommon', 'uncommon', 'rare']
  slots.forEach(rar => {
    const pool = shuffle(poolByRarity(rar, run.character).filter(id => !seen.has(id)))
    if (!pool.length) return
    const id = pool[0]
    seen.add(id)
    const base = rar === 'common' ? rnd(45, 55) : rar === 'uncommon' ? rnd(68, 82) : rnd(135, 165)
    cards.push({ cardId: id, price: base, sold: false, upgraded: false })
  })

  const relics: ShopState['relics'] = []
  const relicPool = shuffle(shopRelicPool().filter(id => !owned.has(id)))
  for (let i = 0; i < 3 && i < relicPool.length; i++) {
    const def = RELICS[relicPool[i]]
    const price = def.rarity === 'common' ? rnd(143, 167) : rnd(231, 273)
    relics.push({ relicId: relicPool[i], price, sold: false })
  }

  const potions: ShopState['potions'] = []
  const potPool = shuffle(potionPool())
  for (let i = 0; i < 3; i++) {
    const def = POTIONS[potPool[i]]
    const price = def.rarity === 'common' ? rnd(48, 58) : def.rarity === 'uncommon' ? rnd(65, 79) : rnd(95, 111)
    potions.push({ potionId: potPool[i], price, sold: false })
  }

  return {
    cards, relics, potions,
    removalUsed: false,
    removalPrice: 75 + run.removalCount * 25,
  }
}

// ============ 事件选择效果（返回描述与副作用） ============
export interface EventResult {
  msg?: string
  // 需要选牌的操作
  select?: 'remove' | 'upgrade' | 'upgradeStrikeDefend' | 'randomUpgrade' | 'randomUpgradeSkill' | 'randomUpgradeAttack' | 'sacrifice'
  gold?: number
  combat?: boolean
  relic?: string
  healPct?: number
  maxHp?: number
  done?: boolean
}

export function applyEventEffect(run: RunState, eventId: string, effect: string): EventResult {
  switch (effect) {
    case 'leave':
      return { done: true }
    case 'fish_banana':
      return { healPct: 1 / 3, msg: '你吃下了香蕉，感觉恢复了活力。', done: true }
    case 'fish_box': {
      const owned = new Set(run.relics)
      const pool = shopRelicPool().filter(id => !owned.has(id))
      if (!pool.length) return { msg: '盒子里空空如也。', done: true }
      return { relic: pick(shuffle(pool)), msg: '你打开了盒子，获得了一件遗物！', done: true }
    }
    case 'golden_pray':
      return { select: 'upgradeStrikeDefend', msg: '雕像的光芒笼罩了你的卡牌。', done: true }
    case 'loot_gold': {
      if (Math.random() < 0.3) {
        return { gold: rnd(15, 25), combat: true, msg: '你搜刮背包时惊动了埋伏的怪物！' }
      }
      return { gold: rnd(25, 60), msg: '你获得了金币。', done: true }
    }
    case 'cleric_heal':
      if (run.gold < 35) return { msg: '金币不足。', done: false }
      run.gold -= 35
      return { healPct: 0.25, msg: '牧师的治疗之手温暖了你的伤口。', done: true }
    case 'cleric_purify':
      if (run.gold < 50) return { msg: '金币不足。', done: false }
      run.gold -= 50
      return { select: 'remove', msg: '牧师净化了你的一张卡牌。', done: true }
    case 'workshop_upgrade':
      return { select: 'randomUpgrade', msg: '机械臂改造了一张你的卡牌。', done: true }
    case 'sacrifice_remove':
      return { select: 'sacrifice', msg: '火焰吞噬了你的卡牌。', done: true }
    case 'spirits_upgrade':
      return { select: 'upgrade', msg: '灵体强化了一张你的卡牌。', done: true }
    default:
      return { done: true }
  }
}

export { EVENTS }

// ============ Boss 遗物选择 ============
export function bossRelicChoices(run: RunState): string[] {
  const owned = new Set(run.relics)
  const pool = shuffle(bossRelicPool().filter(id => !owned.has(id)))
  const out: string[] = []
  for (const id of pool) {
    if (out.length >= 3) break
    out.push(id)
  }
  return out
}

// ============ 获得遗物（获得时效果） ============
export function gainRelic(run: RunState, id: string) {
  if (run.relics.includes(id)) return
  run.relics.push(id)
  // 获得时效果
  if (id === 'warPaint') {
    const cands = shuffle(run.deck.filter(c => CARDS[c.id].type === 'skill' && c.upgraded === 0))
    cands.slice(0, 2).forEach(c => { c.upgraded = 1 })
  }
  if (id === 'whetstone') {
    const cands = shuffle(run.deck.filter(c => CARDS[c.id].type === 'attack' && c.upgraded === 0 && c.id !== 'searingBlow'))
    cands.slice(0, 2).forEach(c => { c.upgraded = 1 })
  }
  if (id === 'fruitJuiceRelic') { /* noop */ }
}

// ============ 药水栏（找空位） ============
export function addPotion(run: RunState, potionId: string): boolean {
  const idx = run.potions.findIndex(p => p === null)
  if (idx < 0) return false
  run.potions[idx] = potionId
  return true
}

// ============ 涅奥祝福：转化（变成随机同角色卡） ============
export function transformCardId(run: RunState, cardId: string): string {
  const color = cardColor(cardId)
  const pool = Object.values(CARDS).filter(c => {
    const c1 = c.color || 'red'
    return c1 === color && c.rarity !== 'special' && c.rarity !== 'starter' && c.id !== cardId
  })
  return pool.length ? pick(shuffle(pool)).id : cardId
}

export { reachableNodes }
