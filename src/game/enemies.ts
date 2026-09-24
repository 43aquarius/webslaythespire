// ============ 敌人数据库（第1-4幕）============
import { EnemyDef } from './types'

// ============ 普通怪 ============
export const ENEMIES: Record<string, EnemyDef> = {
  // ================= 第一幕 =================
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
    id: 'acidSlimeS', name: '酸液史莱姆(小)', nameEn: 'Acid Slime (S)', minHp: 8, maxHp: 12, sprite: 'acidslimeS', small: true,
    moveLogic: 'random', weights: [30, 30, 40],
    moves: [
      { name: '腐蚀唾液', intent: { type: 'attackDebuff', damage: 3, times: 1 }, dmg: 3, addCards: { cardId: 'slimed', count: 1, pile: 'discard' } },
      { name: '舔舐', intent: { type: 'debuff' }, status: { id: 'weak', amount: 1, target: 'player' } },
      { name: '冲撞', intent: { type: 'attack', damage: 4, times: 1 }, dmg: 4 },
    ],
  },
  spikeSlimeS: {
    id: 'spikeSlimeS', name: '尖刺史莱姆(小)', nameEn: 'Spike Slime (S)', minHp: 8, maxHp: 12, sprite: 'spikeSlimeS', small: true,
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

  // ================= 第二幕 =================
  byrd: {
    id: 'byrd', name: '百鸟', nameEn: 'Byrd', minHp: 26, maxHp: 32, sprite: 'byrd',
    startStatuses: { flying: 1 }, moveLogic: 'random', weights: [35, 20, 25, 20],
    moves: [
      { name: '啄击', intent: { type: 'attack', damage: 1, times: 5 }, dmg: 1, times: 5 },
      { name: '盘旋', intent: { type: 'defend' }, block: 6 },
      { name: '俯冲', intent: { type: 'attack', damage: 9, times: 1 }, dmg: 9 },
      { name: '嘶鸣', intent: { type: 'buff' }, status: { id: 'strength', amount: 2, target: 'self' } },
    ],
  },
  chosen: {
    id: 'chosen', name: '天选者', nameEn: 'Chosen', minHp: 24, maxHp: 30, sprite: 'chosen',
    openingMove: 2, moveLogic: 'cycle',
    moves: [
      { name: '戳刺', intent: { type: 'attack', damage: 6, times: 1 }, dmg: 6 },
      { name: '咒术', intent: { type: 'debuff' }, status: { id: 'hex', amount: 1, target: 'player' } },
      { name: '黑暗仪式', intent: { type: 'buff' }, status: { id: 'ritual', amount: 2, target: 'self' } },
      { name: '吸收', intent: { type: 'attack', damage: 18, times: 1 }, dmg: 18 },
    ],
  },
  centurion: {
    id: 'centurion', name: '百夫长', nameEn: 'Centurion', minHp: 68, maxHp: 76, sprite: 'centurion',
    moveLogic: 'random', weights: [30, 45, 25],
    moves: [
      { name: '斩击', intent: { type: 'attack', damage: 12, times: 1 }, dmg: 12 },
      { name: '怒击', intent: { type: 'attack', damage: 6, times: 3 }, dmg: 6, times: 3 },
      { name: '防御', intent: { type: 'defend' }, block: 15, status: { id: 'strength', amount: 2, target: 'self' } },
    ],
  },
  mystic: {
    id: 'mystic', name: '秘教徒', nameEn: 'Mystic', minHp: 48, maxHp: 56, sprite: 'mystic',
    moveLogic: 'random', weights: [40, 30, 30],
    moves: [
      { name: '治疗', intent: { type: 'buff' }, healAllies: 16 },
      { name: '祝福', intent: { type: 'buff' }, status: { id: 'strength', amount: 2, target: 'allAllies' } },
      { name: '冲击', intent: { type: 'attack', damage: 8, times: 1 }, dmg: 8 },
    ],
  },
  madGremlin: {
    id: 'madGremlin', name: '狂暴哥布林', nameEn: 'Mad Gremlin', minHp: 21, maxHp: 25, sprite: 'madGremlin', small: true,
    moveLogic: 'random', weights: [70, 30],
    moves: [
      { name: '抓挠', intent: { type: 'attack', damage: 4, times: 1 }, dmg: 4 },
      { name: '狂暴', intent: { type: 'buff' }, status: { id: 'strength', amount: 1, target: 'self' } },
    ],
  },
  fatGremlin: {
    id: 'fatGremlin', name: '肥胖哥布林', nameEn: 'Fat Gremlin', minHp: 24, maxHp: 28, sprite: 'fatGremlin', small: true,
    moveLogic: 'random', weights: [60, 40],
    moves: [
      { name: '重击', intent: { type: 'attackDebuff', damage: 7, times: 1 }, dmg: 7, addCards: { cardId: 'slimed', count: 1, pile: 'discard' } },
      { name: '叫嚣', intent: { type: 'debuff' }, status: { id: 'frail', amount: 2, target: 'player' } },
    ],
  },
  gremlinWizard: {
    id: 'gremlinWizard', name: '哥布林法师', nameEn: 'Gremlin Wizard', minHp: 22, maxHp: 26, sprite: 'gremlinWizard', small: true,
    moveLogic: 'cycle',
    moves: [
      { name: '蓄力', intent: { type: 'unknown' }, block: 6, custom: 'wizardCharge' },
      { name: '终极爆破', intent: { type: 'attack', damage: 25, times: 1 }, dmg: 25 },
    ],
  },
  shieldGremlin: {
    id: 'shieldGremlin', name: '盾牌哥布林', nameEn: 'Shield Gremlin', minHp: 24, maxHp: 28, sprite: 'shieldGremlin', small: true,
    moveLogic: 'random', weights: [45, 55],
    moves: [
      { name: '掩护', intent: { type: 'defend' }, block: 9 },
      { name: '痛击', intent: { type: 'attack', damage: 7, times: 1 }, dmg: 7 },
    ],
  },
  sneakyGremlin: {
    id: 'sneakyGremlin', name: '潜行哥布林', nameEn: 'Sneaky Gremlin', minHp: 11, maxHp: 15, sprite: 'sneakyGremlin', small: true,
    moveLogic: 'random', weights: [80, 20],
    moves: [
      { name: '切击', intent: { type: 'attack', damage: 9, times: 1 }, dmg: 9 },
      { name: '闪避', intent: { type: 'defend' }, block: 5 },
    ],
  },
  redSlaver: {
    id: 'redSlaver', name: '红衣奴隶贩', nameEn: 'Red Slaver', minHp: 46, maxHp: 52, sprite: 'redSlaver',
    moveLogic: 'random', weights: [40, 35, 25],
    moves: [
      { name: '刺击', intent: { type: 'attack', damage: 13, times: 1 }, dmg: 13 },
      { name: '刮擦', intent: { type: 'attackDebuff', damage: 7, times: 1 }, dmg: 7, status: { id: 'weak', amount: 2, target: 'player' } },
      { name: '纠缠', intent: { type: 'debuff' }, status: { id: 'entangled', amount: 1, target: 'player' }, status2: { id: 'vulnerable', amount: 2, target: 'player' } },
    ],
  },
  blueSlaver: {
    id: 'blueSlaver', name: '蓝衣奴隶贩', nameEn: 'Blue Slaver', minHp: 50, maxHp: 56, sprite: 'blueSlaver',
    moveLogic: 'random', weights: [40, 35, 25],
    moves: [
      { name: '刺击', intent: { type: 'attack', damage: 12, times: 1 }, dmg: 12 },
      { name: '重击', intent: { type: 'attackDebuff', damage: 7, times: 1 }, dmg: 7, status: { id: 'vulnerable', amount: 2, target: 'player' } },
      { name: '威吓', intent: { type: 'debuff' }, status: { id: 'weak', amount: 2, target: 'player' } },
    ],
  },
  sphericGuardian: {
    id: 'sphericGuardian', name: '球形守卫', nameEn: 'Spheric Guardian', minHp: 42, maxHp: 48, sprite: 'sphericGuardian',
    openingMove: 0, moveLogic: 'cycle',
    moves: [
      { name: '猛击', intent: { type: 'attack', damage: 10, times: 1 }, dmg: 10 },
      { name: '硬化', intent: { type: 'defend' }, block: 20, status: { id: 'thorns', amount: 3, target: 'self' } },
      { name: '冲撞', intent: { type: 'attack', damage: 12, times: 1 }, dmg: 12 },
    ],
  },
  munchkin: {
    id: 'munchkin', name: '小食尸鬼', nameEn: 'Munchkin', minHp: 30, maxHp: 36, sprite: 'munchkin', small: true,
    moveLogic: 'random', weights: [60, 40],
    moves: [
      { name: '啃咬', intent: { type: 'attack', damage: 8, times: 1 }, dmg: 8 },
      { name: '鞭挞', intent: { type: 'attackDebuff', damage: 4, times: 1 }, dmg: 4, status: { id: 'weak', amount: 1, target: 'player' } },
    ],
  },
  bronzeOrb: {
    id: 'bronzeOrb', name: '青铜球体', nameEn: 'Bronze Orb', minHp: 22, maxHp: 26, sprite: 'bronzeOrb', small: true,
    moveLogic: 'cycle',
    moves: [
      { name: '信标', intent: { type: 'attackDebuff', damage: 7, times: 1 }, dmg: 7, addCards: { cardId: 'dazed', count: 1, pile: 'discard' } },
      { name: '停滞', intent: { type: 'debuff' }, addCards: { cardId: 'dazed', count: 1, pile: 'draw' }, block: 6 },
    ],
  },

  // ================= 第三幕 =================
  spiker: {
    id: 'spiker', name: '尖刺怪', nameEn: 'Spiker', minHp: 10, maxHp: 14, sprite: 'spiker',
    startStatuses: { thorns: 3 }, moveLogic: 'random', weights: [40, 60],
    moves: [
      { name: '尖刺皮肤', intent: { type: 'buff' }, status: { id: 'thorns', amount: 2, target: 'self' } },
      { name: '切割', intent: { type: 'attack', damage: 7, times: 1 }, dmg: 7 },
    ],
  },
  repulsor: {
    id: 'repulsor', name: '排斥体', nameEn: 'Repulsor', minHp: 38, maxHp: 44, sprite: 'repulsor',
    moveLogic: 'random', weights: [50, 50],
    moves: [
      { name: '排斥', intent: { type: 'debuff' }, status: { id: 'vulnerable', amount: 2, target: 'player' }, status2: { id: 'weak', amount: 2, target: 'player' } },
      { name: '猛击', intent: { type: 'attack', damage: 11, times: 1 }, dmg: 11 },
    ],
  },
  orbWalker: {
    id: 'orbWalker', name: '球体行者', nameEn: 'Orb Walker', minHp: 60, maxHp: 64, sprite: 'orbWalker',
    moveLogic: 'random', weights: [55, 45],
    moves: [
      { name: '激光', intent: { type: 'attack', damage: 11, times: 1 }, dmg: 11 },
      { name: '利爪', intent: { type: 'attackDebuff', damage: 9, times: 1 }, dmg: 9, addCards: { cardId: 'void', count: 1, pile: 'discard' } },
    ],
  },
  writhingMass: {
    id: 'writhingMass', name: '蠕动之躯', nameEn: 'Writhing Mass', minHp: 155, maxHp: 160, sprite: 'writhingMass',
    moveLogic: 'random', weights: [25, 25, 25, 25],
    moves: [
      { name: '乱舞', intent: { type: 'attack', damage: 15, times: 1 }, dmg: 15 },
      { name: '鞭打', intent: { type: 'attack', damage: 7, times: 3 }, dmg: 7, times: 3 },
      { name: '植入', intent: { type: 'buff' }, status: { id: 'strength', amount: 3, target: 'self' }, block: 5 },
      { name: '枯萎', intent: { type: 'attackDebuff', damage: 10, times: 1 }, dmg: 10, status: { id: 'weak', amount: 2, target: 'player' }, status2: { id: 'frail', amount: 2, target: 'player' } },
    ],
  },
  spireGrowth: {
    id: 'spireGrowth', name: '尖塔生长体', nameEn: 'Spire Growth', minHp: 180, maxHp: 190, sprite: 'spireGrowth',
    openingMove: 0, moveLogic: 'random', weights: [40, 30, 30],
    moves: [
      { name: '紧勒', intent: { type: 'attack', damage: 16, times: 1 }, dmg: 16 },
      { name: '快速生长', intent: { type: 'buff' }, status: { id: 'strength', amount: 3, target: 'self' } },
      { name: '缠绕', intent: { type: 'debuff' }, status: { id: 'constricted', amount: 3, target: 'player' } },
    ],
  },
  transient: {
    id: 'transient', name: '短暂者', nameEn: 'Transient', minHp: 999, maxHp: 999, sprite: 'transient',
    escapeAfter: 5, attackGrows: true, moveLogic: 'cycle', openingMove: 0,
    moves: [
      { name: '压迫', intent: { type: 'attack', damage: 7, times: 1 }, dmg: 7 },
      { name: '压迫', intent: { type: 'attack', damage: 10, times: 1 }, dmg: 10 },
      { name: '压迫', intent: { type: 'attack', damage: 14, times: 1 }, dmg: 14 },
      { name: '压迫', intent: { type: 'attack', damage: 18, times: 1 }, dmg: 18 },
      { name: '压迫', intent: { type: 'attack', damage: 25, times: 1 }, dmg: 25 },
      { name: '压迫', intent: { type: 'attack', damage: 32, times: 1 }, dmg: 32 },
    ],
  },
  darkling: {
    id: 'darkling', name: '黑暗幼苗', nameEn: 'Darkling', minHp: 48, maxHp: 55, sprite: 'darkling', small: true,
    moveLogic: 'random', weights: [35, 35, 30],
    moves: [
      { name: '啃咬', intent: { type: 'attack', damage: 7, times: 2 }, dmg: 7, times: 2 },
      { name: '撕咬', intent: { type: 'attack', damage: 10, times: 1 }, dmg: 10 },
      { name: '硬化', intent: { type: 'defend' }, block: 12 },
    ],
  },
  dagger: {
    id: 'dagger', name: '匕首', nameEn: 'Dagger', minHp: 20, maxHp: 20, sprite: 'dagger', small: true,
    moveLogic: 'cycle',
    moves: [
      { name: '突刺', intent: { type: 'attack', damage: 9, times: 1 }, dmg: 9 },
    ],
  },

  // ============ 第一幕精英 ============
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

  // ============ 第二幕精英 ============
  taskmaster: {
    id: 'taskmaster', name: '监工', nameEn: 'Taskmaster', minHp: 50, maxHp: 56, sprite: 'taskmaster', elite: true,
    moveLogic: 'random', weights: [50, 50],
    moves: [
      { name: '鞭挞', intent: { type: 'attackDebuff', damage: 10, times: 1 }, dmg: 10, status: { id: 'weak', amount: 2, target: 'player' }, status2: { id: 'vulnerable', amount: 2, target: 'player' } },
      { name: '怒吼', intent: { type: 'buff' }, status: { id: 'strength', amount: 3, target: 'allAllies' } },
    ],
  },
  gremlinLeader: {
    id: 'gremlinLeader', name: '哥布林首领', nameEn: 'Gremlin Leader', minHp: 170, maxHp: 170, sprite: 'gremlinLeader', elite: true,
    openingMove: 0, moveLogic: 'random', weights: [30, 35, 35],
    moves: [
      { name: '集结', intent: { type: 'buff' }, status: { id: 'strength', amount: 3, target: 'allAllies' } },
      { name: '鼓动', intent: { type: 'buff' }, block: 10, status: { id: 'strength', amount: 2, target: 'allAllies' } },
      { name: '刺击', intent: { type: 'attack', damage: 6, times: 3 }, dmg: 6, times: 3 },
    ],
  },
  bookOfStabbing: {
    id: 'bookOfStabbing', name: '刺杀之书', nameEn: 'Book of Stabbing', minHp: 160, maxHp: 172, sprite: 'bookOfStabbing', elite: true,
    moveLogic: 'random', weights: [60, 40],
    moves: [
      { name: '刺击', intent: { type: 'attack', damage: 6, times: 2 }, dmg: 6, times: 2 },
      { name: '连续刺击', intent: { type: 'attack', damage: 3, times: 9 }, dmg: 3, times: 9 },
    ],
  },

  // ============ 第三幕精英 ============
  giantHead: {
    id: 'giantHead', name: '巨头', nameEn: 'Giant Head', minHp: 300, maxHp: 300, sprite: 'giantHead', elite: true,
    openingMove: 0, moveLogic: 'random', weights: [25, 25, 30, 20],
    moves: [
      { name: '计数', intent: { type: 'defend' }, block: 20 },
      { name: '怒视', intent: { type: 'attack', damage: 13, times: 1 }, dmg: 13 },
      { name: '凝视', intent: { type: 'attack', damage: 26, times: 1 }, dmg: 26 },
      { name: '时辰已到', intent: { type: 'attackDebuff', damage: 13, times: 1 }, dmg: 13, status: { id: 'weak', amount: 3, target: 'player' } },
    ],
  },
  nemesis: {
    id: 'nemesis', name: '复仇者', nameEn: 'Nemesis', minHp: 250, maxHp: 250, sprite: 'nemesis', elite: true,
    moveLogic: 'random', weights: [40, 30, 30],
    moves: [
      { name: '镰刀', intent: { type: 'attack', damage: 6, times: 3 }, dmg: 6, times: 3 },
      { name: '削弱', intent: { type: 'strongDebuff' }, status: { id: 'weak', amount: 2, target: 'player' }, status2: { id: 'strength', amount: -2, target: 'player' } },
      { name: '虚化', intent: { type: 'buff' }, status: { id: 'intangible', amount: 1, target: 'self' }, block: 15 },
    ],
  },
  reptomancer: {
    id: 'reptomancer', name: '爬虫法师', nameEn: 'Reptomancer', minHp: 230, maxHp: 230, sprite: 'reptomancer', elite: true,
    openingMove: 0, moveLogic: 'random', weights: [45, 30, 25],
    moves: [
      { name: '大斩击', intent: { type: 'attack', damage: 18, times: 1 }, dmg: 18 },
      { name: '蛇眼', intent: { type: 'attack', damage: 7, times: 2 }, dmg: 7, times: 2 },
      { name: '召唤匕首', intent: { type: 'buff' }, summon: { id: 'dagger', count: 2 } },
    ],
  },

  // ================= Boss =================
  // ---- 第一幕 ----
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
  // ---- 第二幕 ----
  bronzeAutomaton: {
    id: 'bronzeAutomaton', name: '青铜自动机', nameEn: 'Bronze Automaton', minHp: 300, maxHp: 300, sprite: 'bronzeAutomaton', boss: true,
    openingMove: 0, moveLogic: 'random', weights: [30, 20, 25, 25],
    moves: [
      { name: '连枷', intent: { type: 'attack', damage: 7, times: 2 }, dmg: 7, times: 2 },
      { name: '召唤球体', intent: { type: 'buff' }, summon: { id: 'bronzeOrb', count: 2 } },
      { name: '强化', intent: { type: 'buff' }, block: 9, status: { id: 'strength', amount: 3, target: 'self' } },
      { name: '超光束', intent: { type: 'attack', damage: 30, times: 1 }, dmg: 30 },
    ],
  },
  theCollector: {
    id: 'theCollector', name: '收藏家', nameEn: 'The Collector', minHp: 280, maxHp: 280, sprite: 'theCollector', boss: true,
    openingMove: 0, moveLogic: 'random', weights: [35, 25, 20, 20],
    moves: [
      { name: '火球', intent: { type: 'attack', damage: 18, times: 1 }, dmg: 18 },
      { name: '超级削弱', intent: { type: 'strongDebuff' }, status: { id: 'weak', amount: 3, target: 'player' }, status2: { id: 'frail', amount: 3, target: 'player' } },
      { name: '召唤', intent: { type: 'buff' }, summon: { id: 'munchkin', count: 2 } },
      { name: '收集', intent: { type: 'defend' }, block: 15, heal: 15 },
    ],
  },
  theChamp: {
    id: 'theChamp', name: '勇士', nameEn: 'The Champ', minHp: 300, maxHp: 300, sprite: 'theChamp', boss: true,
    openingMove: 0, moveLogic: 'random', weights: [30, 25, 20, 25],
    moves: [
      { name: '沉重斩击', intent: { type: 'attack', damage: 16, times: 1 }, dmg: 16 },
      { name: '面部掌掴', intent: { type: 'attackDebuff', damage: 10, times: 1 }, dmg: 10, status: { id: 'weak', amount: 2, target: 'player' }, status2: { id: 'vulnerable', amount: 2, target: 'player' } },
      { name: '防姿', intent: { type: 'defend' }, block: 15 },
      { name: '处决', intent: { type: 'attack', damage: 10, times: 2 }, dmg: 10, times: 2 },
    ],
  },
  // ---- 第三幕 ----
  awakenedOne: {
    id: 'awakenedOne', name: '觉醒者', nameEn: 'Awakened One', minHp: 300, maxHp: 300, sprite: 'awakenedOne', boss: true,
    openingMove: 0, moveLogic: 'random', weights: [35, 30, 35], onDeath: 'rebirth',
    moves: [
      { name: '斩击', intent: { type: 'attack', damage: 20, times: 1 }, dmg: 20 },
      { name: '灵魂打击', intent: { type: 'attack', damage: 6, times: 4 }, dmg: 6, times: 4 },
      { name: '暗影波', intent: { type: 'defend' }, block: 20, status: { id: 'strength', amount: 3, target: 'self' } },
    ],
  },
  timeEater: {
    id: 'timeEater', name: '时间吞噬者', nameEn: 'Time Eater', minHp: 300, maxHp: 300, sprite: 'timeEater', boss: true,
    openingMove: 0, moveLogic: 'random', weights: [35, 35, 30], startStatuses: { time: 0 },
    moves: [
      { name: '回响', intent: { type: 'attack', damage: 7, times: 2 }, dmg: 7, times: 2 },
      { name: '头部猛击', intent: { type: 'attackDebuff', damage: 13, times: 1 }, dmg: 13, status: { id: 'weak', amount: 1, target: 'player' } },
      { name: '涟漪', intent: { type: 'defend' }, block: 20, heal: 20 },
    ],
  },
  donu: {
    id: 'donu', name: '多努', nameEn: 'Donu', minHp: 250, maxHp: 250, sprite: 'donu', boss: true,
    openingMove: 0, moveLogic: 'random', weights: [50, 50],
    moves: [
      { name: '力量之环', intent: { type: 'buff' }, status: { id: 'strength', amount: 3, target: 'allAllies' } },
      { name: '光束攻击', intent: { type: 'attack', damage: 10, times: 2 }, dmg: 10, times: 2 },
    ],
  },
  deca: {
    id: 'deca', name: '德卡', nameEn: 'Deca', minHp: 250, maxHp: 250, sprite: 'deca', boss: true,
    openingMove: 0, moveLogic: 'random', weights: [50, 50],
    moves: [
      { name: '守护之环', intent: { type: 'defend' }, block: 13, status: { id: 'strength', amount: 3, target: 'allAllies' } },
      { name: '圣光之方', intent: { type: 'attackDebuff', damage: 6, times: 1 }, dmg: 6, addCards: { cardId: 'dazed', count: 1, pile: 'discard' } },
    ],
  },
  // ---- 第四幕 ----
  spireShield: {
    id: 'spireShield', name: '尖塔之盾', nameEn: 'Spire Shield', minHp: 40, maxHp: 40, sprite: 'spireShield', elite: true,
    moveLogic: 'cycle',
    moves: [
      { name: '盾击', intent: { type: 'attackDefend', damage: 8, times: 1 }, dmg: 8, block: 20 },
      { name: '猛击', intent: { type: 'attack', damage: 12, times: 1 }, dmg: 12 },
    ],
  },
  spireSpear: {
    id: 'spireSpear', name: '尖塔之矛', nameEn: 'Spire Spear', minHp: 46, maxHp: 46, sprite: 'spireSpear', elite: true,
    moveLogic: 'cycle',
    moves: [
      { name: '穿刺', intent: { type: 'attack', damage: 5, times: 4 }, dmg: 5, times: 4 },
      { name: '旋矛', intent: { type: 'attack', damage: 13, times: 1 }, dmg: 13 },
    ],
  },
  corruptHeart: {
    id: 'corruptHeart', name: '腐朽之心', nameEn: 'Corrupt Heart', minHp: 750, maxHp: 750, sprite: 'corruptHeart', boss: true,
    startStatuses: { beatOfDeath: 2 }, openingMove: 0, moveLogic: 'random', weights: [30, 25, 25, 20],
    moves: [
      { name: '痛击', intent: { type: 'attack', damage: 12, times: 2 }, dmg: 12, times: 2 },
      { name: '削弱', intent: { type: 'strongDebuff' }, status: { id: 'weak', amount: 2, target: 'player' }, status2: { id: 'vulnerable', amount: 2, target: 'player' } },
      { name: '埃霍之咒', intent: { type: 'debuff' }, status: { id: 'vulnerable', amount: 2, target: 'player' }, status2: { id: 'frail', amount: 2, target: 'player' } },
      { name: '血脉贲张', intent: { type: 'buff' }, status: { id: 'strength', amount: 5, target: 'self' }, heal: 100 },
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

export const ACT2_EASY_ENCOUNTERS: Encounter[] = [
  { name: '百鸟', enemies: ['byrd', 'byrd', 'byrd'] },
  { name: '天选者', enemies: ['chosen'] },
  { name: '百夫长与秘教徒', enemies: ['centurion', 'mystic'] },
  { name: '奴隶贩', enemies: ['redSlaver', 'blueSlaver'] },
  { name: '小型史莱姆', enemies: ['acidSlimeS', 'spikeSlimeS'] },
]

export const ACT2_HARD_ENCOUNTERS: Encounter[] = [
  { name: '哥布林帮', enemies: ['madGremlin', 'fatGremlin', 'shieldGremlin', 'sneakyGremlin'] },
  { name: '哥布林法师帮', enemies: ['gremlinWizard', 'madGremlin', 'sneakyGremlin'] },
  { name: '百夫长与百鸟', enemies: ['centurion', 'byrd', 'byrd'] },
  { name: '球形守卫', enemies: ['sphericGuardian', 'acidSlimeM'] },
  { name: '天选者与奴隶贩', enemies: ['chosen', 'blueSlaver'] },
  { name: '真菌兽群体', enemies: ['fungiBeast', 'fungiBeast', 'fungiBeast'] },
]

export const ACT2_ELITE_ENCOUNTERS: Encounter[] = [
  { name: '哥布林首领', enemies: ['gremlinLeader', 'madGremlin', 'sneakyGremlin'] },
  { name: '奴隶贩三人组', enemies: ['taskmaster', 'redSlaver', 'blueSlaver'] },
  { name: '刺杀之书', enemies: ['bookOfStabbing'] },
]

export const ACT2_BOSS_ENCOUNTERS: Encounter[] = [
  { name: '青铜自动机', enemies: ['bronzeAutomaton'] },
  { name: '收藏家', enemies: ['theCollector'] },
  { name: '勇士', enemies: ['theChamp'] },
]

export const ACT3_EASY_ENCOUNTERS: Encounter[] = [
  { name: '尖塔生长体', enemies: ['spireGrowth'] },
  { name: '排斥体', enemies: ['repulsor', 'repulsor'] },
  { name: '短暂者', enemies: ['transient'] },
  { name: '球体行者', enemies: ['orbWalker', 'orbWalker'] },
]

export const ACT3_HARD_ENCOUNTERS: Encounter[] = [
  { name: '黑暗幼苗', enemies: ['darkling', 'darkling', 'darkling'] },
  { name: '蠕动之躯', enemies: ['writhingMass'] },
  { name: '尖塔生长体与排斥体', enemies: ['spireGrowth', 'repulsor'] },
  { name: '尖刺怪', enemies: ['spiker', 'spiker', 'spiker'] },
  { name: '颚虫', enemies: ['jawWorm'] },
  { name: '大型史莱姆', enemies: ['acidSlimeM', 'spikeSlimeM'] },
]

export const ACT3_ELITE_ENCOUNTERS: Encounter[] = [
  { name: '巨头', enemies: ['giantHead'] },
  { name: '复仇者', enemies: ['nemesis'] },
  { name: '爬虫法师', enemies: ['reptomancer'] },
]

export const ACT3_BOSS_ENCOUNTERS: Encounter[] = [
  { name: '觉醒者', enemies: ['awakenedOne'] },
  { name: '时间吞噬者', enemies: ['timeEater'] },
  { name: '多努与德卡', enemies: ['donu', 'deca'] },
]

export const ACT4_ELITE_ENCOUNTERS: Encounter[] = [
  { name: '尖塔之矛与盾', enemies: ['spireShield', 'spireSpear'] },
]

export const ACT4_BOSS_ENCOUNTERS: Encounter[] = [
  { name: '腐朽之心', enemies: ['corruptHeart'] },
]
