#!/usr/bin/env python3
# 修复 TS 窄化问题：AP(combat) 函数调用后无法窄化 optional 字段
import re

P = '/home/z/my-project/src/game/engine.ts'
src = open(P).read()

# 模式1: AP(combat).customFlags = AP(combat).customFlags || {} 后续行 AP(combat).customFlags.X = ...
# 替换为局部变量 cf
def fix_customflags(m):
    indent = m.group(1)
    return f"{indent}const cf = AP(combat).customFlags = AP(combat).customFlags || {{}}"

src = re.sub(r'( *)AP\(combat\)\.customFlags = AP\(combat\)\.customFlags \|\| \{\}', fix_customflags, src)
# 后续对 AP(combat).customFlags. 的引用改为 cf.（仅在同一 case 块内几行，全局替换安全：剩余的这种链式引用都是跟在上面生成的行后）
src = src.replace('AP(combat).customFlags.gingerImmune', 'cf.gingerImmune')
src = src.replace('AP(combat).customFlags.turnipImmune', 'cf.turnipImmune')
src = src.replace('AP(combat).customFlags.puzzleUsed = 1', 'cf.puzzleUsed = 1')
src = re.sub(r'AP\(combat\)\.customFlags\.pendingNightmareSelect', 'cf.pendingNightmareSelect', src)
src = re.sub(r'AP\(combat\)\.customFlags\.pendingHologram', 'cf.pendingHologram', src)
src = re.sub(r'AP\(combat\)\.customFlags\.pendingSeek', 'cf.pendingSeek', src)
src = re.sub(r'AP\(combat\)\.customFlags\.pendingOmniscience', 'cf.pendingOmniscience', src)

# 模式2: channelOrb 整体重写为局部 P
src = src.replace('''export function channelOrb(combat: CombatState, run: RunState, type: OrbType) {
  AP(combat).orbs = AP(combat).orbs || []
  AP(combat).orbSlots = AP(combat).orbSlots ?? 3
  // 超出上限：唤起最旧（最左）的球
  while (AP(combat).orbs.length >= AP(combat).orbSlots) {
    const old = AP(combat).orbs.shift()!
    evokeOrbEffect(combat, run, old)
  }
  AP(combat).orbs.push({ type, damage: type === 'dark' ? 6 : undefined })
  AP(combat).channeledThisCombat = (AP(combat).channeledThisCombat || 0) + 1
  if (type === 'lightning') AP(combat).lightningChanneled = (AP(combat).lightningChanneled || 0) + 1
  fx(combat, 'orb', 'player', undefined, type)
}''', '''export function channelOrb(combat: CombatState, run: RunState, type: OrbType) {
  const P = AP(combat)
  P.orbs = P.orbs || []
  P.orbSlots = P.orbSlots ?? 3
  // 超出上限：唤起最旧（最左）的球
  while (P.orbs.length >= P.orbSlots) {
    const old = P.orbs.shift()!
    evokeOrbEffect(combat, run, old)
  }
  P.orbs.push({ type, damage: type === 'dark' ? 6 : undefined })
  P.channeledThisCombat = (P.channeledThisCombat || 0) + 1
  if (type === 'lightning') P.lightningChanneled = (P.lightningChanneled || 0) + 1
  fx(combat, 'orb', 'player', undefined, type)
}''')

# 模式3: gainMantra
src = src.replace('''  AP(combat).mantra = (AP(combat).mantra || 0) + n
  if (AP(combat).mantra >= 10) {
    AP(combat).mantra -= 10
    enterStance(combat, run, 'divinity')
  }''', '''  const P = AP(combat)
  P.mantra = (P.mantra || 0) + n
  if (P.mantra >= 10) {
    P.mantra -= 10
    enterStance(combat, run, 'divinity')
  }''')

# 模式4: beginScry
src = src.replace('''export function beginScry(combat: CombatState, n: number) {
  if (n <= 0 || AP(combat).drawPile.length === 0) return
  AP(combat).pendingScry = Math.min(n, AP(combat).drawPile.length)
  AP(combat).scryDiscarded = []
  // 涅槃：每预见一张牌获得格挡
  if (AP(combat).statuses.nirvanaS) {
    playerGainBlock(combat, run_ref, AP(combat).statuses.nirvanaS * AP(combat).pendingScry)
  }
}''', '''export function beginScry(combat: CombatState, n: number) {
  const P = AP(combat)
  if (n <= 0 || P.drawPile.length === 0) return
  P.pendingScry = Math.min(n, P.drawPile.length)
  P.scryDiscarded = []
  // 涅槃：每预见一张牌获得格挡
  if (P.statuses.nirvanaS) {
    playerGainBlock(combat, run_ref, P.statuses.nirvanaS * P.pendingScry!)
  }
}''')

# 模式5: rampage / glassKnife
src = src.replace('''      AP(combat).rampage = AP(combat).rampage || {}
      AP(combat).rampage[uid] = (AP(combat).rampage[uid] || 0) + v[1]''', '''      const R = AP(combat).rampage = AP(combat).rampage || {}
      R[uid] = (R[uid] || 0) + v[1]''')
src = src.replace('''      AP(combat).glassKnife = AP(combat).glassKnife || {}
      AP(combat).glassKnife[uid] = (AP(combat).glassKnife[uid] || 0) + v[1]''', '''      const GK = AP(combat).glassKnife = AP(combat).glassKnife || {}
      GK[uid] = (GK[uid] || 0) + v[1]''')

# 模式6: pendingNightmare 非空断言
src = src.replace('''  if (AP(combat).pendingNightmare) {
    const nm = AP(combat).pendingNightmare
    for (let i = 0; i < nm.count; i++) AP(combat).hand.push(makeCard(nm.cardId, nm.upgraded))''', '''  if (AP(combat).pendingNightmare) {
    const nm = AP(combat).pendingNightmare!
    for (let i = 0; i < nm.count; i++) AP(combat).hand.push(makeCard(nm.cardId, nm.upgraded))''')

open(P, 'w').write(src)
print('done')
