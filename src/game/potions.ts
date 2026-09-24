// ============ 药水数据库 ============
import { PotionDef } from './types'

export const POTIONS: Record<string, PotionDef> = {
  firePotion: {
    id: 'firePotion', name: '火焰药水', nameEn: 'Fire Potion', rarity: 'common',
    desc: '对一名敌人造成 20 点伤害。', color: '#e25822', target: 'enemy',
  },
  blockPotion: {
    id: 'blockPotion', name: '格挡药水', nameEn: 'Block Potion', rarity: 'common',
    desc: '获得 12 点格挡。', color: '#c0c8d0', target: 'none',
  },
  strengthPotion: {
    id: 'strengthPotion', name: '力量药水', nameEn: 'Strength Potion', rarity: 'common',
    desc: '获得 2 点力量。', color: '#d43d2a', target: 'none',
  },
  dexterityPotion: {
    id: 'dexterityPotion', name: '敏捷药水', nameEn: 'Dexterity Potion', rarity: 'common',
    desc: '获得 2 点敏捷。', color: '#3aa0d4', target: 'none',
  },
  energyPotion: {
    id: 'energyPotion', name: '能量药水', nameEn: 'Energy Potion', rarity: 'common',
    desc: '获得 2 点能量。', color: '#f0c33c', target: 'none',
  },
  explosivePotion: {
    id: 'explosivePotion', name: '爆炸药水', nameEn: 'Explosive Potion', rarity: 'common',
    desc: '对所有敌人造成 10 点伤害。', color: '#e67e22', target: 'allEnemies',
  },
  fearPotion: {
    id: 'fearPotion', name: '恐惧药水', nameEn: 'Fear Potion', rarity: 'common',
    desc: '对一名敌人施加 3 层易伤。', color: '#8e44ad', target: 'enemy',
  },
  weakPotion: {
    id: 'weakPotion', name: '虚弱药水', nameEn: 'Weak Potion', rarity: 'common',
    desc: '对所有敌人施加 3 层虚弱。', color: '#27ae60', target: 'allEnemies',
  },
  swiftPotion: {
    id: 'swiftPotion', name: '迅捷药水', nameEn: 'Swift Potion', rarity: 'common',
    desc: '抽 3 张牌。', color: '#5dade2', target: 'none',
  },
  bloodPotion: {
    id: 'bloodPotion', name: '血液药水', nameEn: 'Blood Potion', rarity: 'uncommon',
    desc: '回复最大生命值 20% 的生命。', color: '#a93226', target: 'none',
  },
  fruitJuice: {
    id: 'fruitJuice', name: '果汁', nameEn: 'Fruit Juice', rarity: 'uncommon',
    desc: '你的最大生命值永久提高 5 点。', color: '#f5b041', target: 'none',
  },
  skillPotion: {
    id: 'skillPotion', name: '技能药水', nameEn: 'Skill Potion', rarity: 'uncommon',
    desc: '将一张随机技能牌（本回合费用为 0）加入手牌。', color: '#16a085', target: 'none',
  },
  fairyInBottle: {
    id: 'fairyInBottle', name: '瓶中仙女', nameEn: 'Fairy in a Bottle', rarity: 'rare',
    desc: '当你死亡时，可以喝下此药水代替死亡并回复 30% 最大生命值（自动触发）。', color: '#d4ac0d', target: 'none',
  },
  attackPotion: {
    id: 'attackPotion', name: '攻击药水', nameEn: 'Attack Potion', rarity: 'uncommon',
    desc: '将一张随机攻击牌（本回合费用为 0）加入手牌。', color: '#cb4335', target: 'none',
  },
}

export function potionPool(): string[] {
  return Object.keys(POTIONS)
}
