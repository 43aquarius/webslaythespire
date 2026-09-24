// ============ 寂静猎手卡牌（绿）============
import { CardDef } from './types'

export const CARDS_SILENT: Record<string, CardDef> = {
  // ---- 初始 ----
  strikeG: {
    id: 'strikeG', name: '打击', nameEn: 'Strike', type: 'attack', rarity: 'starter', cost: 1, target: 'enemy', color: 'green',
    values: [6], upValues: [9], desc: '造成 {0} 点伤害。', upDesc: '造成 {0} 点伤害。', art: 'strikeG',
  },
  defendG: {
    id: 'defendG', name: '防御', nameEn: 'Defend', type: 'skill', rarity: 'starter', cost: 1, target: 'self', color: 'green',
    values: [5], upValues: [8], desc: '获得 {0} 点格挡。', upDesc: '获得 {0} 点格挡。', art: 'defendG',
  },
  neutralize: {
    id: 'neutralize', name: '中和', nameEn: 'Neutralize', type: 'attack', rarity: 'starter', cost: 0, target: 'enemy', color: 'green',
    values: [3, 1], upValues: [4, 2], desc: '造成 {0} 点伤害，施加 {1} 层中毒。', upDesc: '造成 {0} 点伤害，施加 {1} 层中毒。', art: 'neutralize',
  },
  survivor: {
    id: 'survivor', name: '幸存者', nameEn: 'Survivor', type: 'skill', rarity: 'starter', cost: 1, target: 'self', color: 'green',
    values: [8], upValues: [11], desc: '获得 {0} 点格挡。弃置一张手牌。', upDesc: '获得 {0} 点格挡。弃置一张手牌。', art: 'survivor',
  },
  // ---- 普通 ----
  bladeDance: {
    id: 'bladeDance', name: '刀刃之舞', nameEn: 'Blade Dance', type: 'skill', rarity: 'common', cost: 1, target: 'none', color: 'green',
    values: [3], upValues: [4], desc: '将 {0} 张"小刀"加入手牌。', upDesc: '将 {0} 张"小刀"加入手牌。', art: 'bladeDance',
  },
  cloakAndDagger: {
    id: 'cloakAndDagger', name: '隐匿匕首', nameEn: 'Cloak and Dagger', type: 'skill', rarity: 'common', cost: 1, target: 'self', color: 'green',
    values: [6, 1], upValues: [6, 2], desc: '获得 {0} 点格挡。将 {1} 张"小刀"加入手牌。', upDesc: '获得 {0} 点格挡。将 {1} 张"小刀"加入手牌。', art: 'cloakAndDagger',
  },
  daggerSpray: {
    id: 'daggerSpray', name: '匕首飞洒', nameEn: 'Dagger Spray', type: 'attack', rarity: 'common', cost: 1, target: 'allEnemies', color: 'green',
    values: [4, 2], upValues: [6, 2], desc: '对所有敌人造成 {0} 点伤害，共 {1} 次。', upDesc: '对所有敌人造成 {0} 点伤害，共 {1} 次。', art: 'daggerSpray',
  },
  daggerThrow: {
    id: 'daggerThrow', name: '匕首投掷', nameEn: 'Dagger Throw', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', color: 'green',
    values: [9], upValues: [12], desc: '造成 {0} 点伤害。抽 1 张牌，弃置 1 张牌。', upDesc: '造成 {0} 点伤害。抽 1 张牌，弃置 1 张牌。', art: 'daggerThrow',
  },
  deadlyPoison: {
    id: 'deadlyPoison', name: '致命毒素', nameEn: 'Deadly Poison', type: 'skill', rarity: 'common', cost: 1, target: 'enemy', color: 'green',
    values: [5], upValues: [7], desc: '施加 {0} 层中毒。', upDesc: '施加 {0} 层中毒。', art: 'deadlyPoison',
  },
  deflect: {
    id: 'deflect', name: '闪避', nameEn: 'Deflect', type: 'skill', rarity: 'common', cost: 0, target: 'self', color: 'green',
    values: [4], upValues: [7], desc: '获得 {0} 点格挡。', upDesc: '获得 {0} 点格挡。', art: 'deflect',
  },
  dodgeAndRoll: {
    id: 'dodgeAndRoll', name: '翻滚闪避', nameEn: 'Dodge and Roll', type: 'skill', rarity: 'common', cost: 1, target: 'self', color: 'green',
    values: [6], upValues: [8], desc: '获得 {0} 点格挡。下回合开始时再获得 {0} 点格挡。', upDesc: '获得 {0} 点格挡。下回合开始时再获得 {0} 点格挡。', art: 'dodgeAndRoll',
  },
  flyingKnee: {
    id: 'flyingKnee', name: '飞膝踢', nameEn: 'Flying Knee', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', color: 'green',
    values: [8], upValues: [11], desc: '造成 {0} 点伤害。下回合获得 1 点能量。', upDesc: '造成 {0} 点伤害。下回合获得 1 点能量。', art: 'flyingKnee',
  },
  outmaneuver: {
    id: 'outmaneuver', name: '智取', nameEn: 'Outmaneuver', type: 'skill', rarity: 'common', cost: 2, target: 'self', color: 'green',
    values: [2], upValues: [3], desc: '下回合获得 {0} 点能量。', upDesc: '下回合获得 {0} 点能量。', art: 'outmaneuver',
  },
  poisonedStab: {
    id: 'poisonedStab', name: '淬毒刺击', nameEn: 'Poisoned Stab', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', color: 'green',
    values: [6, 3], upValues: [8, 4], desc: '造成 {0} 点伤害，施加 {1} 层中毒。', upDesc: '造成 {0} 点伤害，施加 {1} 层中毒。', art: 'poisonedStab',
  },
  prepared: {
    id: 'prepared', name: '有备而来', nameEn: 'Prepared', type: 'skill', rarity: 'common', cost: 0, target: 'none', color: 'green',
    values: [1], upValues: [2], desc: '抽 {0} 张牌。弃置 {0} 张牌。', upDesc: '抽 {0} 张牌。弃置 {0} 张牌。', art: 'prepared',
  },
  slice: {
    id: 'slice', name: '切割', nameEn: 'Slice', type: 'attack', rarity: 'common', cost: 0, target: 'enemy', color: 'green',
    values: [6], upValues: [9], desc: '造成 {0} 点伤害。', upDesc: '造成 {0} 点伤害。', art: 'slice',
  },
  sneakyStrike: {
    id: 'sneakyStrike', name: '暗袭', nameEn: 'Sneaky Strike', type: 'attack', rarity: 'common', cost: 2, target: 'enemy', color: 'green',
    values: [12], upValues: [14], desc: '造成 {0} 点伤害。若本回合弃置过牌，获得 2 点能量。', upDesc: '造成 {0} 点伤害。若本回合弃置过牌，获得 2 点能量。', art: 'sneakyStrike',
  },
  suckerPunch: {
    id: 'suckerPunch', name: '偷袭', nameEn: 'Sucker Punch', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', color: 'green',
    values: [7, 2], upValues: [9, 3], desc: '造成 {0} 点伤害，施加 {1} 层虚弱。', upDesc: '造成 {0} 点伤害，施加 {1} 层虚弱。', art: 'suckerPunch',
  },
  // ---- 罕见 ----
  accuracy: {
    id: 'accuracy', name: '精准', nameEn: 'Accuracy', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', color: 'green',
    values: [4], upValues: [6], desc: '"小刀"造成的伤害提高 {0} 点。', upDesc: '"小刀"造成的伤害提高 {0} 点。', art: 'accuracy',
  },
  acrobatics: {
    id: 'acrobatics', name: '杂技', nameEn: 'Acrobatics', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none', color: 'green',
    values: [3], upValues: [4], desc: '抽 {0} 张牌。弃置 1 张牌。', upDesc: '抽 {0} 张牌。弃置 1 张牌。', art: 'acrobatics',
  },
  backflip: {
    id: 'backflip', name: '后空翻', nameEn: 'Backflip', type: 'attack', rarity: 'uncommon', cost: 1, target: 'allEnemies', color: 'green',
    values: [5, 5], upValues: [8, 8], desc: '获得 {0} 点格挡。对所有敌人造成 {1} 点伤害。', upDesc: '获得 {0} 点格挡。对所有敌人造成 {1} 点伤害。', art: 'backflip',
  },
  bane: {
    id: 'bane', name: '祸根', nameEn: 'Bane', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', color: 'green',
    values: [7], upValues: [10], desc: '造成 {0} 点伤害。若目标处于中毒状态，再造成 {0} 点伤害。', upDesc: '造成 {0} 点伤害。若目标处于中毒状态，再造成 {0} 点伤害。', art: 'bane',
  },
  bouncingBlade: {
    id: 'bouncingBlade', name: '弹跳之刃', nameEn: 'Bouncing Blade', type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy', color: 'green',
    values: [3, 3], upValues: [4, 4], desc: '对随机敌人造成 {0} 点伤害，共 {1} 次。', upDesc: '对随机敌人造成 {0} 点伤害，共 {1} 次。', art: 'bouncingBlade',
  },
  calculatedGamble: {
    id: 'calculatedGamble', name: '谨慎下注', nameEn: 'Calculated Gamble', type: 'skill', rarity: 'uncommon', cost: 2, upCost: 0, target: 'none', exhaust: true, color: 'green',
    values: [0], upValues: [0], desc: '弃置全部手牌，抽等量的牌。消耗。', upDesc: '弃置全部手牌，抽等量的牌。消耗。', art: 'calculatedGamble',
  },
  caltropsS: {
    id: 'caltropsS', name: '蒺藜', nameEn: 'Caltrops', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', color: 'green',
    values: [3], upValues: [5], desc: '每当你被攻击时，对攻击者造成 {0} 点伤害。', upDesc: '每当你被攻击时，对攻击者造成 {0} 点伤害。', art: 'caltropsS',
  },
  catalyst: {
    id: 'catalyst', name: '催化剂', nameEn: 'Catalyst', type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy', exhaust: true, color: 'green',
    values: [2], upValues: [3], desc: '目标的 Poison层数翻 {0} 倍。消耗。', upDesc: '目标的中毒层数变为 {0} 倍。消耗。', art: 'catalyst',
  },
  chumpBlocker: {
    id: 'chumpBlocker', name: '肉盾', nameEn: 'Chump Blocker', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', color: 'green',
    values: [5, 1], upValues: [8, 1], desc: '获得 {0} 点格挡。将 {1} 张"小刀"加入手牌。', upDesc: '获得 {0} 点格挡。将 {1} 张"小刀"加入手牌。', art: 'chumpBlocker',
  },
  concentrate: {
    id: 'concentrate', name: '专注', nameEn: 'Concentrate', type: 'skill', rarity: 'uncommon', cost: 0, target: 'none', color: 'green',
    values: [2, 2], upValues: [1, 2], desc: '弃置 {0} 张牌。获得 {1} 点能量。', upDesc: '弃置 {0} 张牌。获得 {1} 点能量。', art: 'concentrate',
  },
  dash: {
    id: 'dash', name: '猛冲', nameEn: 'Dash', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', color: 'green',
    values: [10, 10], upValues: [13, 13], desc: '获得 {1} 点格挡，造成 {0} 点伤害。', upDesc: '获得 {1} 点格挡，造成 {0} 点伤害。', art: 'dash',
  },
  distraction: {
    id: 'distraction', name: '声东击西', nameEn: 'Distraction', type: 'skill', rarity: 'uncommon', cost: 2, upCost: 1, target: 'none', color: 'green',
    values: [1], upValues: [1], desc: '将 {0} 张随机技能牌加入手牌，本回合其费用为 0。', upDesc: '将 {0} 张随机技能牌加入手牌，本回合其费用为 0。', art: 'distraction',
  },
  endlessAgony: {
    id: 'endlessAgony', name: '无尽苦痛', nameEn: 'Endless Agony', type: 'attack', rarity: 'uncommon', cost: 0, target: 'enemy', ethereal: true, exhaust: true, color: 'green',
    values: [4], upValues: [6], desc: '虚无。消耗。造成 {0} 点伤害。', upDesc: '虚无。消耗。造成 {0} 点伤害。', art: 'endlessAgony',
  },
  eviscerate: {
    id: 'eviscerate', name: '剜心', nameEn: 'Eviscerate', type: 'attack', rarity: 'uncommon', cost: 3, target: 'enemy', color: 'green',
    values: [7, 3], upValues: [9, 3], desc: '本回合每弃置一张牌，费用便减少 1 点。造成 {0} 点伤害，共 {1} 次。', upDesc: '本回合每弃置一张牌，费用便减少 1 点。造成 {0} 点伤害，共 {1} 次。', art: 'eviscerate',
  },
  expertise: {
    id: 'expertise', name: '专长', nameEn: 'Expertise', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none', color: 'green',
    values: [6], upValues: [7], desc: '抽牌直到手牌达到 {0} 张。', upDesc: '抽牌直到手牌达到 {0} 张。', art: 'expertise',
  },
  finisher: {
    id: 'finisher', name: '终结', nameEn: 'Finisher', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', color: 'green',
    values: [6], upValues: [8], desc: '造成 {0} 点伤害，次数等同于本回合打出的攻击牌数量。', upDesc: '造成 {0} 点伤害，次数等同于本回合打出的攻击牌数量。', art: 'finisher',
  },
  footwork: {
    id: 'footwork', name: '步法', nameEn: 'Footwork', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', color: 'green',
    values: [2], upValues: [3], desc: '获得 {0} 点敏捷。', upDesc: '获得 {0} 点敏捷。', art: 'footwork',
  },
  heelHook: {
    id: 'heelHook', name: '锁腿', nameEn: 'Heel Hook', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', color: 'green',
    values: [5], upValues: [8], desc: '造成 {0} 点伤害。若目标处于虚弱状态，抽 1 张牌并获得 1 点能量。', upDesc: '造成 {0} 点伤害。若目标处于虚弱状态，抽 1 张牌并获得 1 点能量。', art: 'heelHook',
  },
  legSweep: {
    id: 'legSweep', name: '扫腿', nameEn: 'Leg Sweep', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', color: 'green',
    values: [11, 2], upValues: [14, 3], desc: '施加 {1} 层虚弱。获得 {0} 点格挡。', upDesc: '施加 {1} 层虚弱。获得 {0} 点格挡。', art: 'legSweep',
  },
  predator: {
    id: 'predator', name: '掠食者', nameEn: 'Predator', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', color: 'green',
    values: [15], upValues: [20], desc: '造成 {0} 点伤害。下回合多抽 2 张牌。', upDesc: '造成 {0} 点伤害。下回合多抽 2 张牌。', art: 'predator',
  },
  reflex: {
    id: 'reflex', name: '本能反应', nameEn: 'Reflex', type: 'skill', rarity: 'uncommon', cost: -99, target: 'none', color: 'green',
    unplayable: true, onDiscardDraw: 3,
    values: [3], upValues: [4], desc: '不可打出。若此牌从手牌被弃置，抽 {0} 张牌。', upDesc: '不可打出。若此牌从手牌被弃置，抽 {0} 张牌。', art: 'reflex',
  },
  terror: {
    id: 'terror', name: '恐惧', nameEn: 'Terror', type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy', exhaust: true, color: 'green',
    values: [2], upValues: [3], desc: '施加 {0} 层易伤。消耗。', upDesc: '施加 {0} 层易伤。消耗。', art: 'terror',
  },
  // ---- 稀有 ----
  aThousandCuts: {
    id: 'aThousandCuts', name: '千刀万剐', nameEn: 'A Thousand Cuts', type: 'power', rarity: 'rare', cost: 2, target: 'self', color: 'green',
    values: [1], upValues: [2], desc: '每当你打出一张牌，对所有敌人造成 {0} 点伤害。', upDesc: '每当你打出一张牌，对所有敌人造成 {0} 点伤害。', art: 'aThousandCuts',
  },
  adrenaline: {
    id: 'adrenaline', name: '肾上腺素', nameEn: 'Adrenaline', type: 'skill', rarity: 'rare', cost: 0, target: 'self', exhaust: true, color: 'green',
    values: [1, 2], upValues: [1, 2], desc: '获得 {0} 点能量。抽 {1} 张牌。消耗。', upDesc: '获得 {0} 点能量。抽 {1} 张牌，获得 1 点敏捷。消耗。', art: 'adrenaline',
  },
  afterImage: {
    id: 'afterImage', name: '残像', nameEn: 'After Image', type: 'power', rarity: 'rare', cost: 1, target: 'self', color: 'green',
    values: [1], upValues: [2], desc: '每当你打出一张牌，获得 {0} 点格挡。', upDesc: '每当你打出一张牌，获得 {0} 点格挡。', art: 'afterImage',
  },
  burst: {
    id: 'burst', name: '连发', nameEn: 'Burst', type: 'skill', rarity: 'rare', cost: 2, target: 'none', color: 'green',
    values: [1], upValues: [2], desc: '本回合你打出的下 {0} 张技能牌将被打出两次。', upDesc: '本回合你打出的下 {0} 张技能牌将被打出两次。', art: 'burst',
  },
  corpseExplosion: {
    id: 'corpseExplosion', name: '尸体爆炸', nameEn: 'Corpse Explosion', type: 'skill', rarity: 'rare', cost: 2, target: 'enemy', color: 'green',
    values: [6], upValues: [9], desc: '施加 {0} 层中毒。当目标死亡时，对所有敌人造成其最大生命值的伤害。', upDesc: '施加 {0} 层中毒。当目标死亡时，对所有敌人造成其最大生命值的伤害。', art: 'corpseExplosion',
  },
  dieDieDie: {
    id: 'dieDieDie', name: '去死吧！', nameEn: 'Die Die Die', type: 'attack', rarity: 'rare', cost: 1, target: 'allEnemies', exhaust: true, color: 'green',
    values: [13], upValues: [17], desc: '对所有敌人造成 {0} 点伤害。消耗。', upDesc: '对所有敌人造成 {0} 点伤害。消耗。', art: 'dieDieDie',
  },
  envenomS: {
    id: 'envenomS', name: '淬毒', nameEn: 'Envenom', type: 'power', rarity: 'rare', cost: 2, target: 'self', color: 'green',
    values: [1], upValues: [2], desc: '攻击造成的未被格挡伤害会施加 {0} 层中毒。', upDesc: '攻击造成的未被格挡伤害会施加 {0} 层中毒。', art: 'envenomS',
  },
  glassKnife: {
    id: 'glassKnife', name: '玻璃小刀', nameEn: 'Glass Knife', type: 'attack', rarity: 'rare', cost: 1, target: 'enemy', color: 'green',
    values: [8, 2], upValues: [12, 2], desc: '造成 {0} 点伤害，共 2 次。每次打出此牌，其伤害永久降低 {1} 点。', upDesc: '造成 {0} 点伤害，共 2 次。每次打出此牌，其伤害永久降低 {1} 点。', art: 'glassKnife',
  },
  grandFinale: {
    id: 'grandFinale', name: '压轴大戏', nameEn: 'Grand Finale', type: 'attack', rarity: 'rare', cost: 0, target: 'allEnemies', color: 'green',
    values: [50], upValues: [54], desc: '只有在抽牌堆为空时才能打出。对所有敌人造成 {0} 点伤害。', upDesc: '只有在抽牌堆为空时才能打出。对所有敌人造成 {0} 点伤害。', art: 'grandFinale',
  },
  nightmare: {
    id: 'nightmare', name: '噩梦', nameEn: 'Nightmare', type: 'skill', rarity: 'rare', cost: 3, target: 'none', exhaust: true, color: 'green',
    values: [3], upValues: [4], desc: '选择一张手牌。下回合将 {0} 张该牌的副本加入手牌。消耗。', upDesc: '选择一张手牌。下回合将 {0} 张该牌的副本加入手牌。消耗。', art: 'nightmare',
  },
  phantasmalKiller: {
    id: 'phantasmalKiller', name: '幻影杀手', nameEn: 'Phantasmal Killer', type: 'skill', rarity: 'rare', cost: 1, target: 'self', exhaust: true, color: 'green',
    values: [2], upValues: [2], desc: '下一张攻击牌造成的伤害翻倍。消耗。', upDesc: '下一张攻击牌造成的伤害翻倍。消耗。', art: 'phantasmalKiller',
  },
  stormOfSteel: {
    id: 'stormOfSteel', name: '钢铁风暴', nameEn: 'Storm of Steel', type: 'skill', rarity: 'rare', cost: 1, target: 'none', color: 'green',
    values: [1], upValues: [1], desc: '弃置全部手牌。每弃置一张，将一张"小刀"加入手牌。', upDesc: '弃置全部手牌。每弃置一张，将一张已升级的"小刀"加入手牌。', art: 'stormOfSteel',
  },
  wraithForm: {
    id: 'wraithForm', name: '幽魂形态', nameEn: 'Wraith Form', type: 'power', rarity: 'rare', cost: 3, target: 'self', color: 'green',
    values: [2], upValues: [3], desc: '获得 {0} 层虚无形体。每回合结束时失去 1 点敏捷。', upDesc: '获得 {0} 层虚无形体。每回合结束时失去 1 点敏捷。', art: 'wraithForm',
  },
}

// ============ 寂静猎手衍生牌 ============
export const SILENT_TOKENS: Record<string, CardDef> = {
  shiv: {
    id: 'shiv', name: '小刀', nameEn: 'Shiv', type: 'attack', rarity: 'special', cost: 0, target: 'enemy',
    exhaust: true, color: 'green', isToken: true,
    values: [4], upValues: [8], desc: '造成 {0} 点伤害。消耗。', upDesc: '造成 {0} 点伤害。消耗。', art: 'shiv',
  },
  void: {
    id: 'void', name: '虚空', nameEn: 'Void', type: 'skill', rarity: 'special', cost: -99, target: 'none',
    ethereal: true, color: 'green', isToken: true,
    values: [1], upValues: [1], desc: '不可打出。虚无。在回合结束时，失去 {0} 点能量。', upDesc: '不可打出。虚无。在回合结束时，失去 {0} 点能量。', art: 'void',
  },
}

export const SILENT_STARTER_DECK = (): string[] => [
  'strikeG', 'strikeG', 'strikeG', 'strikeG', 'strikeG',
  'defendG', 'defendG', 'defendG', 'defendG',
  'neutralize', 'survivor',
]
