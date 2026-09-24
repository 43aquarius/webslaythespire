// ============ 铁甲战士卡牌 - 基础+普通卡 ============
import { CardDef } from './types'

// values 数组约定: [0]=主要数值 [1]=次数/次级数值 [2]=第三数值
export const CARDS_COMMON: Record<string, CardDef> = {
  strike: {
    id: 'strike', name: '打击', nameEn: 'Strike', type: 'attack', rarity: 'starter', cost: 1, target: 'enemy',
    values: [6], upValues: [9], desc: '造成 {0} 点伤害。', upDesc: '造成 {0} 点伤害。', art: 'slash',
  },
  defend: {
    id: 'defend', name: '防御', nameEn: 'Defend', type: 'skill', rarity: 'starter', cost: 1, target: 'self',
    values: [5], upValues: [8], desc: '获得 {0} 点格挡。', upDesc: '获得 {0} 点格挡。', art: 'shield',
  },
  bash: {
    id: 'bash', name: '痛击', nameEn: 'Bash', type: 'attack', rarity: 'starter', cost: 2, target: 'enemy',
    values: [8, 2], upValues: [10, 3], desc: '造成 {0} 点伤害，施加 {1} 层易伤。', upDesc: '造成 {0} 点伤害，施加 {1} 层易伤。', art: 'bash',
  },
  anger: {
    id: 'anger', name: '怒火', nameEn: 'Anger', type: 'attack', rarity: 'common', cost: 0, target: 'enemy',
    values: [6], upValues: [8], desc: '造成 {0} 点伤害。将一张此牌的副本置入弃牌堆。', upDesc: '造成 {0} 点伤害。将一张此牌的副本置入弃牌堆。', art: 'rage',
  },
  armaments: {
    id: 'armaments', name: '武装', nameEn: 'Armaments', type: 'skill', rarity: 'common', cost: 1, target: 'self',
    values: [5], upValues: [5], desc: '获得 {0} 点格挡。升级手牌中的一张牌。', upDesc: '获得 {0} 点格挡。升级手牌中的所有牌。', art: 'armor',
  },
  bodySlam: {
    id: 'bodySlam', name: '冲撞', nameEn: 'Body Slam', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', upCost: 0,
    values: [0], upValues: [0], desc: '造成等同于当前格挡值的伤害。', upDesc: '造成等同于当前格挡值的伤害。', art: 'bash',
  },
  clash: {
    id: 'clash', name: '冲突', nameEn: 'Clash', type: 'attack', rarity: 'common', cost: 0, target: 'enemy',
    values: [14], upValues: [18], desc: '只有当手牌中全是攻击牌时才能打出。造成 {0} 点伤害。', upDesc: '只有当手牌中全是攻击牌时才能打出。造成 {0} 点伤害。', art: 'cleave',
  },
  cleave: {
    id: 'cleave', name: '顺劈', nameEn: 'Cleave', type: 'attack', rarity: 'common', cost: 1, target: 'allEnemies',
    values: [8], upValues: [11], desc: '对所有敌人造成 {0} 点伤害。', upDesc: '对所有敌人造成 {0} 点伤害。', art: 'cleave',
  },
  clothesline: {
    id: 'clothesline', name: '锁喉', nameEn: 'Clothesline', type: 'attack', rarity: 'common', cost: 2, target: 'enemy', upCost: 1,
    values: [12, 2], upValues: [14, 3], desc: '造成 {0} 点伤害，施加 {1} 层虚弱。', upDesc: '造成 {0} 点伤害，施加 {1} 层虚弱。', art: 'bash',
  },
  flex: {
    id: 'flex', name: '屈伸', nameEn: 'Flex', type: 'skill', rarity: 'common', cost: 0, target: 'self',
    values: [2], upValues: [4], desc: '获得 {0} 点力量。回合结束时失去这些力量。', upDesc: '获得 {0} 点力量。回合结束时失去这些力量。', art: 'strength',
  },
  headbutt: {
    id: 'headbutt', name: '头槌', nameEn: 'Headbutt', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    values: [9], upValues: [12], desc: '造成 {0} 点伤害。将弃牌堆中的一张牌置于抽牌堆顶。', upDesc: '造成 {0} 点伤害。将弃牌堆中的一张牌置于抽牌堆顶。', art: 'bash',
  },
  ironWave: {
    id: 'ironWave', name: '铁波', nameEn: 'Iron Wave', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    values: [5, 5], upValues: [7, 7], desc: '造成 {0} 点伤害并获得 {1} 点格挡。', upDesc: '造成 {0} 点伤害并获得 {1} 点格挡。', art: 'cleave',
  },
  pommelStrike: {
    id: 'pommelStrike', name: '剑柄打击', nameEn: 'Pommel Strike', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    values: [9, 1], upValues: [10, 2], desc: '造成 {0} 点伤害。抽 {1} 张牌。', upDesc: '造成 {0} 点伤害。抽 {1} 张牌。', art: 'slash',
  },
  perfectedStrike: {
    id: 'perfectedStrike', name: '完美打击', nameEn: 'Perfected Strike', type: 'attack', rarity: 'common', cost: 2, target: 'enemy',
    values: [6, 2], upValues: [8, 3], desc: '造成 {0} 点伤害，你的牌组中每有一张"打击"牌，额外造成 {1} 点伤害。', upDesc: '造成 {0} 点伤害，你的牌组中每有一张"打击"牌，额外造成 {1} 点伤害。', art: 'slash',
  },
  searingBlow: {
    id: 'searingBlow', name: '灼热打击', nameEn: 'Searing Blow', type: 'attack', rarity: 'common', cost: 2, target: 'enemy',
    values: [12], upValues: [12], desc: '造成 {0} 点伤害。可以被无限次升级。', upDesc: '造成 {0} 点伤害。可以被无限次升级。', art: 'fire',
  },
  shrugItOff: {
    id: 'shrugItOff', name: '耸肩', nameEn: 'Shrug It Off', type: 'skill', rarity: 'common', cost: 1, target: 'self',
    values: [8], upValues: [11], desc: '获得 {0} 点格挡。抽 1 张牌。', upDesc: '获得 {0} 点格挡。抽 1 张牌。', art: 'shield',
  },
  spotWeakness: {
    id: 'spotWeakness', name: '找寻弱点', nameEn: 'Spot Weakness', type: 'skill', rarity: 'common', cost: 1, target: 'enemy',
    values: [2], upValues: [3], desc: '如果敌人意图攻击，获得 {0} 点力量。', upDesc: '如果敌人意图攻击，获得 {0} 点力量。', art: 'mind',
  },
  swordBoomerang: {
    id: 'swordBoomerang', name: '剑型回旋镖', nameEn: 'Sword Boomerang', type: 'attack', rarity: 'common', cost: 1, target: 'none',
    values: [3, 3], upValues: [3, 4], desc: '随机造成 {0} 点伤害，共 {1} 次。', upDesc: '随机造成 {0} 点伤害，共 {1} 次。', art: 'boomerang',
  },
  thunderclap: {
    id: 'thunderclap', name: '雷霆', nameEn: 'Thunderclap', type: 'attack', rarity: 'common', cost: 1, target: 'allEnemies',
    values: [4, 1], upValues: [7, 1], desc: '对所有敌人造成 {0} 点伤害并施加 {1} 层易伤。', upDesc: '对所有敌人造成 {0} 点伤害并施加 {1} 层易伤。', art: 'lightning',
  },
  trueGrit: {
    id: 'trueGrit', name: '坚毅', nameEn: 'True Grit', type: 'skill', rarity: 'common', cost: 1, target: 'self',
    values: [7], upValues: [9], desc: '获得 {0} 点格挡。随机消耗手牌中的一张牌。', upDesc: '获得 {0} 点格挡。消耗手牌中的一张牌（选择）。', art: 'shield',
  },
  twinStrike: {
    id: 'twinStrike', name: '双重打击', nameEn: 'Twin Strike', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    values: [5, 2], upValues: [7, 2], desc: '造成 {0} 点伤害，共 {1} 次。', upDesc: '造成 {0} 点伤害，共 {1} 次。', art: 'slash',
  },
  warcry: {
    id: 'warcry', name: '战吼', nameEn: 'Warcry', type: 'skill', rarity: 'common', cost: 0, target: 'none', exhaust: true,
    values: [1], upValues: [2], desc: '抽 {0} 张牌。将手牌中的一张牌置于抽牌堆顶。消耗。', upDesc: '抽 {0} 张牌。将手牌中的一张牌置于抽牌堆顶。消耗。', art: 'rage',
  },
  wildStrike: {
    id: 'wildStrike', name: '蛮力打击', nameEn: 'Wild Strike', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    values: [12], upValues: [17], desc: '造成 {0} 点伤害。将一张"创伤"洗入抽牌堆。', upDesc: '造成 {0} 点伤害。将一张"创伤"洗入抽牌堆。', art: 'wild',
  },
  heavyBlade: {
    id: 'heavyBlade', name: '巨剑', nameEn: 'Heavy Blade', type: 'attack', rarity: 'common', cost: 2, target: 'enemy',
    values: [14, 3], upValues: [14, 5], desc: '造成 {0} 点伤害。力量对该牌的影响变为 {1} 倍。', upDesc: '造成 {0} 点伤害。力量对该牌的影响变为 {1} 倍。', art: 'wild',
  },
  inflame: {
    id: 'inflame', name: '燃心', nameEn: 'Inflame', type: 'power', rarity: 'common', cost: 1, target: 'self',
    values: [2], upValues: [3], desc: '获得 {0} 点力量。', upDesc: '获得 {0} 点力量。', art: 'fire',
  },
}
