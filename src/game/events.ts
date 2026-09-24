// ============ 第一幕事件 ============
import { EventDef } from './types'

export const EVENTS: Record<string, EventDef> = {
  bonfireSpirits: {
    id: 'bonfireSpirits', name: '篝火之灵', nameEn: 'Bonfire Spirits',
    desc: '你遇到一群围着篝火跳舞的紫色灵体。它们邀请你将一件物品投入火焰之中，以此作为祭品。火焰的光芒映照在你脸上，温暖而神秘。灵体们等待着你的决定。',
    choices: [
      { text: '[献祭] 移除一张牌', effect: 'sacrifice_remove' },
      { text: '[灵体] 升级一张牌', effect: 'spirits_upgrade' },
      { text: '[离开] 什么都不做', effect: 'leave' },
    ],
  },
  bigFish: {
    id: 'bigFish', name: '大鱼', nameEn: 'Big Fish',
    desc: '你遇到一个正在钓鱼的老人。他提出要送你一条他钓到的大鱼，或者是一个神秘的盒子。他咧嘴一笑，露出了参差不齐的牙齿。"选一个吧，旅行者。"',
    choices: [
      { text: '[香蕉] 回复最大生命值 1/3 的生命', effect: 'fish_banana' },
      { text: '[盒子] 获得一个随机遗物', effect: 'fish_box' },
      { text: '[离开] 继续前进', effect: 'leave' },
    ],
  },
  goldenWing: {
    id: 'goldenWing', name: '黄金之翼', nameEn: 'Golden Wing',
    desc: '你发现了一座古老的雕像，雕像的翅膀由纯金打造。当你靠近时，雕像的眼睛亮了起来。一个声音在你脑海中回响："献上你的武器，我将让它更加完美。"',
    choices: [
      { text: '[祈祷] 升级所有"打击"和"防御"牌', effect: 'golden_pray' },
      { text: '[离开] 保持敬畏，继续前进', effect: 'leave' },
    ],
  },
  deadAdventurer: {
    id: 'deadAdventurer', name: '死去的冒险者', nameEn: 'Dead Adventurer',
    desc: '你发现了一具冒险者的尸体。他的背包看起来鼓鼓囊囊的，但附近似乎有什么东西在蠕动……也许是什么东西杀死了他，还守在附近。',
    choices: [
      { text: '[搜刮] 获得金币（可能遭遇袭击）', effect: 'loot_gold' },
      { text: '[离开] 不冒险，继续前进', effect: 'leave' },
    ],
  },
  cleric: {
    id: 'cleric', name: '牧师', nameEn: 'Cleric',
    desc: '一位牧师坐在路边的祭坛前。他抬起头，露出慈祥的微笑。"我可以帮助你，旅行者。治疗……或者净化。当然，一切都需要代价。"',
    choices: [
      { text: '[治疗] 支付 35 金币，回复最大生命值 25% 的生命', effect: 'cleric_heal' },
      { text: '[净化] 支付 50 金币，移除一张牌', effect: 'cleric_purify' },
      { text: '[离开] 继续前进', effect: 'leave' },
    ],
  },
  livingWorkshop: {
    id: 'livingWorkshop', name: '活体工坊', nameEn: 'Living Workshop',
    desc: '你走进一个布满机械臂和铁砧的房间。房间中央的工作台发出嗡嗡声，机械臂向你伸出，似乎想要"改造"你的装备。',
    choices: [
      { text: '[升级] 随机升级一张牌', effect: 'workshop_upgrade' },
      { text: '[离开] 婉拒好意，继续前进', effect: 'leave' },
    ],
  },
}

export function eventPool(seen: string[]): string[] {
  return Object.keys(EVENTS).filter(id => !seen.includes(id))
}
