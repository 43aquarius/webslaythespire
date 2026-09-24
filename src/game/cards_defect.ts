// ============ 故障机器人卡牌（蓝）============
import { CardDef } from './types'

export const CARDS_DEFECT: Record<string, CardDef> = {
  // ---- 初始 ----
  strikeB: {
    id: 'strikeB', name: '打击', nameEn: 'Strike', type: 'attack', rarity: 'starter', cost: 1, target: 'enemy', color: 'blue',
    values: [6], upValues: [9], desc: '造成 {0} 点伤害。', upDesc: '造成 {0} 点伤害。', art: 'strikeB',
  },
  defendB: {
    id: 'defendB', name: '防御', nameEn: 'Defend', type: 'skill', rarity: 'starter', cost: 1, target: 'self', color: 'blue',
    values: [5], upValues: [8], desc: '获得 {0} 点格挡。', upDesc: '获得 {0} 点格挡。', art: 'defendB',
  },
  zap: {
    id: 'zap', name: '电击', nameEn: 'Zap', type: 'skill', rarity: 'starter', cost: 1, upCost: 0, target: 'none', color: 'blue',
    values: [1], upValues: [1], desc: '引导 {0} 个闪电球。', upDesc: '引导 {0} 个闪电球。', art: 'zap',
  },
  dualcast: {
    id: 'dualcast', name: '双重施法', nameEn: 'Dualcast', type: 'skill', rarity: 'starter', cost: 1, upCost: 0, target: 'none', color: 'blue',
    values: [2], upValues: [2], desc: '唤起你最右侧的充能球 {0} 次。', upDesc: '唤起你最右侧的充能球 {0} 次。', art: 'dualcast',
  },
  // ---- 普通 ----
  ballLightning: {
    id: 'ballLightning', name: '球状闪电', nameEn: 'Ball Lightning', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', color: 'blue',
    values: [7, 1], upValues: [10, 1], desc: '造成 {0} 点伤害。引导 {1} 个闪电球。', upDesc: '造成 {0} 点伤害。引导 {1} 个闪电球。', art: 'ballLightning',
  },
  barrage: {
    id: 'barrage', name: '弹幕', nameEn: 'Barrage', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', color: 'blue',
    values: [4], upValues: [6], desc: '你每引导一个充能球，便造成 {0} 点伤害。', upDesc: '你每引导一个充能球，便造成 {0} 点伤害。', art: 'barrage',
  },
  beamCell: {
    id: 'beamCell', name: '光束单元', nameEn: 'Beam Cell', type: 'attack', rarity: 'common', cost: 0, target: 'enemy', color: 'blue',
    values: [3, 1], upValues: [5, 2], desc: '造成 {0} 点伤害，施加 {1} 层易伤。', upDesc: '造成 {0} 点伤害，施加 {1} 层易伤。', art: 'beamCell',
  },
  claw: {
    id: 'claw', name: '爪击', nameEn: 'Claw', type: 'attack', rarity: 'common', cost: 0, target: 'enemy', color: 'blue',
    values: [3], upValues: [5], desc: '造成 {0} 点伤害。本场战斗中每次打出"爪击"，其伤害提高 2 点。', upDesc: '造成 {0} 点伤害。本场战斗中每次打出"爪击"，其伤害提高 2 点。', art: 'claw',
  },
  coldSnap: {
    id: 'coldSnap', name: '寒流', nameEn: 'Cold Snap', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', color: 'blue',
    values: [6, 1], upValues: [9, 1], desc: '造成 {0} 点伤害。引导 {1} 个霜球。', upDesc: '造成 {0} 点伤害。引导 {1} 个霜球。', art: 'coldSnap',
  },
  compileDriver: {
    id: 'compileDriver', name: '编译驱动', nameEn: 'Compile Driver', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', color: 'blue',
    values: [7, 1], upValues: [10, 1], desc: '造成 {0} 点伤害。你每有一种充能球，便抽 {1} 张牌。', upDesc: '造成 {0} 点伤害。你每有一种充能球，便抽 {1} 张牌。', art: 'compileDriver',
  },
  goForTheEyes: {
    id: 'goForTheEyes', name: '直击要害', nameEn: 'Go for the Eyes', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', color: 'blue',
    values: [3, 2], upValues: [5, 3], desc: '造成 {0} 点伤害。若敌人意图攻击，施加 {1} 层虚弱。', upDesc: '造成 {0} 点伤害。若敌人意图攻击，施加 {1} 层虚弱。', art: 'goForTheEyes',
  },
  hologram: {
    id: 'hologram', name: '全息影像', nameEn: 'Hologram', type: 'skill', rarity: 'common', cost: 1, target: 'none', color: 'blue',
    values: [3], upValues: [5], desc: '获得 {0} 点格挡。将弃牌堆中的一张牌返回手牌。', upDesc: '获得 {0} 点格挡。将弃牌堆中的一张牌返回手牌。', art: 'hologram',
  },
  leap: {
    id: 'leap', name: '跳跃', nameEn: 'Leap', type: 'skill', rarity: 'common', cost: 0, target: 'self', color: 'blue',
    values: [9], upValues: [13], desc: '获得 {0} 点格挡。', upDesc: '获得 {0} 点格挡。', art: 'leap',
  },
  reprogram: {
    id: 'reprogram', name: '重编程序', nameEn: 'Reprogram', type: 'skill', rarity: 'common', cost: 1, target: 'self', color: 'blue',
    values: [2], upValues: [3], desc: '失去 1 点集中。获得 {0} 点力量和 {0} 点敏捷。', upDesc: '失去 1 点集中。获得 {0} 点力量和 {0} 点敏捷。', art: 'reprogram',
  },
  sweepBeam: {
    id: 'sweepBeam', name: '扫射光束', nameEn: 'Sweep Beam', type: 'attack', rarity: 'common', cost: 2, target: 'allEnemies', color: 'blue',
    values: [6, 1], upValues: [9, 1], desc: '对所有敌人造成 {0} 点伤害。引导 {1} 个闪电球。', upDesc: '对所有敌人造成 {0} 点伤害。引导 {1} 个闪电球。', art: 'sweepBeam',
  },
  // ---- 罕见 ----
  autoShields: {
    id: 'autoShields', name: '自动护盾', nameEn: 'Auto-Shields', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', color: 'blue',
    values: [11], upValues: [15], desc: '若你没有格挡，获得 {0} 点格挡。', upDesc: '若你没有格挡，获得 {0} 点格挡。', art: 'autoShields',
  },
  blizzard: {
    id: 'blizzard', name: '暴风雪', nameEn: 'Blizzard', type: 'skill', rarity: 'uncommon', cost: 1, target: 'allEnemies', color: 'blue',
    values: [3], upValues: [5], desc: '你每引导一个霜球，便对所有敌人造成 {0} 点伤害。', upDesc: '你每引导一个霜球，便对所有敌人造成 {0} 点伤害。', art: 'blizzard',
  },
  capacitor: {
    id: 'capacitor', name: '电容器', nameEn: 'Capacitor', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', color: 'blue',
    values: [1], upValues: [2], desc: '充能球上限提高 {0} 点。', upDesc: '充能球上限提高 {0} 点。', art: 'capacitor',
  },
  chargeBattery: {
    id: 'chargeBattery', name: '充电电池', nameEn: 'Charge Battery', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', color: 'blue',
    values: [11], upValues: [14], desc: '获得 {0} 点格挡。下回合获得 1 点能量。', upDesc: '获得 {0} 点格挡。下回合获得 1 点能量。', art: 'chargeBattery',
  },
  chill: {
    id: 'chill', name: '冰冻', nameEn: 'Chill', type: 'skill', rarity: 'uncommon', cost: 2, upCost: 1, target: 'none', exhaust: true, color: 'blue',
    values: [1], upValues: [1], desc: '手牌每有 2 张牌，便引导 {0} 个霜球。消耗。', upDesc: '手牌每有 2 张牌，便引导 {0} 个霜球。消耗。', art: 'chill',
  },
  consume: {
    id: 'consume', name: '吞噬', nameEn: 'Consume', type: 'skill', rarity: 'uncommon', cost: 2, target: 'self', color: 'blue',
    values: [2], upValues: [3], desc: '获得 {0} 点集中。充能球上限降低 1 点。', upDesc: '获得 {0} 点集中。充能球上限降低 1 点。', art: 'consume',
  },
  darkness: {
    id: 'darkness', name: '黑暗', nameEn: 'Darkness', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none', color: 'blue',
    values: [1], upValues: [2], desc: '引导 {0} 个暗球。', upDesc: '引导 {0} 个暗球。', art: 'darkness',
  },
  defragment: {
    id: 'defragment', name: '碎片整理', nameEn: 'Defragment', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', color: 'blue',
    values: [1], upValues: [2], desc: '获得 {0} 点集中。', upDesc: '获得 {0} 点集中。', art: 'defragment',
  },
  doomAndGloom: {
    id: 'doomAndGloom', name: '末日降临', nameEn: 'Doom and Gloom', type: 'attack', rarity: 'uncommon', cost: 2, target: 'allEnemies', color: 'blue',
    values: [10, 1], upValues: [14, 1], desc: '对所有敌人造成 {0} 点伤害。引导 {1} 个暗球。', upDesc: '对所有敌人造成 {0} 点伤害。引导 {1} 个暗球。', art: 'doomAndGloom',
  },
  equilibrium: {
    id: 'equilibrium', name: '平衡', nameEn: 'Equilibrium', type: 'skill', rarity: 'uncommon', cost: 2, target: 'self', color: 'blue',
    values: [13], upValues: [16], desc: '获得 {0} 点格挡。保留本回合的手牌。', upDesc: '获得 {0} 点格挡。保留本回合的手牌。', art: 'equilibrium',
  },
  glacier: {
    id: 'glacier', name: '冰川', nameEn: 'Glacier', type: 'skill', rarity: 'uncommon', cost: 2, target: 'self', color: 'blue',
    values: [7, 2], upValues: [10, 3], desc: '获得 {0} 点格挡。引导 {1} 个霜球。', upDesc: '获得 {0} 点格挡。引导 {1} 个霜球。', art: 'glacier',
  },
  loopS: {
    id: 'loopS', name: '循环', nameEn: 'Loop', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', color: 'blue',
    values: [1], upValues: [2], desc: '在你的回合开始时，触发最右侧充能球的被动效果 {0} 次。', upDesc: '在你的回合开始时，触发最右侧充能球的被动效果 {0} 次。', art: 'loopS',
  },
  melter: {
    id: 'melter', name: '熔化者', nameEn: 'Melter', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', color: 'blue',
    values: [10], upValues: [13], desc: '造成 {0} 点伤害。移除敌人的格挡。', upDesc: '造成 {0} 点伤害。移除敌人的格挡。', art: 'melter',
  },
  overclock: {
    id: 'overclock', name: '超频', nameEn: 'Overclock', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none', color: 'blue',
    values: [2], upValues: [3], desc: '抽 {0} 张牌。将一张"灼伤"置入弃牌堆。', upDesc: '抽 {0} 张牌。将一张"灼伤"置入弃牌堆。', art: 'overclock',
  },
  skim: {
    id: 'skim', name: '略读', nameEn: 'Skim', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none', color: 'blue',
    values: [3], upValues: [4], desc: '抽 {0} 张牌。', upDesc: '抽 {0} 张牌。', art: 'skim',
  },
  staticDischargeS: {
    id: 'staticDischargeS', name: '静电释放', nameEn: 'Static Discharge', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', color: 'blue',
    values: [1], upValues: [2], desc: '每当你受到攻击伤害，引导 {0} 个闪电球。', upDesc: '每当你受到攻击伤害，引导 {0} 个闪电球。', art: 'staticDischargeS',
  },
  stormS: {
    id: 'stormS', name: '风暴', nameEn: 'Storm', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', color: 'blue',
    values: [1], upValues: [2], desc: '每当你打出一张能力牌，引导 {0} 个闪电球。', upDesc: '每当你打出一张能力牌，引导 {0} 个闪电球。', art: 'stormS',
  },
  tempest: {
    id: 'tempest', name: '暴风', nameEn: 'Tempest', type: 'skill', rarity: 'uncommon', cost: -1, target: 'none', exhaust: true, color: 'blue',
    values: [1], upValues: [1], desc: '消耗 X 点能量。引导 X(+1) 个闪电球。消耗。', upDesc: '消耗 X 点能量。引导 X+1 个闪电球。消耗。', art: 'tempest',
  },
  whiteNoise: {
    id: 'whiteNoise', name: '白噪声', nameEn: 'White Noise', type: 'skill', rarity: 'uncommon', cost: 1, upCost: 0, target: 'none', color: 'blue',
    values: [1], upValues: [1], desc: '将一张随机能力牌加入手牌，本回合其费用为 0。', upDesc: '将一张随机能力牌加入手牌，本回合其费用为 0。', art: 'whiteNoise',
  },
  // ---- 稀有 ----
  allForOne: {
    id: 'allForOne', name: '合而为一', nameEn: 'All for One', type: 'attack', rarity: 'rare', cost: 0, target: 'enemy', color: 'blue',
    values: [6], upValues: [10], desc: '造成 {0} 点伤害。将弃牌堆中所有 0 费牌返回手牌。', upDesc: '造成 {0} 点伤害。将弃牌堆中所有 0 费牌返回手牌。', art: 'allForOne',
  },
  amplifyS: {
    id: 'amplifyS', name: '扩增', nameEn: 'Amplify', type: 'skill', rarity: 'rare', cost: 1, target: 'none', color: 'blue',
    values: [1], upValues: [2], desc: '本回合你打出的下 {0} 张能力牌将被打出两次。', upDesc: '本回合你打出的下 {0} 张能力牌将被打出两次。', art: 'amplifyS',
  },
  chainLightning: {
    id: 'chainLightning', name: '连锁闪电', nameEn: 'Chain Lightning', type: 'attack', rarity: 'rare', cost: 1, target: 'enemy', color: 'blue',
    values: [7, 3], upValues: [9, 4], desc: '造成 {0} 点伤害，然后在敌人之间弹射，每弹射一次伤害提高 {1} 点。', upDesc: '造成 {0} 点伤害，然后在敌人之间弹射，每弹射一次伤害提高 {1} 点。', art: 'chainLightning',
  },
  coreSurge: {
    id: 'coreSurge', name: '核心涌动', nameEn: 'Core Surge', type: 'attack', rarity: 'rare', cost: 1, target: 'enemy', exhaust: true, color: 'blue',
    values: [11], upValues: [14], desc: '造成 {0} 点伤害。获得 1 层反制。消耗。', upDesc: '造成 {0} 点伤害。获得 1 层反制。消耗。', art: 'coreSurge',
  },
  creativeAI: {
    id: 'creativeAI', name: '创造AI', nameEn: 'Creative AI', type: 'power', rarity: 'rare', cost: 3, upCost: 2, target: 'self', color: 'blue',
    values: [1], upValues: [1], desc: '在你的回合开始时，将一张随机能力牌加入手牌。', upDesc: '在你的回合开始时，将一张随机能力牌加入手牌。', art: 'creativeAI',
  },
  echoForm: {
    id: 'echoForm', name: '回声形态', nameEn: 'Echo Form', type: 'power', rarity: 'rare', cost: 3, upCost: 2, target: 'self', color: 'blue',
    values: [1], upValues: [1], desc: '每回合你打出的第一张牌将被打出两次。', upDesc: '每回合你打出的第一张牌将被打出两次。', art: 'echoForm',
  },
  hyperbeam: {
    id: 'hyperbeam', name: '超光束', nameEn: 'Hyperbeam', type: 'attack', rarity: 'rare', cost: 2, target: 'allEnemies', color: 'blue',
    values: [26, 3], upValues: [34, 3], desc: '对所有敌人造成 {0} 点伤害。失去 {1} 点集中。', upDesc: '对所有敌人造成 {0} 点伤害。失去 {1} 点集中。', art: 'hyperbeam',
  },
  machineLearning: {
    id: 'machineLearning', name: '机器学习', nameEn: 'Machine Learning', type: 'power', rarity: 'rare', cost: 1, target: 'self', color: 'blue',
    values: [1], upValues: [2], desc: '在你的回合开始时，多抽 {0} 张牌。', upDesc: '在你的回合开始时，多抽 {0} 张牌。', art: 'machineLearning',
  },
  meteorStrike: {
    id: 'meteorStrike', name: '流星打击', nameEn: 'Meteor Strike', type: 'attack', rarity: 'rare', cost: 5, target: 'enemy', color: 'blue',
    values: [24, 3], upValues: [30, 3], desc: '造成 {0} 点伤害。引导 {1} 个等离子球。', upDesc: '造成 {0} 点伤害。引导 {1} 个等离子球。', art: 'meteorStrike',
  },
  multiCast: {
    id: 'multiCast', name: '多重施法', nameEn: 'Multi-Cast', type: 'skill', rarity: 'rare', cost: -1, target: 'none', color: 'blue',
    values: [1], upValues: [1], desc: '消耗 X 点能量。唤起你最右侧的充能球 X(+1) 次。', upDesc: '消耗 X 点能量。唤起你最右侧的充能球 X+1 次。', art: 'multiCast',
  },
  rainbow: {
    id: 'rainbow', name: '彩虹', nameEn: 'Rainbow', type: 'skill', rarity: 'rare', cost: 2, target: 'none', exhaust: true, color: 'blue',
    values: [1], upValues: [1], desc: '引导各 {0} 个闪电球、霜球、暗球和等离子球。消耗。', upDesc: '引导各 {0} 个闪电球、霜球、暗球和等离子球。消耗。', art: 'rainbow',
  },
  reboot: {
    id: 'reboot', name: '重启', nameEn: 'Reboot', type: 'skill', rarity: 'rare', cost: 0, target: 'none', exhaust: true, color: 'blue',
    values: [1], upValues: [2], desc: '将弃牌堆洗入抽牌堆。抽 {0} 张牌。消耗。', upDesc: '将弃牌堆洗入抽牌堆。抽 {0} 张牌。消耗。', art: 'reboot',
  },
  seek: {
    id: 'seek', name: '搜寻', nameEn: 'Seek', type: 'skill', rarity: 'rare', cost: 0, target: 'none', exhaust: true, color: 'blue',
    values: [2], upValues: [3], desc: '从抽牌堆中选择 {0} 张牌加入手牌。消耗。', upDesc: '从抽牌堆中选择 {0} 张牌加入手牌。消耗。', art: 'seek',
  },
  thunderStrike: {
    id: 'thunderStrike', name: '雷霆打击', nameEn: 'Thunder Strike', type: 'attack', rarity: 'rare', cost: 3, target: 'enemy', color: 'blue',
    values: [9], upValues: [11], desc: '本场战斗中你每引导过一个闪电球，便对随机敌人造成 {0} 点伤害。', upDesc: '本场战斗中你每引导过一个闪电球，便对随机敌人造成 {0} 点伤害。', art: 'thunderStrike',
  },
}

export const DEFECT_STARTER_DECK = (): string[] => [
  'strikeB', 'strikeB', 'strikeB', 'strikeB',
  'defendB', 'defendB', 'defendB', 'defendB',
  'zap', 'dualcast',
]
