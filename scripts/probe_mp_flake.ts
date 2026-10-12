// mptest 竞态插桩探针：复现"客机金币独立入账"与"阵亡队友战后复活"偶发失败
// 复刻 mptest 前段流程，在关键点打印完整金币/镜像状态，循环运行直至捕获失败
import { useGame, setPendingActor } from '../src/store/gameStore'
import { AP } from '../src/game/engine'
import { CARDS } from '../src/game/cards'

const g = useGame as any
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
function guestAct(fn: string, ...args: unknown[]) {
  setPendingActor(1)
  try { g.getState()[fn](...args) } finally { setPendingActor(null) }
}
function snap(label: string) {
  const r = g.getState().run
  if (!r) { console.log(`${label}: no-run`); return }
  console.log(`${label} | screen=${r.screen} activeIdx=${r.activeIdx} mirror.gold=${r.gold} p0=${r.players[0]?.gold} p1=${r.players[1]?.gold} reward.gold=${r.reward?.gold} taken=[${r.reward?.taken?.join(',')}] banner=${g.getState().endBanner ? 1 : 0}`)
}

async function playOutCombat(maxRounds = 40): Promise<string> {
  for (let round = 0; round < maxRounds; round++) {
    const run = g.getState().run
    if (!run.combat) return run.screen === 'reward' ? 'win' : run.screen === 'gameover' ? 'lose' : 'stuck'
    if (run.combat.combatOver) {
      await sleep(1800)
      const s2 = g.getState().run
      if (s2.screen === 'reward') return 'win'
      if (s2.screen === 'gameover') return 'lose'
      continue
    }
    if (run.combat.phase !== 'player') { await sleep(700); continue }
    for (let p = 0; p < run.combat.players.length; p++) {
      const st = g.getState()
      const c = st.run.combat
      if (!c || c.combatOver || c.phase !== 'player') break
      if (c.activeIdx !== p) break
      const P = AP(c)
      if (P.dead || st.run.players[p].hp <= 0) { break }
      let guard = 0
      while (guard < 12) {
        guard++
        const c2 = g.getState().run.combat
        if (!c2 || c2.combatOver || c2.phase !== 'player' || c2.activeIdx !== p) break
        const P2 = AP(c2)
        const living = c2.enemies.filter((e: any) => !e.dying && e.hp > 0)
        if (!living.length) break
        const playable = P2.hand.filter((card: any) => {
          const def = CARDS[card.id]
          if (!def) return false
          const cost = def.cost === -1 ? 0 : def.cost
          return cost <= P2.energy && !def.unplayable && def.cost !== -99
        })
        if (!playable.length) break
        const def = CARDS[playable[0].id]
        const target = def.target === 'enemy' ? living[0].uid : null
        if (p === 0) g.getState().playCard(playable[0].uid, target)
        else guestAct('playCard', playable[0].uid, target)
        await sleep(30)
      }
      const st3 = g.getState()
      if (st3.run.combat && !st3.run.combat.combatOver && st3.run.combat.phase === 'player' && st3.run.combat.activeIdx === p) {
        if (p === 0) { g.getState().endTurn(); await sleep(400) }
        else { guestAct('endTurn'); await sleep(400) }
      }
      await sleep(250)
    }
    for (let w = 0; w < 40; w++) {
      const st = g.getState()
      if (!st.run.combat) break
      if (st.run.combat.combatOver) break
      if (st.run.combat.phase === 'player') break
      await sleep(300)
    }
  }
  const end = g.getState().run
  return end.screen === 'reward' ? 'win' : end.screen === 'gameover' ? 'lose' : 'stuck'
}

async function oneRound(attempt: number): Promise<boolean> {
  console.log(`\n########## 第 ${attempt} 轮 ##########`)
  const { newMultiRun } = await import('../src/game/run')
  useGame.setState({ run: newMultiRun('ironclad', 'silent', '房主甲', '队友乙'), menuScreen: 'title' as any })
  // 涅奥双人选择
  g.getState().chooseNeow(1)
  guestAct('chooseNeow', 1)
  const r0 = g.getState().run
  if (r0.screen !== 'map') { console.log('!! 涅奥后未进地图, 跳过本轮'); return true }
  // 第一场战斗
  const r = g.getState().run
  g.getState().chooseNode(r.map.startNodes[0])
  const combatType = g.getState().run.combat ? 'combat' : `screen=${g.getState().run.screen}`
  if (combatType !== 'combat') { console.log(`!! 起始节点非战斗(${combatType}), 跳过本轮`); return true }
  const res = await playOutCombat()
  console.log(`战斗结果: ${res}`)
  if (res !== 'win') return true
  snap('战后')
  // 金币流程（复刻 mptest 137-148）
  const rr = g.getState().run
  const gold0 = rr.players[0].gold
  const guestGold0 = rr.players[1].gold   // 双方基数可能不同（涅奥祝福随机）
  const rewardGold = rr.reward?.gold
  console.log(`gold0(房主)=${gold0} guestGold0=${guestGold0} rewardGold=${rewardGold}`)
  g.getState().takeGold()
  snap('房主takeGold后')
  guestAct('takeGold')
  snap('客机takeGold后')
  const r2 = g.getState().run
  const expect = guestGold0 + (r2.reward?.gold || 0)
  const actual = r2.players[1].gold
  const ok = actual === expect
  console.log(`断言: 客机金币 expected=${expect} actual=${actual} => ${ok ? 'PASS' : '**FAIL**'}`)
  if (!ok) {
    console.log('==== 捕获金币竞态! 保留状态 3 秒观察后续变化 ====')
    for (let i = 0; i < 6; i++) { await sleep(500); snap(`后观察${i}`) }
    return false
  }
  // 复活流程（复刻 mptest 234-263）
  const r3 = g.getState().run
  r3.players[1].hp = 0
  r3.players[1].dead = true
  useGame.setState({ run: r3 })
  const c = g.getState().run.combat
  if (c) {
    c.players[1].dead = true
    c.acted[1] = true
    if (c.activeIdx === 1) c.activeIdx = 0
    useGame.setState({ run: g.getState().run })
  }
  let guard = 0
  const enteredCombat = g.getState().run.screen === 'combat'
  while (g.getState().run.screen === 'combat' && guard < 30) {
    guard++
    await playOutCombat(6)
    await sleep(300)
    if (g.getState().run.screen === 'reward') break
  }
  const screenNow = g.getState().run.screen
  console.log(`复活段: enteredCombat=${enteredCombat} screen=${screenNow}`)
  if (enteredCombat && screenNow === 'reward') {
    g.getState().proceedFromReward()
    guestAct('proceedFromReward')
    await sleep(0)
    const r4 = g.getState().run
    const reviveOk = r4.players[1].hp > 0 && !r4.players[1].dead
    console.log(`断言: 复活 hp=${r4.players[1].hp} dead=${r4.players[1].dead} => ${reviveOk ? 'PASS' : '**FAIL**'}`)
    if (!reviveOk) {
      snap('复活失败时')
      for (let i = 0; i < 6; i++) { await sleep(500); snap(`复活后观察${i}`) }
      return false
    }
  }
  return true
}

async function main() {
  const N = Number(process.argv[2] || 8)
  for (let i = 1; i <= N; i++) {
    const cont = await oneRound(i)
    if (!cont) { console.log(`\n>>>>>> 第 ${i} 轮捕获失败，停止`); process.exit(1) }
  }
  console.log(`\n>>>>>> ${N} 轮全部通过（未复现）`)
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(2) })
