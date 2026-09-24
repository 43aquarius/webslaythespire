// ============ 第一幕敌人数据库 ============
import { EnemyDef } from './types'

// ============ 普通怪 ============
export const ENEMIES: Record<string, EnemyDef> = {
  jawWorm: {
    id: 'jawWorm', name: '颚虫', nameEn: 'Jaw Worm', minHp: 40, maxHp: 44, sprite: 'jawworm',
    openingMove: 0, moveLogic: 'random', weights: [25, 30, 45], noTripleRepeat: true,
    moves: [
      { name: '撕咬', intent: { type: 'attack', damage: 11, times: 1 }, dmg: 11 },
      { name: '鞭打', intent: { type: 'attackDefend', damage: 7, times: 1 }, dmg: 7, block: 5 },
      { name: '咆哮', intent: { type: 'buff' }, status: { id: 'strength', amount: 3, target: 'self' }, block: 6 },
    ],
  },
  cultist: {
    id: 'cultist', name: '邪教徒', nameEn: 'Cultist', minHp: 48, maxHp: 54, sprite: 'cultist',
    openingMove: 0, moveLogic: 'cycle',
    moves: [
      { name: '咒法', intent: { type: 'buff' }, status: { id: 'ritual', amount: 3, target: 'self' } },
      { name: '暗黑打击', intent: { type: 'attack', damage: 6, times: 1 }, dmg: 6 },
    ],
  },
  redLouse: {
    id: 'redLouse', name: '红虱子', nameEn: 'Red Louse', minHp: 10, maxHp: 15, sprite: 'redlouse',
    moveLogic: 'random', weights: [75, 25],
    moves: [
      { name: '撕咬', intent: { type: 'attack', damage: 5, times: 1 }, dmg: 5 },
      { name: '成长', intent: { type: 'buff' }, status: { id: 'strength', amount: 3, target: 'self' } },
    ],
  },
  greenLouse: {
    id: 'greenLouse', name: '绿虱子', nameEn: 'Green Louse', minHp: 11, maxHp: 16, sprite: 'greenlouse',
    moveLogic: 'random', weights: [75, 25],
    moves: [
      { name: '吐丝', intent: { type: 'debuff' }, status: { id: 'weak', amount: 2, target: 'player' } },
      { name: '撕咬', intent: { type: 'attack', damage: 4, times: 1 }, dmg: 4 },
    ],
  },
  fungiBeast: {
    id: 'fungiBeast', name: '真菌兽', nameEn: 'Fungi Beast', minHp: 22, maxHp: 28, sprite: 'fungibeast',
    moveLogic: 'random', weights: [60, 40], onDeath: 'sporeCloud',
    moves: [
      { name: '撕咬', intent: { type: 'attack', damage: 6, times: 1 }, dmg: 6 },
      { name: '生长', intent: { type: 'buff' }, status: { id: 'strength', amount: 3, target: 'self' } },
    ],
  },
  acidSlimeS: {
    id: 'acidSlimeS', name: '酸液史莱姆(小)', nameEn: 'Acid Slime (S)', minHp: 8, maxHp: 12, sprite: 'acidslimeS',
    moveLogic: 'random', weights: [30, 30, 40],
    moves: [
      { name: '腐蚀唾液', intent: { type: 'attackDebuff', damage: 3, times: 1 }, dmg: 3, addCards: { cardId: 'slimed', count: 1, pile: 'discard' } },
      { name: '舔舐', intent: { type: 'debuff' }, status: { id: 'weak', amount: 1, target: 'player' } },
      { name: '冲撞', intent: { type: 'attack', damage: 4, times: 1 }, dmg: 4 },
    ],
  },
  spikeSlimeS: {
    id: 'spikeSlimeS', name: '尖刺史莱姆(小)', nameEn: 'Spike Slime (S)', minHp: 8, maxHp: 12, sprite: 'spikeSlimeS',
    moveLogic: 'random', weights: [30, 30, 40],
    moves: [
      { name: '黏液飞溅', intent: { type: 'attackDebuff', damage: 5, times: 1 }, dmg: 5, status: { id: 'frail', amount: 1, target: 'player' } },
      { name: '舔舐', intent: { type: 'debuff' }, status: { id: 'frail', amount: 1, target: 'player' } },
      { name: '冲撞', intent: { type: 'attack', damage: 5, times: 1 }, dmg: 5 },
    ],
  },
  acidSlimeM: {
    id: 'acidSlimeM', name: '酸液史莱姆(中)', nameEn: 'Acid Slime (M)', minHp: 28, maxHp: 32, sprite: 'acidslimeM',
    moveLogic: 'random', weights: [30, 30, 40], onDeath: 'splitAcid',
    moves: [
      { name: '腐蚀唾液', intent: { type: 'attackDebuff', damage: 7, times: 1 }, dmg: 7, addCards: { cardId: 'slimed', count: 1, pile: 'discard' } },
      { name: '舔舐', intent: { type: 'debuff' }, status: { id: 'weak', amount: 1, target: 'player' } },
      { name: '冲撞', intent: { type: 'attack', damage: 10, times: 1 }, dmg: 10 },
    ],
  },
  spikeSlimeM: {
    id: 'spikeSlimeM', name: '尖刺史莱姆(中)', nameEn: 'Spike Slime (M)', minHp: 28, maxHp: 32, sprite: 'spikeSlimeM',
    moveLogic: 'random', weights: [30, 30, 40], startStatuses: { thorns: 3 }, onDeath: 'splitSpike',
    moves: [
      { name: '黏液飞溅', intent: { type: 'attackDebuff', damage: 8, times: 1 }, dmg: 8, status: { id: 'frail', amount: 1, target: 'player' } },
      { name: '舔舐', intent: { type: 'debuff' }, status: { id: 'frail', amount: 1, target: 'player' } },
      { name: '冲撞', intent: { type: 'attack', damage: 10, times: 1 }, dmg: 10 },
    ],
  },

  // ============ 精英 ============
  gremlinNob: {
    id: 'gremlinNob', name: '哥布林大王', nameEn: 'Gremlin Nob', minHp: 82, maxHp: 86, sprite: 'nob', elite: true,
    openingMove: 0, moveLogic: 'random', weights: [25, 40, 35], startStatuses: { angry: 1 },
    moves: [
      { name: '咆哮', intent: { type: 'buff' }, custom: 'nobBellow' },
      { name: '重击', intent: { type: 'attack', damage: 14, times: 1 }, dmg: 14 },
      { name: '颅骨猛击', intent: { type: 'attackDebuff', damage: 6, times: 1 }, dmg: 6, status: { id: 'vulnerable', amount: 2, target: 'player' } },
    ],
  },
  lagavulin: {
    id: 'lagavulin', name: '拉格维林', nameEn: 'Lagavulin', minHp: 109, maxHp: 112, sprite: 'lagavulin', elite: true,
    openingMove: -1, moveLogic: 'random', weights: [55, 45], startStatuses: { asleep: 3, metallicizeE: 8 },
    moves: [
      { name: '攻击', intent: { type: 'attack', damage: 18, times: 1 }, dmg: 18 },
      { name: '虹吸灵魂', intent: { type: 'strongDebuff' }, status: { id: 'strength', amount: -1, target: 'player' }, status2: { id: 'dexterity', amount: -1, target: 'player' } },
    ],
  },
  sentry: {
    id: 'sentry', name: '哨卫', nameEn: 'Sentry', minHp: 38, maxHp: 42, sprite: 'sentry', elite: true,
    openingMove: 0, moveLogic: 'cycle',
    moves: [
      { name: '光束', intent: { type: 'attack', damage: 9, times: 1 }, dmg: 9, addCards: { cardId: 'dazed', count: 1, pile: 'draw' } },
      { name: '充能', intent: { type: 'buff' }, block: 9 },
    ],
  },

  // ============ Boss ============
  slimeBoss: {
    id: 'slimeBoss', name: '史莱姆老大', nameEn: 'Slime Boss', minHp: 140, maxHp: 140, sprite: 'slimeboss', boss: true,
    openingMove: 0, moveLogic: 'random', weights: [30, 0, 70], onDeath: 'splitBoss',
    moves: [
      { name: '粘液喷射', intent: { type: 'attackDebuff', damage: 8, times: 1 }, dmg: 8, addCards: { cardId: 'slimed', count: 2, pile: 'discard' } },
      { name: '蓄力', intent: { type: 'unknown' }, custom: 'slimePreparing' },
      { name: '猛击', intent: { type: 'attack', damage: 35, times: 1 }, dmg: 35 },
    ],
  },
  theGuardian: {
    id: 'theGuardian', name: '守卫者', nameEn: 'The Guardian', minHp: 240, maxHp: 240, sprite: 'guardian', boss: true,
    openingMove: 2, moveLogic: 'random', weights: [40, 30, 30],
    moves: [
      { name: '猛击', intent: { type: 'attack', damage: 32, times: 1 }, dmg: 32 },
      { name: '滚动攻击', intent: { type: 'attack', damage: 5, times: 4 }, dmg: 5, times: 4 },
      { name: '蓄力', intent: { type: 'defend' }, block: 9, custom: 'guardianCharge' },
      { name: '蒸汽喷射', intent: { type: 'debuff' }, status: { id: 'vulnerable', amount: 2, target: 'player' }, status2: { id: 'weak', amount: 2, target: 'player' } },
    ],
  },
  hexaghost: {
    id: 'hexaghost', name: '六角幽灵', nameEn: 'Hexaghost', minHp: 250, maxHp: 250, sprite: 'hexaghost', boss: true,
    openingMove: 0, moveLogic: 'cycle',
    moves: [
      { name: '灼烧', intent: { type: 'attackDebuff', damage: 6, times: 1 }, dmg: 6, addCards: { cardId: 'burn', count: 1, pile: 'discard' } },
      { name: '地狱火', intent: { type: 'attack', damage: 5, times: 6 }, dmg: 5, times: 6 },
      { name: '分裂', intent: { type: 'attack', damage: 6, times: 6 }, dmg: 6, times: 6 },
      { name: '屏障', intent: { type: 'defend' }, block: 20 },
    ],
  },
}

// ============ 遭遇战表 ============
export interface Encounter {
  name: string
  enemies: string[]
  hard?: boolean
}

export const ACT1_EASY_ENCOUNTERS: Encounter[] = [
  { name: '颚虫', enemies: ['jawWorm'] },
  { name: '邪教徒', enemies: ['cultist'] },
  { name: '虱子群体', enemies: ['redLouse', 'greenLouse'] },
  { name: '小型史莱姆', enemies: ['acidSlimeS', 'spikeSlimeS'] },
]

export const ACT1_HARD_ENCOUNTERS: Encounter[] = [
  { name: '三只虱子', enemies: ['redLouse', 'redLouse', 'greenLouse'] },
  { name: '真菌兽群体', enemies: ['fungiBeast', 'fungiBeast'] },
  { name: '中型史莱姆', enemies: ['acidSlimeM', 'spikeSlimeS'] },
  { name: '中型史莱姆', enemies: ['spikeSlimeM', 'acidSlimeS'] },
  { name: '真菌兽与虱子', enemies: ['fungiBeast', 'redLouse', 'greenLouse'] },
]

export const ACT1_ELITE_ENCOUNTERS: Encounter[] = [
  { name: '哥布林大王', enemies: ['gremlinNob'] },
  { name: '拉格维林', enemies: ['lagavulin'] },
  { name: '哨卫三人组', enemies: ['sentry', 'sentry', 'sentry'] },
]

export const ACT1_BOSS_ENCOUNTERS: Encounter[] = [
  { name: '史莱姆老大', enemies: ['slimeBoss'] },
  { name: '守卫者', enemies: ['theGuardian'] },
  { name: '六角幽灵', enemies: ['hexaghost'] },
]
