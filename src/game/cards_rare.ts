// ============ 铁甲战士卡牌 - 罕见+稀有+状态牌 ============
import { CardDef } from './types'

export const CARDS_RARE: Record<string, CardDef> = {
  // ---- 罕见攻击 ----
  battleTrance: {
    id: 'battleTrance', name: '战斗恍惚', nameEn: 'Battle Trance', type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    values: [3], upValues: [4], desc: '抽 {0} 张牌。本回合内无法再抽牌。', upDesc: '抽 {0} 张牌。本回合内无法再抽牌。', art: 'mind',
  },
  bloodForBlood: {
    id: 'bloodForBlood', name: '血债血偿', nameEn: 'Blood for Blood', type: 'attack', rarity: 'uncommon', cost: 4, target: 'enemy',
    values: [20], upValues: [26], desc: '本场战斗中你每失去 1 点生命，此牌的费用便减少 1 点。造成 {0} 点伤害。', upDesc: '本场战斗中你每失去 1 点生命，此牌的费用便减少 1 点。造成 {0} 点伤害。', art: 'blood',
  },
  carnage: {
    id: 'carnage', name: '屠戮', nameEn: 'Carnage', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', ethereal: true,
    values: [20], upValues: [28], desc: '虚无。造成 {0} 点伤害。', upDesc: '虚无。造成 {0} 点伤害。', art: 'wild',
  },
  dropkick: {
    id: 'dropkick', name: '飞踢', nameEn: 'Dropkick', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    values: [5], upValues: [8], desc: '造成 {0} 点伤害。如果目标处于易伤状态，获得 1 点能量并抽 1 张牌。', upDesc: '造成 {0} 点伤害。如果目标处于易伤状态，获得 1 点能量并抽 1 张牌。', art: 'dropkick',
  },
  hemokinesis: {
    id: 'hemokinesis', name: '血激', nameEn: 'Hemokinesis', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    values: [15], upValues: [20], desc: '失去 2 点生命。造成 {0} 点伤害。', upDesc: '失去 2 点生命。造成 {0} 点伤害。', art: 'blood',
  },
  pummel: {
    id: 'pummel', name: '连续猛击', nameEn: 'Pummel', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', exhaust: true,
    values: [2, 4], upValues: [2, 5], desc: '造成 {0} 点伤害，共 {1} 次。消耗。', upDesc: '造成 {0} 点伤害，共 {1} 次。消耗。', art: 'bash',
  },
  rampage: {
    id: 'rampage', name: '暴走', nameEn: 'Rampage', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    values: [8, 5], upValues: [8, 8], desc: '造成 {0} 点伤害。本场战斗中此牌的伤害永久提高 {1} 点。', upDesc: '造成 {0} 点伤害。本场战斗中此牌的伤害永久提高 {1} 点。', art: 'rage',
  },
  recklessCharge: {
    id: 'recklessCharge', name: '鲁莽冲锋', nameEn: 'Reckless Charge', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    values: [7], upValues: [10], desc: '造成 {0} 点伤害。将一张"茫然"置于抽牌堆顶。', upDesc: '造成 {0} 点伤害。将一张"茫然"置于抽牌堆顶。', art: 'dropkick',
  },
  uppercut: {
    id: 'uppercut', name: '上勾拳', nameEn: 'Uppercut', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy',
    values: [13, 1], upValues: [15, 2], desc: '造成 {0} 点伤害，施加 {1} 层虚弱和 {1} 层易伤。', upDesc: '造成 {0} 点伤害，施加 {1} 层虚弱和 {1} 层易伤。', art: 'bash',
  },
  whirlwind: {
    id: 'whirlwind', name: '旋风斩', nameEn: 'Whirlwind', type: 'attack', rarity: 'uncommon', cost: -1, target: 'allEnemies',
    values: [5], upValues: [8], desc: '消耗所有能量。对所有敌人造成 {0} 点伤害，每消耗 1 点能量攻击一次。', upDesc: '消耗所有能量。对所有敌人造成 {0} 点伤害，每消耗 1 点能量攻击一次。', art: 'whirlwind',
  },
  // ---- 罕见技能 ----
  disarm: {
    id: 'disarm', name: '缴械', nameEn: 'Disarm', type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy', exhaust: true,
    values: [2], upValues: [3], desc: '敌人失去 {0} 点力量。消耗。', upDesc: '敌人失去 {0} 点力量。消耗。', art: 'debuff',
  },
  entrench: {
    id: 'entrench', name: '坚守', nameEn: 'Entrench', type: 'skill', rarity: 'uncommon', cost: 2, target: 'self', upCost: 1,
    values: [0], upValues: [0], desc: '你的格挡值翻倍。', upDesc: '你的格挡值翻倍。', art: 'shield',
  },
  feelNoPain: {
    id: 'feelNoPain', name: '无痛', nameEn: 'Feel No Pain', type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    values: [3], upValues: [4], desc: '每当有牌被消耗时，获得 {0} 点格挡。', upDesc: '每当有牌被消耗时，获得 {0} 点格挡。', art: 'mind',
  },
  fireBreathing: {
    id: 'fireBreathing', name: '火焰吐息', nameEn: 'Fire Breathing', type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    values: [4], upValues: [6], desc: '每当你抽到一张状态牌或诅咒牌时，对所有敌人造成 {0} 点伤害。', upDesc: '每当你抽到一张状态牌或诅咒牌时，对所有敌人造成 {0} 点伤害。', art: 'fire',
  },
  flameBarrier: {
    id: 'flameBarrier', name: '火焰屏障', nameEn: 'Flame Barrier', type: 'skill', rarity: 'uncommon', cost: 2, target: 'self',
    values: [12, 4], upValues: [16, 6], desc: '获得 {0} 点格挡。本回合内，每当你被攻击时，对攻击者造成 {1} 点伤害。', upDesc: '获得 {0} 点格挡。本回合内，每当你被攻击时，对攻击者造成 {1} 点伤害。', art: 'fire',
  },
  ghostlyArmor: {
    id: 'ghostlyArmor', name: '幽魂护甲', nameEn: 'Ghostly Armor', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', ethereal: true,
    values: [10], upValues: [13], desc: '虚无。获得 {0} 点格挡。', upDesc: '虚无。获得 {0} 点格挡。', art: 'shield',
  },
  intimidate: {
    id: 'intimidate', name: '恐吓', nameEn: 'Intimidate', type: 'skill', rarity: 'uncommon', cost: 0, target: 'allEnemies', exhaust: true,
    values: [1], upValues: [2], desc: '对所有敌人施加 {0} 层虚弱。消耗。', upDesc: '对所有敌人施加 {0} 层虚弱。消耗。', art: 'debuff',
  },
  powerThrough: {
    id: 'powerThrough', name: '强行通过', nameEn: 'Power Through', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    values: [15], upValues: [20], desc: '将 2 张"创伤"加入手牌。获得 {0} 点格挡。', upDesc: '将 2 张"创伤"加入手牌。获得 {0} 点格挡。', art: 'armor',
  },
  rage: {
    id: 'rage', name: '狂怒', nameEn: 'Rage', type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    values: [3], upValues: [5], desc: '本回合内每打出一张攻击牌，获得 {0} 点格挡。', upDesc: '本回合内每打出一张攻击牌，获得 {0} 点格挡。', art: 'rage',
  },
  secondWind: {
    id: 'secondWind', name: '回气', nameEn: 'Second Wind', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    values: [5], upValues: [7], desc: '消耗手牌中所有非攻击牌。每消耗一张，获得 {0} 点格挡。', upDesc: '消耗手牌中所有非攻击牌。每消耗一张，获得 {0} 点格挡。', art: 'mind',
  },
  seeingRed: {
    id: 'seeingRed', name: '血怒', nameEn: 'Seeing Red', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', exhaust: true, upCost: 0,
    values: [2], upValues: [2], desc: '失去 1 点生命。获得 {0} 点能量。消耗。', upDesc: '失去 1 点生命。获得 {0} 点能量。消耗。', art: 'blood',
  },
  sentinel: {
    id: 'sentinel', name: '哨卫', nameEn: 'Sentinel', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    values: [5, 2], upValues: [8, 2], desc: '获得 {0} 点格挡。如果此牌被消耗，获得 {1} 点能量。', upDesc: '获得 {0} 点格挡。如果此牌被消耗，获得 {1} 点能量。', art: 'armor',
  },
  shockwave: {
    id: 'shockwave', name: '震荡波', nameEn: 'Shockwave', type: 'skill', rarity: 'uncommon', cost: 2, target: 'allEnemies', exhaust: true,
    values: [3], upValues: [5], desc: '对所有敌人施加 {0} 层虚弱和 {0} 层易伤。消耗。', upDesc: '对所有敌人施加 {0} 层虚弱和 {0} 层易伤。消耗。', art: 'lightning',
  },
  // ---- 罕见能力 ----
  combust: {
    id: 'combust', name: '燃烧', nameEn: 'Combust', type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    values: [5], upValues: [7], desc: '在你的回合结束时，失去 1 点生命，对所有敌人造成 {0} 点伤害。', upDesc: '在你的回合结束时，失去 1 点生命，对所有敌人造成 {0} 点伤害。', art: 'fire',
  },
  darkEmbrace: {
    id: 'darkEmbrace', name: '暗黑拥抱', nameEn: 'Dark Embrace', type: 'power', rarity: 'uncommon', cost: 2, target: 'self',
    values: [0], upValues: [0], desc: '每当有牌被消耗时，抽 1 张牌。', upDesc: '每当有牌被消耗时，抽 1 张牌。', art: 'demon',
  },
  evolve: {
    id: 'evolve', name: '进化', nameEn: 'Evolve', type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    values: [1], upValues: [2], desc: '每当你抽到一张状态牌时，抽 {0} 张牌。', upDesc: '每当你抽到一张状态牌时，抽 {0} 张牌。', art: 'mind',
  },
  metallicize: {
    id: 'metallicize', name: '金属化', nameEn: 'Metallicize', type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    values: [3], upValues: [4], desc: '在你的回合结束时，获得 {0} 点格挡。', upDesc: '在你的回合结束时，获得 {0} 点格挡。', art: 'armor',
  },
  rupture: {
    id: 'rupture', name: '破裂', nameEn: 'Rupture', type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    values: [1], upValues: [2], desc: '每当你因打出牌而失去生命时，获得 {0} 点力量。', upDesc: '每当你因打出牌而失去生命时，获得 {0} 点力量。', art: 'blood',
  },
  // ---- 稀有攻击 ----
  bludgeon: {
    id: 'bludgeon', name: '重锤', nameEn: 'Bludgeon', type: 'attack', rarity: 'rare', cost: 3, target: 'enemy',
    values: [32], upValues: [42], desc: '造成 {0} 点伤害。', upDesc: '造成 {0} 点伤害。', art: 'bash',
  },
  feed: {
    id: 'feed', name: '吞噬', nameEn: 'Feed', type: 'attack', rarity: 'rare', cost: 1, target: 'enemy', exhaust: true,
    values: [10, 3], upValues: [12, 4], desc: '造成 {0} 点伤害。若此伤害致命，你的最大生命值永久提高 {1} 点。消耗。', upDesc: '造成 {0} 点伤害。若此伤害致命，你的最大生命值永久提高 {1} 点。消耗。', art: 'demon',
  },
  fiendFire: {
    id: 'fiendFire', name: '恶魔之火', nameEn: 'Fiend Fire', type: 'attack', rarity: 'rare', cost: 2, target: 'enemy', exhaust: true,
    values: [7], upValues: [10], desc: '消耗手牌中的所有牌。每消耗一张，造成 {0} 点伤害。消耗。', upDesc: '消耗手牌中的所有牌。每消耗一张，造成 {0} 点伤害。消耗。', art: 'demon',
  },
  immolate: {
    id: 'immolate', name: '炼狱', nameEn: 'Immolate', type: 'attack', rarity: 'rare', cost: 2, target: 'allEnemies',
    values: [21], upValues: [28], desc: '对所有敌人造成 {0} 点伤害。将一张"灼伤"置于弃牌堆。', upDesc: '对所有敌人造成 {0} 点伤害。将一张"灼伤"置于弃牌堆。', art: 'fire',
  },
  reaper: {
    id: 'reaper', name: '收割', nameEn: 'Reaper', type: 'attack', rarity: 'rare', cost: 2, target: 'allEnemies', exhaust: true,
    values: [4], upValues: [5], desc: '对所有敌人造成 {0} 点伤害。回复等同于未被格挡伤害总和的生命值。消耗。', upDesc: '对所有敌人造成 {0} 点伤害。回复等同于未被格挡伤害总和的生命值。消耗。', art: 'heal',
  },
  // ---- 稀有技能 ----
  impervious: {
    id: 'impervious', name: '无懈可击', nameEn: 'Impervious', type: 'skill', rarity: 'rare', cost: 2, target: 'self', exhaust: true,
    values: [30], upValues: [40], desc: '获得 {0} 点格挡。消耗。', upDesc: '获得 {0} 点格挡。消耗。', art: 'armor',
  },
  // ---- 稀有能力 ----
  barricade: {
    id: 'barricade', name: '壁垒', nameEn: 'Barricade', type: 'power', rarity: 'rare', cost: 3, target: 'self', upCost: 2,
    values: [0], upValues: [0], desc: '格挡值不再在回合开始时消失。', upDesc: '格挡值不再在回合开始时消失。', art: 'armor',
  },
  berserk: {
    id: 'berserk', name: '狂暴', nameEn: 'Berserk', type: 'power', rarity: 'rare', cost: 0, target: 'self',
    values: [2], upValues: [2], desc: '获得 {0} 层易伤。在你的回合开始时，获得 1 点能量。', upDesc: '获得 {0} 层易伤。在你的回合开始时，获得 1 点能量。', art: 'rage',
  },
  brutality: {
    id: 'brutality', name: '残暴', nameEn: 'Brutality', type: 'power', rarity: 'rare', cost: 0, target: 'self',
    values: [0], upValues: [0], desc: '在你的回合开始时，失去 1 点生命并抽 1 张牌。', upDesc: '固有。在你的回合开始时，失去 1 点生命并抽 1 张牌。', art: 'demon',
  },
  corruption: {
    id: 'corruption', name: '堕落', nameEn: 'Corruption', type: 'power', rarity: 'rare', cost: 3, target: 'self', upCost: 2,
    values: [0], upValues: [0], desc: '技能牌费用变为 0 点。技能牌被打出后消耗。', upDesc: '技能牌费用变为 0 点。技能牌被打出后消耗。', art: 'demon',
  },
  demonForm: {
    id: 'demonForm', name: '恶魔形态', nameEn: 'Demon Form', type: 'power', rarity: 'rare', cost: 3, target: 'self',
    values: [2], upValues: [3], desc: '在你的回合开始时，获得 {0} 点力量。', upDesc: '在你的回合开始时，获得 {0} 点力量。', art: 'demon',
  },
  doubleTap: {
    id: 'doubleTap', name: '连击', nameEn: 'Double Tap', type: 'skill', rarity: 'rare', cost: 1, target: 'none',
    values: [1], upValues: [2], desc: '本回合内，你的下 {0} 张攻击牌将被打出两次。', upDesc: '本回合内，你的下 {0} 张攻击牌将被打出两次。', art: 'slash',
  },
  juggernaut: {
    id: 'juggernaut', name: '主宰', nameEn: 'Juggernaut', type: 'power', rarity: 'rare', cost: 2, target: 'self',
    values: [5], upValues: [7], desc: '每当你获得格挡时，对随机敌人造成 {0} 点伤害。', upDesc: '每当你获得格挡时，对随机敌人造成 {0} 点伤害。', art: 'armor',
  },
  limitBreak: {
    id: 'limitBreak', name: '极限突破', nameEn: 'Limit Break', type: 'skill', rarity: 'rare', cost: 1, target: 'self', exhaust: true,
    values: [0], upValues: [0], desc: '你的力量翻倍。消耗。', upDesc: '你的力量翻倍。', art: 'strength',
  },
  offering: {
    id: 'offering', name: '献祭', nameEn: 'Offering', type: 'skill', rarity: 'rare', cost: 0, target: 'self', exhaust: true,
    values: [3], upValues: [5], desc: '失去 6 点生命。获得 2 点能量。抽 {0} 张牌。消耗。', upDesc: '失去 6 点生命。获得 2 点能量。抽 {0} 张牌。消耗。', art: 'blood',
  },
}

// ============ 状态牌 ============
export const STATUS_CARDS: Record<string, CardDef> = {
  wound: {
    id: 'wound', name: '创伤', nameEn: 'Wound', type: 'skill', rarity: 'special', cost: -99, target: 'none',
    desc: '不可打出。', upDesc: '不可打出。', art: 'curse', values: [], upValues: [],
  },
  dazed: {
    id: 'dazed', name: '茫然', nameEn: 'Dazed', type: 'skill', rarity: 'special', cost: -99, target: 'none', ethereal: true,
    desc: '不可打出。虚无。', upDesc: '不可打出。虚无。', art: 'curse', values: [], upValues: [],
  },
  burn: {
    id: 'burn', name: '灼伤', nameEn: 'Burn', type: 'skill', rarity: 'special', cost: -99, target: 'none',
    desc: '不可打出。在你的回合结束时，受到 2 点伤害。', upDesc: '不可打出。在你的回合结束时，受到 2 点伤害。', art: 'curse', values: [], upValues: [],
  },
  slimed: {
    id: 'slimed', name: '粘液', nameEn: 'Slimed', type: 'skill', rarity: 'special', cost: -99, target: 'none', exhaustOnDiscard: true,
    desc: '不可打出。消耗。', upDesc: '不可打出。消耗。', art: 'curse', values: [], upValues: [],
  },
  // 诅咒牌（涅奥第三祝福等来源）
  regret: {
    id: 'regret', name: '懊悔', nameEn: 'Regret', type: 'skill', rarity: 'special', cost: -99, target: 'none', curse: true,
    desc: '诅咒。不可打出。在你的回合结束时，失去等同手牌数量的生命。', upDesc: '诅咒。不可打出。在你的回合结束时，失去等同手牌数量的生命。', art: 'curse', values: [], upValues: [],
  },
  injury: {
    id: 'injury', name: '损伤', nameEn: 'Injury', type: 'skill', rarity: 'special', cost: -99, target: 'none', curse: true,
    desc: '状态。不可打出。', upDesc: '状态。不可打出。', art: 'curse', values: [], upValues: [],
  },
  doubt: {
    id: 'doubt', name: '疑虑', nameEn: 'Doubt', type: 'skill', rarity: 'special', cost: -99, target: 'none', curse: true,
    desc: '诅咒。不可打出。在你的回合结束时，获得 1 层虚弱。', upDesc: '诅咒。不可打出。在你的回合结束时，获得 1 层虚弱。', art: 'curse', values: [], upValues: [],
  },
}
