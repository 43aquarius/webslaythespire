// 全流程自动化测试：从新开局打到Boss（通过 store 钩子驱动）
// 用法: bun run scripts/fulltest.ts [url]
import { execFileSync } from 'child_process'

const URL = process.argv[2] || 'http://localhost:3000/'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function ev(code: string): string {
  try {
    const out = execFileSync('agent-browser', ['eval', code, '--json'], { encoding: 'utf-8', timeout: 60000 })
    const j = JSON.parse(out)
    return j?.data?.result ?? j?.data ?? ''
  } catch (e: any) {
    return 'ERR:' + (e.stdout || e.message || '').slice(0, 200)
  }
}
function evJson(code: string): any {
  const r = ev(code)
  try { return JSON.parse(r) } catch { return { scr: 'PARSE_ERR', raw: String(r).slice(0, 300) } }
}

async function main() {
  console.log('== 打开页面 ==')
  execFileSync('agent-browser', ['open', URL], { encoding: 'utf-8', timeout: 60000 })
  await sleep(3000)
  if (!ev('typeof window.__sts').includes('function')) {
    console.log('!! __sts 未就绪，等待...')
    await sleep(4000)
  }

  ev(`window.__sts.getState().startRun('${process.argv[3] || 'ironclad'}')`)
  await sleep(500)

  let step = 0
  const MAX_STEPS = 500
  const log: string[] = []
  let lastAction = ''

  while (step++ < MAX_STEPS) {
    const s = evJson(`(() => {
      const g = window.__sts.getState()
      const r = g.run
      if (!r) return JSON.stringify({ scr: g.screen })
      return JSON.stringify({
        scr: r.screen, busy: g.busy, hp: r.hp, gold: r.gold, floor: r.visitedNodes.length,
        combat: r.combat ? {
          phase: r.combat.phase, over: r.combat.combatOver, won: r.combat.playerWon,
          enemies: r.combat.enemies.map(e => e.id + ':' + e.hp + '/' + e.maxHp + (e.dying ? 'D' : '')).join(','),
          hand: r.combat.hand.length, energy: r.combat.player.energy, turn: r.combat.turn,
        } : null,
        select: g.select ? g.select.kind : null, banner: g.endBanner,
      })
    })()`)

    if (s.scr === 'PARSE_ERR') { console.log('状态解析失败:', s.raw); break }
    if (s.scr === 'gameover' || s.scr === 'victory') {
      console.log(`\n== 到达终局: ${s.scr} ==`)
      log.push(`END:${s.scr}`)
      break
    }

    if (s.banner) { await sleep(700); continue }

    // 卡死检测：同界面同状态停留过久
    const sig = JSON.stringify(s)
    if (sig === lastAction) { /* 同状态重复出现是允许的（等待动画），超过一定次数会由 MAX_STEPS 兜底 */ }
    lastAction = sig

    if (s.scr === 'neow') {
      // 涅奥祝福：选第一项（通常是最大生命/金币类）
      ev(`window.__sts.getState().chooseNeow(0)`)
      log.push('NEOW')
      await sleep(800)
      continue
    }

    if (s.scr === 'map') {
      const acted = ev(`(() => {
        const g = window.__sts.getState(), r = g.run
        const reach = r.currentNodeId ? r.map.nodes[r.currentNodeId].edges : r.map.startNodes
        const pickByType = (types) => {
          for (const t of types) {
            const n = reach.map(id => r.map.nodes[id]).find(n => n.type === t)
            if (n) { g.chooseNode(n.id); return n.type }
          }
          return null
        }
        const floor = r.visitedNodes.length
        let picked
        if (floor < 3) picked = pickByType(['monster', 'event', 'elite', 'treasure', 'shop', 'rest', 'boss'])
        else picked = pickByType(['treasure', 'shop', 'rest', 'event', 'monster', 'elite', 'boss'])
        return picked || 'STUCK'
      })()`)
      if (acted === 'STUCK') { console.log('!! 地图无路可走'); break }
      log.push(`F${s.floor}:${acted}`)
      await sleep(700)
      continue
    }

    if (s.scr === 'combat' && s.combat) {
      const c = s.combat
      if (s.busy || c.over || c.phase !== 'player') { await sleep(500); continue }
      const played = ev(`(() => {
        const g = window.__sts.getState(), r = g.run, c = r.combat
        const living = c.enemies.filter(e => !e.dying && e.hp > 0)
        if (!living.length) return 'WAIT'
        const weakest = [...living].sort((a, b) => a.hp - b.hp)[0]
        const H = window.__sts_helpers
        if (!H) { 
          window.__sts_helpers = {
            def: (id) => window.__STS_CARDS[id],
            cost: (ci) => window.__STS_COST(ci, c.player.hpLostThisCombat),
          }
          return 'HELPERS'
        }
        const energy = c.player.energy
        const hand = [...c.hand]
        const cost = (ci) => { const k = H.cost(ci); return k === -1 ? energy : Math.max(0, k) }
        const attacks = hand.filter(ci => H.def(ci.id).type === 'attack' && cost(ci) <= energy)
        const powers = hand.filter(ci => H.def(ci.id).type === 'power' && cost(ci) <= energy)
        const blocks = hand.filter(ci => ['defend', 'shrugItOff', 'impervious', 'ghostlyArmor'].includes(ci.id) && cost(ci) <= energy)
        if (attacks.length) { g.playCard(attacks[0].uid, weakest.uid); return 'P' }
        if (powers.length) { g.playCard(powers[0].uid, null); return 'P' }
        if (blocks.length && energy >= 1) { g.playCard(blocks[0].uid, null); return 'P' }
        return 'END'
      })()`)
      if (played === 'HELPERS') continue
      if (played === 'END') {
        ev('window.__sts.getState().endTurn()')
        await sleep(400)
        log.push(`t${c.turn}:end`)
        // 等待敌方回合结束
        let waited = 0
        while (waited++ < 20) {
          await sleep(500)
          const st = evJson(`(() => { const g = window.__sts.getState(); return JSON.stringify({ busy: g.busy, ph: g.run?.combat?.phase, over: g.run?.combat?.combatOver, scr: g.run?.screen }) })()`)
          if (!st.busy || st.over || (st.scr && st.scr !== 'combat')) break
        }
        continue
      }
      if (played === 'WAIT') { await sleep(500); continue }
      // 出牌后处理选牌弹窗
      await sleep(150)
      const sel = ev(`(() => {
        const g = window.__sts.getState()
        if (g.select) { const u = g.select.cardUids[0]; if (u) { g.resolveSelect(u); return 'resolved' } g.cancelSelect(); return 'cancelled' }
        return 'none'
      })()`)
      if (sel !== 'none') { log.push('sel:' + sel); await sleep(200) }
      continue
    }

    if (s.scr === 'reward') {
      ev(`(() => {
        const g = window.__sts.getState(), r = g.run
        g.takeGold()
        if (r.reward?.relic) g.takeRelic()
        if (r.reward?.potion) g.takePotion()
        if (r.reward?.cards?.length) g.takeCard(r.reward.cards[0])
        g.proceedFromReward()
      })()`)
      log.push('reward')
      await sleep(400)
      continue
    }

    if (s.scr === 'shop') {
      ev(`(() => {
        const g = window.__sts.getState(), r = g.run
        const cards = r.shop.cards.map((c, i) => ({ i, p: c.price })).filter(c => c.p <= r.gold && !r.shop.cards[c.i].sold)
        cards.sort((a, b) => a.p - b.p)
        if (cards.length) g.buyCard(cards[0].i)
        const relics = r.shop.relics.map((c, i) => ({ i, p: c.price })).filter(c => c.p <= r.gold && !r.shop.relics[c.i].sold)
        if (relics.length) g.buyRelic(relics[0].i)
        g.leaveShop()
      })()`)
      log.push('shop')
      await sleep(400)
      continue
    }

    if (s.scr === 'rest') {
      ev(`window.__sts.getState().restAction(${s.hp && s.hp < 40 ? "'rest'" : "'smith'"})`)
      await sleep(400)
      ev(`(() => { const g = window.__sts.getState(); if (g.select) { const c = g.select.cardUids[0]; if (c) g.resolveSelect(c); else g.cancelSelect() } })()`)
      log.push(s.hp && s.hp < 40 ? 'rest:heal' : 'rest:smith')
      await sleep(400)
      continue
    }

    if (s.scr === 'treasure') {
      ev('window.__sts.getState().takeTreasure()')
      log.push('treasure')
      await sleep(400)
      continue
    }

    if (s.scr === 'event') {
      const r = ev(`(() => {
        const g = window.__sts.getState()
        const evId = g.run.currentEvent
        const choices = window.__STS_EVENTS[evId].choices
        g.chooseEvent(0)
        return 'event:' + evId
      })()`)
      log.push(String(r))
      await sleep(800)
      ev(`(() => { const g = window.__sts.getState(); if (g.select) { const c = g.select.cardUids[0]; if (c) g.resolveSelect(c); else g.cancelSelect() } })()`)
      await sleep(400)
      continue
    }

    if (s.scr === 'bossRelic') {
      ev(`window.__sts.getState().chooseBossRelic(window.__sts.getState().bossOptions[0] || null)`)
      log.push('bossRelic')
      await sleep(500)
      continue
    }

    await sleep(600)
  }

  console.log('== 行动日志 ==')
  console.log(log.join(' > '))
  const final = evJson(`(() => { const g = window.__sts.getState(); const r = g.run; return JSON.stringify({ scr: r?.screen ?? g.screen, info: r?.gameOverInfo, deck: r?.deck.length, relics: r?.relics?.length }) })()`)
  console.log('== 最终状态 ==')
  console.log(JSON.stringify(final))
  execFileSync('agent-browser', ['screenshot', 'scripts/shot_fulltest_end.png'], { encoding: 'utf-8' })
}

main().catch(e => { console.error(e); process.exit(1) })
