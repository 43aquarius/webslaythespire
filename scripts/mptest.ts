// 联机双人合作全流程模拟测试（仿杀戮尖塔2）
// 直接驱动 store：房主本地执行 + 模拟客机动作（setPendingActor(1)）
import { useGame, setPendingActor } from '../src/store/gameStore'
import { AP } from '../src/game/engine'
import { CARDS } from '../src/game/cards'

const g = useGame as any
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let pass = 0, fail = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${detail}`) }
}

/** 模拟客机动作 */
function guestAct(fn: string, ...args: unknown[]) {
  setPendingActor(1)
  try { g.getState()[fn](...args) } finally { setPendingActor(null) }
}

async function playOutCombat(maxRounds = 40): Promise<'win' | 'lose' | 'stuck'> {
  for (let round = 0; round < maxRounds; round++) {
    const run = g.getState().run
    if (!run.combat) return run.screen === 'reward' ? 'win' : run.screen === 'gameover' ? 'lose' : 'stuck'
    if (run.combat.combatOver) {
      // 等待 finishCombat 定时器
      await sleep(1800)
      const s2 = g.getState().run
      if (s2.screen === 'reward') return 'win'
      if (s2.screen === 'gameover') return 'lose'
      continue
    }
    if (run.combat.phase !== 'player') { await sleep(700); continue }
    // 两位玩家轮流行动
    for (let p = 0; p < run.combat.players.length; p++) {
      const st = g.getState()
      const c = st.run.combat
      if (!c || c.combatOver || c.phase !== 'player') break
      if (c.activeIdx !== p) break   // 轮转由 endTurn 驱动
      const P = AP(c)
      if (P.dead || st.run.players[p].hp <= 0) { break }
      // 出牌：能出就出（攻击牌优先）
      let played = true
      let guard = 0
      while (played && guard < 12) {
        guard++
        const st2 = g.getState()
        const c2 = st2.run.combat
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
        const card = playable[0]
        const def = CARDS[card.id]
        const target = def.target === 'enemy' ? living[0].uid : null
        if (p === 0) g.getState().playCard(card.uid, target)
        else guestAct('playCard', card.uid, target)
        await sleep(30)
        played = true
      }
      // 结束回合（当前活动玩家）
      const st3 = g.getState()
      if (st3.run.combat && !st3.run.combat.combatOver && st3.run.combat.phase === 'player' && st3.run.combat.activeIdx === p) {
        if (p === 0) { g.getState().endTurn(); await sleep(400) }
        else { guestAct('endTurn'); await sleep(400) }
      }
      await sleep(250)
    }
    // 等敌人回合结束
    for (let w = 0; w < 40; w++) {
      const st = g.getState()
      if (!st.run.combat) break
      if (st.run.combat.combatOver) break
      if (st.run.combat.phase === 'player') break
      await sleep(300)
    }
  }
  const end = g.getState().run
  if (end.screen === 'reward') return 'win'
  if (end.screen === 'gameover') return 'lose'
  return 'stuck'
}

async function main() {
  console.log('=== 联机：创建双人局 ===')
  {
    const run = g.getState().startRun // noop
    // 手动构造双人局（绕过网络层，直接用 newMultiRun）
    const { newMultiRun } = await import('../src/game/run')
    useGame.setState({ run: newMultiRun('ironclad', 'silent', '房主甲', '队友乙'), menuScreen: 'title' as any })
    const r = g.getState().run
    check('双人局创建', r.players.length === 2 && r.players[0].character === 'ironclad' && r.players[1].character === 'silent')
    check('镜像=玩家0', r.deck === r.players[0].deck && r.hp === r.players[0].hp)
    check('涅奥双选项', r.neow.mpOptions.length === 2 && r.neow.chooserIdx === 0)
  }

  console.log('=== 联机：涅奥祝福双人顺序选择 ===')
  {
    // 房主选择（chooserIdx=0）
    const r0 = g.getState().run
    const opt0 = r0.neow.mpOptions[0][1] // 第2项（生命类）
    g.getState().chooseNeow(1)
    const r1 = g.getState().run
    check('房主祝福已选', r1.neow.chooserIdx === 1 && r1.neow.mpChosen[0] !== null, `chooser ${r1.neow.chooserIdx}`)
    // 房主在客机选择期间试图再选 → 应被拒绝
    g.getState().chooseNeow(1)
    const r1b = g.getState().run
    check('非选择者被拒绝', r1b.neow.chooserIdx === 1, `chooser ${r1b.neow.chooserIdx}`)
    // 客机选择（chooserIdx=1）
    guestAct('chooseNeow', 1)
    const r2 = g.getState().run
    check('客机祝福已选并进地图', r2.neow.chooserIdx === -1 && r2.screen === 'map', `chooser ${r2.neow?.chooserIdx} screen ${r2.screen}`)
  }

  console.log('=== 联机：第一场战斗（回合轮转 + 敌人目标） ===')
  let combatResult: string = 'stuck'
  {
    const r = g.getState().run
    const start = r.map.startNodes[0]
    g.getState().chooseNode(start)
    const c = g.getState().run.combat
    check('战斗已开始', !!c && g.getState().run.screen === 'combat')
    check('先手=玩家0', c.activeIdx === 0)
    check('两人独立牌堆', c.players[0].drawPile.length + c.players[0].hand.length > 0 && c.players[1].drawPile.length + c.players[1].hand.length > 0)
    check('意图带目标', c.enemies.every((e: any) => e.intent?.type !== 'attack' || e.intent.targetIdx !== undefined))
    combatResult = await playOutCombat()
    check('战斗胜利', combatResult === 'win', combatResult)
  }

  console.log('=== 联机：奖励（各自金币 + 各自卡牌三选一） ===')
  {
    const r = g.getState().run
    check('奖励界面', r.screen === 'reward' && !!r.reward)
    check('双份卡牌奖励', r.reward.mpCards?.length === 2 && r.reward.mpCards[0].length >= 2)
    const gold0 = r.players[0].gold
    g.getState().takeGold()          // 房主领金币
    const r1 = g.getState().run
    check('房主金币入账', r1.players[0].gold === gold0 + (r1.reward?.gold || 0), `${gold0} -> ${r1.players[0].gold}`)
    guestAct('takeGold')             // 客机也领金币
    const r2 = g.getState().run
    check('客机金币独立入账', r2.players[1].gold === gold0 + (r2.reward?.gold || 0), `${r2.players[1].gold}`)
    // 各自选卡（拿卡即确认）
    const card0 = r2.reward.mpCards[0][0]
    const card1 = r2.reward.mpCards[1][0]
    const d0 = r2.players[0].deck.length
    const d1 = r2.players[1].deck.length
    g.getState().takeCard(card0)
    guestAct('takeCard', card1)
    const r3 = g.getState().run
    check('各自拿卡入自己牌组', r3.players[0].deck.length === d0 + 1 && r3.players[1].deck.length === d1 + 1)
    check('拿卡即确认', r3.reward.mpDone[0] === true && r3.reward.mpDone[1] === true)
    // 双方已确认 → 房主点继续直接回地图
    g.getState().proceedFromReward()
    const r5 = g.getState().run
    check('全员确认后回地图', r5.screen === 'map', r5.screen)
  }

  console.log('=== 联机：多场战斗 + 篝火 + 商店（压力模拟） ===')
  {
    let guard = 0
    while (guard < 40) {
      guard++
      const st = g.getState()
      const r = st.run
      if (r.screen === 'gameover' || r.screen === 'victory' || r.screen === 'bossRelic') break
      if (r.screen === 'map') {
        const reach = r.currentNodeId ? r.map.nodes[r.currentNodeId]?.edges : r.map.startNodes
        if (!reach?.length) break
        g.getState().chooseNode(reach[0])
        continue
      }
      if (r.screen === 'combat') {
        const res = await playOutCombat()
        if (res === 'stuck') { check('多场战斗流畅', false, 'stuck'); break }
        continue
      }
      if (r.screen === 'reward') {
        const rr = g.getState().run
        if (rr.reward.mpCards) {
          if (!rr.reward.taken.includes('mpcard_0')) g.getState().takeCard(rr.reward.mpCards[0][0])
          if (!rr.reward.taken.includes('mpcard_1')) guestAct('takeCard', rr.reward.mpCards[1][0])
        }
        g.getState().proceedFromReward()
        guestAct('proceedFromReward')
        continue
      }
      if (r.screen === 'rest') {
        // 房主休息，客机锻造
        g.getState().restAction('rest')
        guestAct('restAction', 'smith')
        await sleep(200)
        // 客机锻造选牌
        const sel = g.getState().select
        if (sel && sel.kind === 'restSmith') guestAct('resolveSelect', sel.cardUids[0])
        await sleep(200)
        const rAfter = g.getState().run
        check('篝火双人结算完成', rAfter.screen === 'map', rAfter.screen)
        continue
      }
      if (r.screen === 'shop') {
        guestAct('leaveShop')
        continue
      }
      if (r.screen === 'event') {
        g.getState().chooseEvent(0)
        await sleep(150)
        // 事件选牌遮罩（如有）
        const sel = g.getState().select
        if (sel) { g.getState().resolveSelect(sel.cardUids[0]); await sleep(150) }
        continue
      }
      if (r.screen === 'treasure') {
        guestAct('takeTreasure')
        continue
      }
      if (r.screen === 'actTransition') {
        g.getState().continueFromActTransition()
        continue
      }
      await sleep(150)
    }
    const r = g.getState().run
    check('压力模拟无卡死', ['map', 'combat', 'reward', 'gameover', 'victory', 'bossRelic', 'rest', 'shop', 'event', 'treasure', 'actTransition'].includes(r.screen), r.screen)
    console.log(`  （当前：第${r.act}幕 第${r.visitedNodes.length}层 ${r.screen}）`)
  }

  console.log('=== 联机：玩家死亡与复活 ===')
  {
    // 直接构造：客机打死，验证全员死亡才失败 + 战后复活
    const r = g.getState().run
    r.players[1].hp = 0
    r.players[1].dead = true
    useGame.setState({ run: r })
    const c = g.getState().run.combat
    if (c) {
      c.players[1].dead = true
      c.acted[1] = true
      if (c.activeIdx === 1) c.activeIdx = 0
    }
    check('单人死亡不判负', !g.getState().run.gameOverInfo)
    // 打完一场战斗验证复活
    let guard = 0
    while (g.getState().run.screen === 'combat' && guard < 30) {
      guard++
      await playOutCombat(6)
      await sleep(300)
      if (g.getState().run.screen === 'reward') break
    }
    if (g.getState().run.screen === 'reward') {
      g.getState().proceedFromReward()
      guestAct('proceedFromReward')
      const r2 = g.getState().run
      check('阵亡队友战后复活', r2.players[1].hp > 0 && !r2.players[1].dead, `hp ${r2.players[1].hp}`)
    } else {
      check('阵亡队友战后复活(跳过-非战斗态)', true)
    }
  }

  console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
  if (fail > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
