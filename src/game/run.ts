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
import { setRunActive, syncRunActive } from './mp'

/** 联机：构造玩家个人数据 */
export function makeRunPlayer(character: CharacterId, name = '玩家'): import('./types').RunPlayer {
  const info = CHARACTER_INFO[character]
  return {
    name,
    character,
    hp: info.hp,
    maxHp: info.hp,
    gold: 99,
    deck: starterDeckIds(character).map(id => makeCard(id)),
    relics: [info.relic],
    potions: [null, null, null],
    relicCounters: {},
    goldEarned: 0,
  }
}

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

// ============ 涅奥祝福选项（还原原版四槽结构） ============
// 第一祝福：卡牌相关 / 第二祝福：普通增益 / 第三祝福：代价+强力奖励 / 第四祝福：Boss交换
const NEOW_MAXHP: Record<CharacterId, [number, number]> = {
  // [第二祝福加值, 第三祝福代价减值]（原版：铁甲+8/6/7/7）
  ironclad: [8, 8], silent: [6, 7], defect: [7, 7], watcher: [7, 7],
}
const NEOW_TRADE_MAXHP: Record<CharacterId, [number, number]> = {
  // 第三祝福：[代价 -maxHP, 奖励 +maxHP]（原版 +16/12/14/14）
  ironclad: [8, 16], silent: [7, 12], defect: [7, 14], watcher: [7, 14],
}
const CURSE_IDS = ['regret', 'injury', 'doubt']

export function makeNeowOptions(character: CharacterId = 'ironclad'): NeowOption[] {
  const opts: NeowOption[] = []

  // ---- 第一祝福（卡牌类，随机一种） ----
  const firstPool: NeowOption[] = [
    { id: 'n1_remove', title: '「我会净化你的卡组」', desc: '移除一张牌。', effect: 'removeCard' },
    { id: 'n1_transform', title: '「我会改变你的命运」', desc: '转化一张牌（变为随机牌）。', effect: 'transformCard' },
    { id: 'n1_upgrade', title: '「我会锤炼你的卡牌」', desc: '升级一张牌。', effect: 'upgradeCard' },
    { id: 'n1_gain', title: '「我会赠予你卡牌」', desc: '从 3 张随机卡牌中选择一张获得。', effect: 'gainCard' },
    { id: 'n1_rare', title: '「我会赐予你珍宝」', desc: '获得一张随机稀有卡牌。', effect: 'randomRareCard' },
  ]
  opts.push(pick(firstPool))

  // ---- 第二祝福（普通增益，随机一种） ----
  const secondPool: NeowOption[] = [
    { id: 'n2_maxhp', title: '「我会强化你的身躯」', desc: `最大生命值提高 ${NEOW_MAXHP[character][0]} 点。`, effect: 'maxHp', value: NEOW_MAXHP[character][0] },
    { id: 'n2_lament', title: '「我为你哀歌」', desc: '接下来 3 场战斗中，敌人以 1 点生命值开始。', effect: 'neowLament', value: 3 },
    { id: 'n2_relic', title: '「我会赐予你力量」', desc: '获得一件随机普通遗物。', effect: 'relic' },
    { id: 'n2_gold', title: '「我会赐予你财富」', desc: '获得 100 金币。', effect: 'gold', value: 100 },
    { id: 'n2_potions', title: '「我会赐予你补给」', desc: '获得 3 瓶随机药水。', effect: 'potions', value: 3 },
  ]
  opts.push(pick(secondPool))

  // ---- 第三祝福（代价 + 强力奖励；遵循原版配对例外） ----
  const disadv: Array<{ id: string; title: string; effect: string }> = [
    { id: 'd_maxhp', title: `最大生命值 -${NEOW_TRADE_MAXHP[character][0]}`, effect: 'loseMaxHp' },
    { id: 'd_damage', title: '受到伤害（当前生命的约 30%）', effect: 'takeDamage' },
    { id: 'd_curse', title: '获得一张诅咒', effect: 'curseCard' },
    { id: 'd_gold', title: '失去所有金币', effect: 'loseGold' },
  ]
  const adv: Array<{ id: string; title: string; effect: string }> = [
    { id: 'a_remove2', title: '移除 2 张牌', effect: 'removeCard2' },
    { id: 'a_transform2', title: '转化 2 张牌', effect: 'transformCard2' },
    { id: 'a_gold', title: '获得 250 金币', effect: 'gold' },
    { id: 'a_rare', title: '从 3 张稀有卡牌中选择一张获得', effect: 'chooseRareCard' },
    { id: 'a_relic', title: '获得一件随机罕见遗物', effect: 'rareRelic' },
    { id: 'a_maxhp', title: `最大生命值 +${NEOW_TRADE_MAXHP[character][1]}`, effect: 'gainMaxHp' },
  ]
  let d = pick(disadv)
  let a = pick(adv)
  // 原版配对例外：移除2×诅咒 / +250金币×失去金币 / +maxHP×-maxHP 不共存
  const badPair = (d: string, a: string) =>
    (d === 'd_curse' && a === 'a_remove2') ||
    (d === 'd_gold' && a === 'a_gold') ||
    (d === 'd_maxhp' && a === 'a_maxhp')
  let guard = 0
  while (badPair(d.id, a.id) && guard++ < 10) {
    if (guard % 2 === 1) a = pick(adv.filter(x => !badPair(d.id, x.id)))
    else d = pick(disadv.filter(x => !badPair(x.id, a.id)))
  }
  opts.push({
    id: 'n3_trade',
    title: '「一切皆有代价」',
    desc: `${d.title}，但${a.title}。`,
    effect: 'tradeoff',
    disadvantage: d.effect,
    advantage: a.effect,
    value: NEOW_TRADE_MAXHP[character][1],
  })

  // ---- 第四祝福（Boss 交换，恒定出现） ----
  opts.push({
    id: 'n4_bossswap',
    title: '「与我交换力量吧」',
    desc: '用你的初始遗物交换一件随机 Boss 遗物。',
    effect: 'bossSwap',
  })
  return opts
}

// 3 张随机卡（第一祝福：从角色卡池任意稀有度；第三祝福：稀有卡池）
export function neowOfferCards(character: CharacterId, rareOnly: boolean): string[] {
  const out: string[] = []
  const picked = new Set<string>()
  const drawOne = (rarity: 'common' | 'uncommon' | 'rare'): string | null => {
    const pool = shuffle(poolByRarity(rarity, character)).filter(id => !picked.has(id))
    if (!pool.length) return null
    picked.add(pool[0])
    return pool[0]
  }
  if (rareOnly) {
    for (let i = 0; i < 3; i++) { const id = drawOne('rare'); if (id) out.push(id) }
  } else {
    // 任意稀有度：按战斗奖励概率近似（60/37/3 不含偏移）
    for (let i = 0; i < 3; i++) {
      const roll = Math.random()
      let id: string | null = null
      if (roll < 0.03) id = drawOne('rare')
      else if (roll < 0.40) id = drawOne('uncommon')
      else id = drawOne('common')
      if (!id) id = drawOne('uncommon') ?? drawOne('common') ?? drawOne('rare')
      if (id) out.push(id)
    }
  }
  return out
}

// 加权随机药水（原版概率：普通 65% / 罕见 25% / 稀有 10%）
export function weightedPotionPick(exclude: string[] = []): string {
  const pools: Array<[string[], number]> = [
    [potionPool().filter(id => POTIONS[id].rarity === 'common' && !exclude.includes(id)), 65],
    [potionPool().filter(id => POTIONS[id].rarity === 'uncommon' && !exclude.includes(id)), 25],
    [potionPool().filter(id => POTIONS[id].rarity === 'rare' && !exclude.includes(id)), 10],
  ]
  const total = pools.reduce((s, [p]) => s + p.length, 0)
  if (!total) return pick(potionPool())
  let roll = Math.random() * 100
  for (const [p, w] of pools) {
    if (!p.length) continue
    if (roll < w) return pick(p)
    roll -= w
  }
  return pick(pools.find(([p]) => p.length)?.[0] ?? potionPool())
}

// ============ 新开一局（单人） ============
export function newRun(character: CharacterId = 'ironclad'): RunState {
  const info = CHARACTER_INFO[character]
  const deck = starterDeckIds(character).map(id => makeCard(id))
  const p0 = {
    name: '玩家', character,
    hp: info.hp, maxHp: info.hp, gold: 99,
    deck, relics: [info.relic], potions: [null, null, null] as (string | null)[],
    relicCounters: {}, goldEarned: 0,
  }
  return {
    hp: info.hp, maxHp: info.hp, gold: 99,
    character,
    deck,
    relics: [info.relic],
    potions: [null, null, null],
    players: [p0],
    activeIdx: 0,
    map: generateMap(Math.floor(Math.random() * 1e9)),
    currentNodeId: null,
    visitedNodes: [],
    screen: 'neow',
    combat: null, reward: null, shop: null,
    currentEvent: null, eventsSeen: [],
    removalCount: 0, eliteKilled: 0, monsterKilled: 0, goldEarned: 0,
    act: 1,
    relicCounters: {},
    rarePity: 0,
    potionLuck: 0.4,
    gameOverInfo: null,
    neow: { options: makeNeowOptions(character), chosen: null },
    bossesSeen: [],
    nextActInfo: null,
  }
}

// ============ 新开一局（联机双人合作，仿杀戮尖塔2） ============
export function newMultiRun(
  hostChar: CharacterId, guestChar: CharacterId,
  hostName = '房主', guestName = '队友',
): RunState {
  const players = [makeRunPlayer(hostChar, hostName), makeRunPlayer(guestChar, guestName)]
  const run: RunState = {
    hp: players[0].hp, maxHp: players[0].maxHp, gold: players[0].gold,
    character: hostChar,
    deck: players[0].deck,
    relics: players[0].relics,
    potions: players[0].potions,
    players,
    activeIdx: 0,
    map: generateMap(Math.floor(Math.random() * 1e9)),
    currentNodeId: null,
    visitedNodes: [],
    screen: 'neow',
    combat: null, reward: null, shop: null,
    currentEvent: null, eventsSeen: [],
    removalCount: 0, eliteKilled: 0, monsterKilled: 0, goldEarned: 0,
    act: 1,
    relicCounters: players[0].relicCounters,
    gameOverInfo: null,
    neow: {
      options: [], chosen: null,
      mpOptions: [makeNeowOptions(hostChar), makeNeowOptions(guestChar)],
      chooserIdx: 0,
      mpChosen: [null, null],
    },
    bossesSeen: [],
    nextActInfo: null,
  }
  return run
}

// ============ 幕间推进 ============
export function advanceAct(run: RunState): void {
  run.act += 1
  run.currentNodeId = null
  run.visitedNodes = []
  run.currentEvent = null
  run.reward = null
  run.shop = null
  run.mpRest = null
  run.potionLuck = 0.4   // 原版：药水掉率每幕重置为 40%
  run.map = run.act >= 4
    ? generateAct4Map(Math.floor(Math.random() * 1e9))
    : generateMap(Math.floor(Math.random() * 1e9))
  run.screen = 'map'
  // 联机：全体存活玩家回复（仿尖塔2幕间治疗）；单人保持原有行为（无变化）
  if (run.players.length > 1) {
    run.players.forEach(p => { p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.2)) })
    syncRunActive(run)
  }
}

export { setRunActive }

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

// ============ 战斗奖励生成（数值对照原版 Wiki） ============
export function makeCombatReward(run: RunState, isElite: boolean, isBoss: boolean): RewardState {
  const reward: RewardState = { taken: [] }
  const mp = run.players.length > 1
  const anyRelic = (id: string) => run.players.some(p => p.relics.includes(id))
  const act = run.act

  // 金币（原版：普通 10-20 / 精英 25-35 / Boss 95-105；第3、4幕Boss无任何消耗品奖励）
  if (!(isBoss && act >= 3)) {
    let gold = run.combat?.goldReward ?? 10
    if (anyRelic('goldenIdol')) gold = Math.floor(gold * 1.25)
    reward.gold = gold
  }

  // 卡牌奖励：第1、2幕Boss = 3 张稀有卡三选一（原版）；普通 3%/精英 10% 基础 + 偏移系统
  const rollCards = (character: CharacterId, hasBustedCrown: boolean): string[] => {
    const nCards = hasBustedCrown ? 2 : 3
    // Boss（1-2幕）：全部稀有
    if (isBoss && act <= 2) return shuffle(poolByRarity('rare', character)).slice(0, nCards)
    const baseRare = isElite ? 0.10 : 0.03
    const uncommonC = isElite ? 0.40 : 0.37
    const cards: string[] = []
    const poolCommon = shuffle(poolByRarity('common', character))
    const poolUncommon = shuffle(poolByRarity('uncommon', character))
    const poolRare = shuffle(poolByRarity('rare', character))
    for (let i = 0; i < nCards; i++) {
      // 原版偏移系统：稀有概率 = 基础-5%+1%×(自上次稀有后逐出的普通卡数)
      const rareChance = Math.max(0, baseRare - 0.05 + 0.01 * (run.rarePity ?? 0))
      const r = Math.random()
      if (r < rareChance && poolRare.length) {
        cards.push(poolRare.pop()!)
        run.rarePity = 0   // 出稀有卡后偏移重置
      } else if (r < rareChance + uncommonC && poolUncommon.length) {
        cards.push(poolUncommon.pop()!)
      } else if (poolCommon.length) {
        cards.push(poolCommon.pop()!)
        run.rarePity = (run.rarePity ?? 0) + 1   // 每逐出一张普通卡，稀有概率+1%
      } else if (poolUncommon.length) {
        cards.push(poolUncommon.pop()!)
      }
    }
    return cards
  }
  if (!(isBoss && act >= 3)) {
    if (mp) {
      // 联机：每位玩家从自己角色卡池独立获得一份三选一
      reward.mpCards = run.players.map(p => rollCards(p.character, p.relics.includes('bustedCrown')))
      reward.mpDone = run.players.map(() => false)
    } else {
      reward.cards = rollCards(run.character, run.relics.includes('bustedCrown'))
    }
  }

  // 精英掉遗物（联机：先到先得，点击者获得）
  if (isElite) {
    const owned = new Set(run.players.flatMap(p => p.relics))
    const pool = shuffle(shopRelicPool().filter(id => !owned.has(id)))
    if (pool.length) reward.relic = pool[0]
  }

  // 药水掉落（原版：40%基础，掉落-10%/未掉+10%，每幕重置；按稀有度 65/25/10 加权）
  if (run.combat?.potionDrop && !anyRelic('sozu')) {
    reward.potion = weightedPotionPick()
  }

  return reward
}

// ============ 商店生成（对照原版：2攻2技1能 + 随机50%折扣 + 按稀有度定价） ============
export function makeShop(run: RunState): ShopState {
  const owned = new Set(run.relics)
  const cards: ShopState['cards'] = []
  const seen = new Set<string>()
  // 5 张卡：原版固定 2 攻击 + 2 技能 + 1 能力，稀有度按商店权重 9/37/54（受偏移影响但不改变偏移）
  const slots: Array<'attack' | 'attack' | 'skill' | 'skill' | 'power'> = ['attack', 'attack', 'skill', 'skill', 'power']
  for (const type of slots) {
    const pools = {
      common: shuffle(poolByRarity('common', run.character)).filter(id => !seen.has(id) && CARDS[id].type === type),
      uncommon: shuffle(poolByRarity('uncommon', run.character)).filter(id => !seen.has(id) && CARDS[id].type === type),
      rare: shuffle(poolByRarity('rare', run.character)).filter(id => !seen.has(id) && CARDS[id].type === type),
    }
    const rareChance = Math.max(0, 0.09 - 0.05 + 0.01 * (run.rarePity ?? 0))
    const roll = Math.random()
    let id: string | undefined
    if (roll < rareChance && pools.rare.length) id = pools.rare[0]
    else if (roll < rareChance + 0.37 && pools.uncommon.length) id = pools.uncommon[0]
    else if (pools.common.length) id = pools.common[0]
    else if (pools.uncommon.length) id = pools.uncommon[0]
    else if (pools.rare.length) id = pools.rare[0]
    if (!id) continue
    seen.add(id)
    const def = CARDS[id]
    const base = def.rarity === 'common' ? rnd(45, 55) : def.rarity === 'uncommon' ? rnd(68, 83) : rnd(135, 165)
    cards.push({ cardId: id, price: base, sold: false, upgraded: false })
  }
  // 原版：一张随机卡 50% 折扣
  if (cards.length) {
    const lucky = cards[Math.floor(Math.random() * cards.length)]
    lucky.price = Math.max(1, Math.floor(lucky.price / 2))
    lucky.discount = true
  }

  // 3 件遗物（原版价格：普通 143-158 / 罕见 238-263 / 稀有 285-315）
  const relics: ShopState['relics'] = []
  const relicPool = shuffle(shopRelicPool().filter(id => !owned.has(id)))
  for (let i = 0; i < 3 && i < relicPool.length; i++) {
    const def = RELICS[relicPool[i]]
    const price = def.rarity === 'common' ? rnd(143, 158) : def.rarity === 'uncommon' ? rnd(238, 263) : rnd(285, 315)
    relics.push({ relicId: relicPool[i], price, sold: false })
  }

  // 3 瓶药水（原版权重 65/25/10；价格：普通 48-53 / 罕见 71-79 / 稀有 95-105）
  const potions: ShopState['potions'] = []
  const potSeen = new Set<string>()
  for (let i = 0; i < 3; i++) {
    const pid = weightedPotionPick([...potSeen])
    potSeen.add(pid)
    const def = POTIONS[pid]
    const price = def.rarity === 'common' ? rnd(48, 53) : def.rarity === 'uncommon' ? rnd(71, 79) : rnd(95, 105)
    potions.push({ potionId: pid, price, sold: false })
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
