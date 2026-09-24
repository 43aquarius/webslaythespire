// ============ 观者卡牌（紫）============
import { CardDef } from './types'

export const CARDS_WATCHER: Record<string, CardDef> = {
  // ---- 初始 ----
  strikeP: {
    id: 'strikeP', name: '打击', nameEn: 'Strike', type: 'attack', rarity: 'starter', cost: 1, target: 'enemy', color: 'purple',
    values: [6], upValues: [9], desc: '造成 {0} 点伤害。', upDesc: '造成 {0} 点伤害。', art: 'strikeP',
  },
  defendP: {
    id: 'defendP', name: '防御', nameEn: 'Defend', type: 'skill', rarity: 'starter', cost: 1, target: 'self', color: 'purple',
    values: [5], upValues: [8], desc: '获得 {0} 点格挡。', upDesc: '获得 {0} 点格挡。', art: 'defendP',
  },
  eruption: {
    id: 'eruption', name: '喷发', nameEn: 'Eruption', type: 'attack', rarity: 'starter', cost: 2, upCost: 1, target: 'enemy', color: 'purple',
    values: [16], upValues: [16], desc: '造成 {0} 点伤害。进入怒相。', upDesc: '造成 {0} 点伤害。进入怒相。', art: 'eruption',
  },
  vigilance: {
    id: 'vigilance', name: '警戒', nameEn: 'Vigilance', type: 'skill', rarity: 'starter', cost: 0, target: 'self', color: 'purple',
    values: [8], upValues: [11], desc: '获得 {0} 点格挡。进入静相。', upDesc: '获得 {0} 点格挡。进入静相。', art: 'vigilance',
  },
  // ---- 普通 ----
  bowlingBash: {
    id: 'bowlingBash', name: '保龄重击', nameEn: 'Bowling Bash', type: 'attack', rarity: 'common', cost: 1, target: 'allEnemies', color: 'purple',
    values: [7], upValues: [10], desc: '对所有敌人造成 {0} 点伤害。', upDesc: '对所有敌人造成 {0} 点伤害。', art: 'bowlingBash',
  },
  consecration: {
    id: 'consecration', name: '祝圣', nameEn: 'Consecration', type: 'attack', rarity: 'common', cost: 1, target: 'allEnemies', color: 'purple',
    values: [12], upValues: [16], desc: '对所有敌人造成 {0} 点伤害。', upDesc: '对所有敌人造成 {0} 点伤害。', art: 'consecration',
  },
  crushJoint: {
    id: 'crushJoint', name: '粉碎关节', nameEn: 'Crush Joint', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', color: 'purple',
    values: [8, 2], upValues: [10, 3], desc: '造成 {0} 点伤害。若这是你本回合打出的第二张牌，施加 {1} 层易伤。', upDesc: '造成 {0} 点伤害。若这是你本回合打出的第二张牌，施加 {1} 层易伤。', art: 'crushJoint',
  },
  cutThroughFate: {
    id: 'cutThroughFate', name: '斩断宿命', nameEn: 'Cut Through Fate', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', color: 'purple',
    values: [7, 2], upValues: [9, 3], desc: '造成 {0} 点伤害。预见 {1} 张牌。', upDesc: '造成 {0} 点伤害。预见 {1} 张牌。', art: 'cutThroughFate',
  },
  emptyFist: {
    id: 'emptyFist', name: '空拳', nameEn: 'Empty Fist', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', color: 'purple',
    values: [9], upValues: [12], desc: '造成 {0} 点伤害。退出你的姿态。', upDesc: '造成 {0} 点伤害。退出你的姿态。', art: 'emptyFist',
  },
  flyingSleeves: {
    id: 'flyingSleeves', name: '飞袖', nameEn: 'Flying Sleeves', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', retain: true, color: 'purple',
    values: [4, 2], upValues: [6, 2], desc: '造成 {0} 点伤害，共 {1} 次。保留。', upDesc: '造成 {0} 点伤害，共 {1} 次。保留。', art: 'flyingSleeves',
  },
  followUp: {
    id: 'followUp', name: '后继打击', nameEn: 'Follow-Up', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', color: 'purple',
    values: [7], upValues: [11], desc: '造成 {0} 点伤害。若你上一张打出的牌是攻击牌，获得 1 点能量。', upDesc: '造成 {0} 点伤害。若你上一张打出的牌是攻击牌，获得 1 点能量。', art: 'followUp',
  },
  foresight: {
    id: 'foresight', name: '先见之明', nameEn: 'Foresight', type: 'power', rarity: 'common', cost: 0, target: 'self', color: 'purple',
    values: [3], upValues: [4], desc: '在你的回合结束时，预见 {0} 张牌。', upDesc: '在你的回合结束时，预见 {0} 张牌。', art: 'foresight',
  },
  halt: {
    id: 'halt', name: '止步', nameEn: 'Halt', type: 'skill', rarity: 'common', cost: 0, target: 'self', color: 'purple',
    values: [3, 9], upValues: [4, 14], desc: '获得 {0} 点格挡。若你处于怒相，额外获得 {1} 点格挡。', upDesc: '获得 {0} 点格挡。若你处于怒相，额外获得 {1} 点格挡。', art: 'halt',
  },
  justLucky: {
    id: 'justLucky', name: '小幸运', nameEn: 'Just Lucky', type: 'skill', rarity: 'common', cost: 0, target: 'self', color: 'purple',
    values: [2, 3], upValues: [3, 4], desc: '预见 1 张牌。获得 {0} 点格挡。抽 1 张牌。', upDesc: '预见 1 张牌。获得 {0} 点格挡。抽 1 张牌。', art: 'justLucky',
  },
  pressurePoints: {
    id: 'pressurePoints', name: '压点', nameEn: 'Pressure Points', type: 'skill', rarity: 'common', cost: 1, target: 'allEnemies', color: 'purple',
    values: [10], upValues: [14], desc: '对所有敌人施加 {0} 层印记。所有敌人失去等同于其印记层数的生命值。', upDesc: '对所有敌人施加 {0} 层印记。所有敌人失去等同于其印记层数的生命值。', art: 'pressurePoints',
  },
  prostrate: {
    id: 'prostrate', name: '俯卧', nameEn: 'Prostrate', type: 'skill', rarity: 'common', cost: 0, target: 'self', color: 'purple',
    values: [3, 4], upValues: [4, 6], desc: '获得 {0} 点真言。获得 {1} 点格挡。', upDesc: '获得 {0} 点真言。获得 {1} 点格挡。', art: 'prostrate',
  },
  protect: {
    id: 'protect', name: '守护', nameEn: 'Protect', type: 'skill', rarity: 'common', cost: 1, target: 'self', retain: true, color: 'purple',
    values: [6], upValues: [9], desc: '获得 {0} 点格挡。保留。', upDesc: '获得 {0} 点格挡。保留。', art: 'protect',
  },
  tranquility: {
    id: 'tranquility', name: '宁静', nameEn: 'Tranquility', type: 'skill', rarity: 'common', cost: 0, target: 'none', retain: true, exhaust: true, color: 'purple',
    values: [0], upValues: [0], desc: '进入静相。保留。消耗。', upDesc: '进入静相。保留。消耗。', art: 'tranquility',
  },
  emptyBody: {
    id: 'emptyBody', name: '空身', nameEn: 'Empty Body', type: 'skill', rarity: 'common', cost: 1, target: 'self', color: 'purple',
    values: [6], upValues: [9], desc: '获得 {0} 点格挡。退出你的姿态。', upDesc: '获得 {0} 点格挡。退出你的姿态。', art: 'emptyBody',
  },
  // ---- 罕见 ----
  carveReality: {
    id: 'carveReality', name: '刻划现实', nameEn: 'Carve Reality', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', color: 'purple',
    values: [15], upValues: [19], desc: '造成 {0} 点伤害。若你处于怒相，将一张"神罚"加入手牌。', upDesc: '造成 {0} 点伤害。若你处于怒相，将一张"神罚"加入手牌。', art: 'carveReality',
  },
  conclude: {
    id: 'conclude', name: '结案', nameEn: 'Conclude', type: 'attack', rarity: 'uncommon', cost: 2, target: 'allEnemies', color: 'purple',
    values: [30], upValues: [40], desc: '对所有敌人造成 {0} 点伤害。结束你的回合。', upDesc: '对所有敌人造成 {0} 点伤害。结束你的回合。', art: 'conclude',
  },
  emptyMind: {
    id: 'emptyMind', name: '空心', nameEn: 'Empty Mind', type: 'skill', rarity: 'uncommon', cost: 0, target: 'none', color: 'purple',
    values: [2], upValues: [3], desc: '若你本回合退出过姿态，抽 {0} 张牌。', upDesc: '若你本回合退出过姿态，抽 {0} 张牌。', art: 'emptyMind',
  },
  fasting: {
    id: 'fasting', name: '斋戒', nameEn: 'Fasting', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', color: 'purple',
    values: [2], upValues: [3], desc: '获得 {0} 点力量。失去 2 点敏捷。', upDesc: '获得 {0} 点力量。失去 2 点敏捷。', art: 'fasting',
  },
  fearNoEvil: {
    id: 'fearNoEvil', name: '不惧邪恶', nameEn: 'Fear No Evil', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', color: 'purple',
    values: [8], upValues: [11], desc: '造成 {0} 点伤害。若目标意图攻击，进入静相。', upDesc: '造成 {0} 点伤害。若目标意图攻击，进入静相。', art: 'fearNoEvil',
  },
  indignation: {
    id: 'indignation', name: '义愤', nameEn: 'Indignation', type: 'skill', rarity: 'uncommon', cost: 1, target: 'allEnemies', color: 'purple',
    values: [3], upValues: [5], desc: '若你处于怒相，对所有敌人施加 {0} 层易伤。否则进入怒相。', upDesc: '若你处于怒相，对所有敌人施加 {0} 层易伤。否则进入怒相。', art: 'indignation',
  },
  innerPeace: {
    id: 'innerPeace', name: '内心平静', nameEn: 'Inner Peace', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none', color: 'purple',
    values: [3], upValues: [4], desc: '若你处于静相，抽 {0} 张牌。否则进入静相。', upDesc: '若你处于静相，抽 {0} 张牌。否则进入静相。', art: 'innerPeace',
  },
  likeWaterS: {
    id: 'likeWaterS', name: '静如水', nameEn: 'Like Water', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', color: 'purple',
    values: [6], upValues: [9], desc: '在你的回合结束时，若你处于静相，获得 {0} 点格挡。', upDesc: '在你的回合结束时，若你处于静相，获得 {0} 点格挡。', art: 'likeWaterS',
  },
  mentalFortressS: {
    id: 'mentalFortressS', name: '心灵壁垒', nameEn: 'Mental Fortress', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', color: 'purple',
    values: [3], upValues: [4], desc: '每当你切换姿态，获得 {0} 点格挡。', upDesc: '每当你切换姿态，获得 {0} 点格挡。', art: 'mentalFortressS',
  },
  nirvanaS: {
    id: 'nirvanaS', name: '涅槃', nameEn: 'Nirvana', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', color: 'purple',
    values: [2], upValues: [3], desc: '每当你预见一张牌，获得 {0} 点格挡。', upDesc: '每当你预见一张牌，获得 {0} 点格挡。', art: 'nirvanaS',
  },
  sanctity: {
    id: 'sanctity', name: '圣域', nameEn: 'Sanctity', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', color: 'purple',
    values: [5], upValues: [8], desc: '获得 {0} 点格挡。若你上一张打出的牌是技能牌，抽 1 张牌。', upDesc: '获得 {0} 点格挡。若你上一张打出的牌是技能牌，抽 1 张牌。', art: 'sanctity',
  },
  tantrum: {
    id: 'tantrum', name: '发怒', nameEn: 'Tantrum', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', color: 'purple',
    values: [8], upValues: [10], desc: '造成 {0} 点伤害。进入怒相。此牌不会被弃置，保留在手牌中。', upDesc: '造成 {0} 点伤害。进入怒相。此牌不会被弃置，保留在手牌中。', art: 'tantrum',
  },
  wallop: {
    id: 'wallop', name: '猛击', nameEn: 'Wallop', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', color: 'purple',
    values: [9], upValues: [13], desc: '造成 {0} 点伤害。获得等同于未被格挡伤害的格挡。', upDesc: '造成 {0} 点伤害。获得等同于未被格挡伤害的格挡。', art: 'wallop',
  },
  waveOfTheHand: {
    id: 'waveOfTheHand', name: '挥手', nameEn: 'Wave of the Hand', type: 'skill', rarity: 'uncommon', cost: 1, target: 'allEnemies', color: 'purple',
    values: [5, 2], upValues: [8, 3], desc: '造成 {0} 点伤害，施加 {1} 层虚弱。', upDesc: '造成 {0} 点伤害，施加 {1} 层虚弱。', art: 'waveOfTheHand',
  },
  weave: {
    id: 'weave', name: '编织', nameEn: 'Weave', type: 'attack', rarity: 'uncommon', cost: 0, target: 'enemy', color: 'purple',
    values: [4], upValues: [6], desc: '造成 {0} 点伤害。若你本回合退出过姿态，将此牌返回手牌。', upDesc: '造成 {0} 点伤害。若你本回合退出过姿态，将此牌返回手牌。', art: 'weave',
  },
  wheelKick: {
    id: 'wheelKick', name: '车轮踢', nameEn: 'Wheel Kick', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', color: 'purple',
    values: [15], upValues: [20], desc: '造成 {0} 点伤害。抽 2 张牌。弃置 1 张牌。', upDesc: '造成 {0} 点伤害。抽 2 张牌。弃置 1 张牌。', art: 'wheelKick',
  },
  // ---- 稀有 ----
  alphaS: {
    id: 'alphaS', name: '阿尔法', nameEn: 'Alpha', type: 'power', rarity: 'rare', cost: 1, upCost: 0, target: 'self', color: 'purple',
    values: [1], upValues: [1], desc: '在你的回合开始时，将一张"贝塔"加入手牌。', upDesc: '在你的回合开始时，将一张"贝塔"加入手牌。', art: 'alphaS',
  },
  blasphemy: {
    id: 'blasphemy', name: '亵渎', nameEn: 'Blasphemy', type: 'skill', rarity: 'rare', cost: 1, upCost: 0, target: 'none', exhaust: true, color: 'purple',
    values: [0], upValues: [0], desc: '进入神格。在你的下回合开始时，你将死亡。消耗。', upDesc: '进入神格。在你的下回合开始时，你将死亡。消耗。', art: 'blasphemy',
  },
  brillianceS: {
    id: 'brillianceS', name: '光辉', nameEn: 'Brilliance', type: 'power', rarity: 'rare', cost: 1, target: 'self', color: 'purple',
    values: [12], upValues: [16], desc: '每当你获得真言，对随机敌人造成 {0} 点伤害。', upDesc: '每当你获得真言，对随机敌人造成 {0} 点伤害。', art: 'brillianceS',
  },
  devotionS: {
    id: 'devotionS', name: '奉献', nameEn: 'Devotion', type: 'power', rarity: 'rare', cost: 1, target: 'self', color: 'purple',
    values: [2], upValues: [3], desc: '在你的回合开始时，获得 {0} 点真言。', upDesc: '在你的回合开始时，获得 {0} 点真言。', art: 'devotionS',
  },
  omniscience: {
    id: 'omniscience', name: '全知', nameEn: 'Omniscience', type: 'skill', rarity: 'rare', cost: 4, upCost: 3, target: 'none', exhaust: true, color: 'purple',
    values: [2], upValues: [2], desc: '选择一张手牌，将其打出 {0} 次。消耗。', upDesc: '选择一张手牌，将其打出 {0} 次。消耗。', art: 'omniscience',
  },
  scrawl: {
    id: 'scrawl', name: '乱涂', nameEn: 'Scrawl', type: 'skill', rarity: 'rare', cost: 2, upCost: 1, target: 'none', exhaust: true, color: 'purple',
    values: [10], upValues: [12], desc: '抽牌直到手牌达到 {0} 张。消耗。', upDesc: '抽牌直到手牌达到 {0} 张。消耗。', art: 'scrawl',
  },
  spiritShield: {
    id: 'spiritShield', name: '灵魂护盾', nameEn: 'Spirit Shield', type: 'skill', rarity: 'rare', cost: 1, target: 'self', retain: true, color: 'purple',
    values: [3], upValues: [4], desc: '手牌每有一张牌，便获得 {0} 点格挡。保留。', upDesc: '手牌每有一张牌，便获得 {0} 点格挡。保留。', art: 'spiritShield',
  },
  vault: {
    id: 'vault', name: '穹顶', nameEn: 'Vault', type: 'skill', rarity: 'rare', cost: 3, upCost: 2, target: 'none', exhaust: true, color: 'purple',
    values: [0], upValues: [0], desc: '跳过敌人的回合。消耗。', upDesc: '跳过敌人的回合。消耗。', art: 'vault',
  },
}

// ============ 观者衍生牌 ============
export const WATCHER_TOKENS: Record<string, CardDef> = {
  smite: {
    id: 'smite', name: '神罚', nameEn: 'Smite', type: 'attack', rarity: 'special', cost: 1, target: 'enemy',
    retain: true, color: 'purple', isToken: true,
    values: [6], upValues: [8], desc: '保留。造成 {0} 点伤害。消耗。', upDesc: '保留。造成 {0} 点伤害。消耗。', art: 'smite',
  },
  miracle: {
    id: 'miracle', name: '奇迹', nameEn: 'Miracle', type: 'skill', rarity: 'special', cost: 0, target: 'none',
    retain: true, exhaust: true, color: 'purple', isToken: true,
    values: [1], upValues: [1], desc: '保留。获得 {0} 点能量。消耗。', upDesc: '保留。获得 {0} 点能量。消耗。', art: 'miracle',
  },
  beta: {
    id: 'beta', name: '贝塔', nameEn: 'Beta', type: 'power', rarity: 'special', cost: 1, upCost: 0, target: 'self',
    retain: true, color: 'purple', isToken: true,
    values: [1], upValues: [1], desc: '保留。在你的回合开始时，将一张"欧米茄"加入手牌。', upDesc: '保留。在你的回合开始时，将一张"欧米茄"加入手牌。', art: 'beta',
  },
  omega: {
    id: 'omega', name: '欧米茄', nameEn: 'Omega', type: 'power', rarity: 'special', cost: 3, target: 'self',
    color: 'purple', isToken: true,
    values: [50], upValues: [50], desc: '在你的回合结束时，对所有敌人造成 {0} 点伤害。', upDesc: '在你的回合结束时，对所有敌人造成 {0} 点伤害。', art: 'omega',
  },
}

export const WATCHER_STARTER_DECK = (): string[] => [
  'strikeP', 'strikeP', 'strikeP', 'strikeP', 'strikeP',
  'defendP', 'defendP', 'defendP', 'defendP',
  'eruption', 'vigilance',
]
