// ============ 遗物数据库 ============
import { RelicDef } from './types'

export const RELICS: Record<string, RelicDef> = {
  // 初始遗物
  burningBlood: {
    id: 'burningBlood', name: '燃烧之血', nameEn: 'Burning Blood', rarity: 'starter',
    desc: '在战斗结束时回复 6 点生命值。', icon: '🩸', color: '#8b2020',
  },
  // 普通
  vajra: {
    id: 'vajra', name: '金刚杵', nameEn: 'Vajra', rarity: 'common',
    desc: '战斗开始时，获得 1 点力量。', icon: '🔱', color: '#7a5c2e',
  },
  anchor: {
    id: 'anchor', name: '船锚', nameEn: 'Anchor', rarity: 'common',
    desc: '每场战斗的第 1 回合，获得 10 点格挡。', icon: '⚓', color: '#4a5d6e',
  },
  bagOfMarbles: {
    id: 'bagOfMarbles', name: '弹珠袋', nameEn: 'Bag of Marbles', rarity: 'common',
    desc: '战斗开始时，对所有敌人施加 1 层易伤。', icon: '⚪', color: '#5a4a6e',
  },
  lantern: {
    id: 'lantern', name: '灯笼', nameEn: 'Lantern', rarity: 'common',
    desc: '每场战斗的第 1 回合，获得 1 点额外能量。', icon: '🏮', color: '#8a6a2e',
  },
  bagOfPreparation: {
    id: 'bagOfPreparation', name: '备战背包', nameEn: 'Bag of Preparation', rarity: 'common',
    desc: '每场战斗的第 1 回合，多抽 2 张牌。', icon: '🎒', color: '#4a5a3e',
  },
  bronzeScales: {
    id: 'bronzeScales', name: '青铜鳞片', nameEn: 'Bronze Scales', rarity: 'common',
    desc: '战斗开始时，获得 3 点尖刺。', icon: '🐍', color: '#6e5a2e',
  },
  centennialPuzzle: {
    id: 'centennialPuzzle', name: '世纪魔方', nameEn: 'Centennial Puzzle', rarity: 'common',
    desc: '每场战斗中，你第一次因攻击失去生命时，抽 1 张牌。', icon: '🧊', color: '#3e5a6e',
  },
  warPaint: {
    id: 'warPaint', name: '战旗涂料', nameEn: 'War Paint', rarity: 'common',
    desc: '获得时，随机升级 2 张技能牌。', icon: '🖌️', color: '#6e4a3e',
  },
  whetstone: {
    id: 'whetstone', name: '磨刀石', nameEn: 'Whetstone', rarity: 'common',
    desc: '获得时，随机升级 2 张攻击牌。', icon: '🪨', color: '#5a5a5a',
  },
  smoothlyStone: {
    id: 'smoothlyStone', name: '奇滑之石', nameEn: 'Oddly Smooth Stone', rarity: 'common',
    desc: '战斗开始时，获得 1 点敏捷。', icon: '💎', color: '#3e6e6a',
  },
  preservedInsect: {
    id: 'preservedInsect', name: '防腐昆虫', nameEn: 'Preserved Insect', rarity: 'common',
    desc: '精英怪以 75% 的生命值开始战斗。', icon: '🦗', color: '#4a6e3e',
  },
  goldenIdol: {
    id: 'goldenIdol', name: '黄金神像', nameEn: 'Golden Idol', rarity: 'common',
    desc: '获得 25% 更多的金币。', icon: '🗿', color: '#8a7a2e',
  },
  meatOnTheBone: {
    id: 'meatOnTheBone', name: '带肉的骨头', nameEn: 'Meat on the Bone', rarity: 'common',
    desc: '若在战斗结束时生命值低于 50%，回复 12 点生命值。', icon: '🍖', color: '#7a5a4a',
  },
  // 罕见
  bloodVial: {
    id: 'bloodVial', name: '血瓶', nameEn: 'Blood Vial', rarity: 'uncommon',
    desc: '战斗开始时，回复 2 点生命值。', icon: '🧪', color: '#8b2020',
  },
  kunai: {
    id: 'kunai', name: '苦无', nameEn: 'Kunai', rarity: 'uncommon',
    desc: '每回合内每打出 3 张攻击牌，获得 1 点敏捷。', icon: '🗡️', color: '#4a4a6e',
  },
  shuriken: {
    id: 'shuriken', name: '手里剑', nameEn: 'Shuriken', rarity: 'uncommon',
    desc: '每回合内每打出 3 张攻击牌，获得 1 点力量。', icon: '✴️', color: '#5a5a6e',
  },
  ornamentalFan: {
    id: 'ornamentalFan', name: '装饰扇', nameEn: 'Ornamental Fan', rarity: 'uncommon',
    desc: '每回合内每打出 3 张攻击牌，获得 4 点格挡。', icon: '🪭', color: '#6e4a5a',
  },
  penNib: {
    id: 'penNib', name: '钢笔笔尖', nameEn: 'Pen Nib', rarity: 'uncommon',
    desc: '每打出 10 张攻击牌，下一张攻击牌造成双倍伤害。', icon: '🖊️', color: '#3e3e4e',
  },
  sundial: {
    id: 'sundial', name: '日晷', nameEn: 'Sundial', rarity: 'uncommon',
    desc: '每洗牌 3 次，获得 2 点能量。', icon: '🕰️', color: '#6e6a3e',
  },
  // Boss 遗物
  ectoplasm: {
    id: 'ectoplasm', name: '灵外质', nameEn: 'Ectoplasm', rarity: 'boss',
    desc: '获得 1 点额外能量。无法再获得金币。', icon: '👻', color: '#4e5a3e',
  },
  sozu: {
    id: 'sozu', name: '苏珠', nameEn: 'Sozu', rarity: 'boss',
    desc: '获得 1 点额外能量。无法再获得药水。', icon: '🍶', color: '#7a3e3e',
  },
  velvetChoker: {
    id: 'velvetChoker', name: '天鹅绒项圈', nameEn: 'Velvet Choker', rarity: 'boss',
    desc: '获得 1 点额外能量。每回合最多打出 6 张牌。', icon: '🎀', color: '#6e3e5a',
  },
  philosophersStone: {
    id: 'philosophersStone', name: '贤者之石', nameEn: "Philosopher's Stone", rarity: 'boss',
    desc: '获得 1 点额外能量。敌人在战斗开始时获得 1 点力量。', icon: '🔮', color: '#5a3e6e',
  },
  coffeeDripper: {
    id: 'coffeeDripper', name: '咖啡滴滤壶', nameEn: 'Coffee Dripper', rarity: 'boss',
    desc: '获得 1 点额外能量。无法再在篝火休息。', icon: '☕', color: '#6e4e3e',
  },
  bustedCrown: {
    id: 'bustedCrown', name: '破损王冠', nameEn: 'Busted Crown', rarity: 'boss',
    desc: '获得 1 点额外能量。卡牌奖励减少一个选项。', icon: '👑', color: '#8a7a2e',
  },
}

// 战斗开始时生效的遗物集合
export const COMBAT_START_RELATED = ['vajra', 'anchor', 'bagOfMarbles', 'lantern', 'bagOfPreparation', 'bronzeScales', 'bloodVial', 'smoothlyStone', 'philosophersStone', 'preservedInsect']

export function shopRelicPool(): string[] {
  return Object.values(RELICS).filter(r => r.rarity === 'common' || r.rarity === 'uncommon').map(r => r.id)
}

export function bossRelicPool(): string[] {
  return Object.values(RELICS).filter(r => r.rarity === 'boss').map(r => r.id)
}

export function randomRelicPool(): string[] {
  return Object.values(RELICS).filter(r => r.rarity === 'common' || r.rarity === 'uncommon').map(r => r.id)
}
