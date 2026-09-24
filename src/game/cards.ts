// ============ 卡牌数据库汇总 ============
import { CardDef, CardInstance, Rarity } from './types'
import { CARDS_COMMON } from './cards_common'
import { CARDS_RARE, STATUS_CARDS } from './cards_rare'

export const CARDS: Record<string, CardDef> = {
  ...CARDS_COMMON,
  ...CARDS_RARE,
  ...STATUS_CARDS,
}

export const IRONCLAD_STARTER_DECK = (): CardInstance[] => {
  const ids = ['strike', 'strike', 'strike', 'strike', 'strike',
    'defend', 'defend', 'defend', 'defend', 'bash']
  return ids.map((id, i) => ({ uid: `c${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`, id, upgraded: 0 }))
}

let uidCounter = 0
export function makeCard(id: string, upgraded = 0): CardInstance {
  uidCounter++
  return { uid: `u${uidCounter}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, id, upgraded }
}

export function cardDef(inst: CardInstance): CardDef {
  return CARDS[inst.id]
}

// 卡牌实际费用（考虑升级/血债血偿）
export function cardCost(inst: CardInstance, hpLost = 0): number {
  const def = CARDS[inst.id]
  if (!def) return 0
  if (def.cost === -99) return -99
  let cost = def.cost
  if (inst.upgraded > 0 && def.upCost !== undefined) cost = def.upCost
  if (inst.id === 'bloodForBlood') cost = Math.max(0, cost - hpLost)
  return cost
}

// 卡牌当前数值（含升级与特殊计算）
export function cardValues(inst: CardInstance, ctx?: { strikesInDeck?: number; hpLost?: number; rampageBonus?: number }): number[] {
  const def = CARDS[inst.id]
  if (!def) return []
  let base = inst.upgraded > 0 ? (def.upValues ?? def.values) : def.values
  if (!base) base = []
  const v = [...base]
  // 灼热打击: 12 + n(n+3)/2（n = 升级次数）
  if (inst.id === 'searingBlow' && inst.upgraded > 0) {
    const n = inst.upgraded
    v[0] = 12 + (n * (n + 3)) / 2
  }
  if (inst.id === 'rampage' && ctx?.rampageBonus) {
    v[0] = (v[0] || 8) + ctx.rampageBonus
  }
  return v
}

// 渲染用描述文本
export function cardDesc(inst: CardInstance, ctx?: { strikesInDeck?: number; hpLost?: number; rampageBonus?: number }): string {
  const def = CARDS[inst.id]
  if (!def) return ''
  let text = inst.upgraded > 0 ? def.upDesc : def.desc
  let vals = cardValues(inst, ctx)
  if (inst.id === 'perfectedStrike' && ctx?.strikesInDeck !== undefined) {
    vals = [vals[0] + vals[1] * ctx.strikesInDeck, vals[1]]
  }
  if (inst.id === 'bodySlam') {
    vals = [0]
  }
  text = text.replace(/\{(\d+)\}/g, (_, i) => String(vals[Number(i)] ?? 0))
  if (inst.id === 'bodySlam') text = text.replace('{0}', '')
  return text
}

// 卡池（用于奖励/商店）
export function poolByRarity(rarity: Rarity): string[] {
  return Object.values(CARDS).filter(c => c.rarity === rarity).map(c => c.id)
}

// 打击牌计数（完美打击）
export function countStrikes(deck: CardInstance[]): number {
  return deck.filter(c => {
    const def = CARDS[c.id]
    return def && (def.id === 'strike' || def.nameEn.includes('Strike'))
  }).length
}

export function isStatusCard(id: string): boolean {
  return !!STATUS_CARDS[id]
}
