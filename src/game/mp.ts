// ============ 联机合作（仿杀戮尖塔2）：多人数据辅助 ============
// 设计：RunState 顶层的 hp/gold/deck/relics/potions 等个人字段是
// "当前活动玩家 (players[activeIdx])" 的镜像。引擎所有 (combat, run) 函数
// 无需改动即可作用于任意玩家 —— 只需在切换行动者时调用 setRunActive。
import { RunState, CombatState } from './types'

/** 镜像 → players[activeIdx]（把顶层个人字段的修改写回所属玩家） */
export function flushRunActive(run: RunState) {
  const p = run.players[run.activeIdx]
  if (!p) return
  p.hp = run.hp
  p.maxHp = run.maxHp
  p.gold = run.gold
  p.character = run.character
  p.deck = run.deck
  p.relics = run.relics
  p.potions = run.potions
  p.relicCounters = run.relicCounters
  p.goldEarned = run.goldEarned
}

/** players[activeIdx] → 镜像（切换行动者后载入其个人数据） */
export function syncRunActive(run: RunState) {
  const p = run.players[run.activeIdx]
  if (!p) return
  run.hp = p.hp
  run.maxHp = p.maxHp
  run.gold = p.gold
  run.character = p.character
  run.deck = p.deck
  run.relics = p.relics
  run.potions = p.potions
  run.relicCounters = p.relicCounters
  run.goldEarned = p.goldEarned
}

/** 切换活动玩家（先写回旧玩家数据，再载入新玩家数据） */
export function setRunActive(run: RunState, idx: number) {
  if (idx < 0 || idx >= run.players.length) return
  if (run.activeIdx === idx) return
  flushRunActive(run)
  run.activeIdx = idx
  syncRunActive(run)
}

export function isMpRun(run: RunState | null | undefined): boolean {
  return !!run && run.players.length > 1
}

/** 还存活的玩家索引列表（联机中死亡玩家跳过） */
export function alivePlayerIdxs(run: RunState): number[] {
  return run.players.map((p, i) => (p.hp > 0 && !p.dead ? i : -1)).filter(i => i >= 0)
}

/** 战斗中下一个应行动的玩家（本轮尚未行动且存活）；null = 全部已行动 */
export function nextActorIdx(combat: CombatState): number | null {
  const n = combat.players.length
  for (let k = 1; k <= n; k++) {
    const i = (combat.activeIdx + k) % n
    if (!combat.players[i].dead && !combat.acted[i]) return i
  }
  return null
}

/** 本轮第一个应行动的玩家 */
export function firstActorIdx(combat: CombatState): number {
  const n = combat.players.length
  for (let i = 0; i < n; i++) {
    if (!combat.players[i].dead) return i
  }
  return 0
}

/** 联机新开一局的构造在 run.ts 的 newMultiRun（避免循环依赖） */

/** 序列化快照前调用：保证 players[] 与镜像一致 */
export function consistentRun(run: RunState): RunState {
  flushRunActive(run)
  return run
}

/** 深拷贝工具（与 store 的 clone 等价，供 net 层使用） */
export function deepClone<T>(x: T): T {
  return structuredClone(x)
}
