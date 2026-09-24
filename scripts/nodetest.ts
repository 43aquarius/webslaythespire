// Node 环境直接驱动 store 的全流程测试（可快速定位 bug）
import { useGame } from '../src/store/gameStore'
import { CARDS, cardCost } from '../src/game/cards'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const g = useGame as any

function state() {
  const r = g.getState().run
  if (!r) return { scr: g.getState().screen }
  return {
    scr: r.screen, busy: g.getState().busy, hp: r.hp, gold: r.gold,
    floor: r.visitedNodes.length, deckLen: r.deck.length,
    combat: r.combat ? {
      phase: r.combat.phase, over: r.combat.combatOver,
      enemies: r.combat.enemies.map((e: any) => `${e.id}:${e.hp}/${e.maxHp}${e.dying ? 'D' : ''}`).join(','),
      hand: r.combat.hand.length, energy: r.combat.player.energy, turn: r.combat.turn,
    } : null,
    select: g.getState().select ? g.getState().select.kind : null,
  }
}

async function main() {
  g.getState().startRun()
  const log: string[] = []
  let step = 0
  const MAX = 3000
  let tried: Set<string> | null = null

  while (step++ < MAX) {
    const s = state() as any
    if (s.scr === 'gameover' || s.scr === 'victory') {
      console.log(`\n=== 终局: ${s.scr} ===`)
      break
    }
    // 检测牌组异常
    if (s.deckLen !== undefined && s.deckLen === 0) {
      console.log('\n!!! 牌组为空！历史:', log.slice(-25).join(' > '))
      console.log('当前状态:', JSON.stringify(s))
      break
    }

    if (g.getState().endBanner) { await sleep(100); continue }

    if (s.scr === 'map') {
      const r = g.getState().run
      // 测试外挂：满血（验证流程用）
      if (r.hp < r.maxHp) {
        useGame.setState({ run: { ...r, hp: r.maxHp } })
        await sleep(20)
        continue
      }
      const reach = r.currentNodeId ? r.map.nodes[r.currentNodeId].edges : r.map.startNodes
      const pickByType = (types: string[]) => {
        for (const t of types) {
          const n = reach.map((id: string) => r.map.nodes[id]).find((n: any) => n.type === t)
          if (n) { g.getState().chooseNode(n.id); return n.type }
        }
        return null
      }
      const floor = r.visitedNodes.length
      const picked = floor < 3
        ? pickByType(['monster', 'event', 'elite', 'treasure', 'shop', 'rest', 'boss'])
        : pickByType(['treasure', 'shop', 'rest', 'event', 'monster', 'elite', 'boss'])
      if (!picked) {
        const cur = r.currentNodeId ? r.map.nodes[r.currentNodeId] : null
        console.log('!! 地图无路', JSON.stringify({
          cur: r.currentNodeId, curRow: cur?.row, curType: cur?.type,
          edges: cur?.edges, edgeNodes: cur?.edges.map((id: string) => r.map.nodes[id] ? r.map.nodes[id].type : 'MISSING'),
          visited: r.visitedNodes.length,
        }))
        break
      }
      log.push(`F${floor}:${picked}`)
      await sleep(50)
      continue
    }

    if (s.scr === 'combat' && s.combat) {
      const c = s.combat
      if (s.busy || c.over || c.phase !== 'player') { await sleep(60); continue }
      const r = g.getState().run
      const cc = r.combat
      const living = cc.enemies.filter((e: any) => !e.dying && e.hp > 0)
      if (!living.length) { await sleep(60); continue }
      const weakest = [...living].sort((a: any, b: any) => a.hp - b.hp)[0]
      const energy = cc.player.energy
      const hand = [...cc.hand]
      const cost = (ci: any) => { const k = cardCost(ci, cc.player.hpLostThisCombat); return k === -1 ? energy : Math.max(0, k) }

      // 计算敌方意图总伤害
      let incoming = 0
      cc.enemies.forEach((e: any) => {
        if (e.intent && e.intent.type.startsWith('attack')) {
          let d = (e.intent.damage || 0) + (e.statuses.strength || 0)
          if (e.statuses.weak) d = Math.floor(d * 0.75)
          if (cc.player.statuses.vulnerable) d = Math.floor(d * 1.5)
          incoming += Math.max(0, d) * (e.intent.times || 1)
        }
      })
      const willDie = incoming > cc.player.block + r.hp - 1

      const attacks = hand.filter((ci: any) => CARDS[ci.id].type === 'attack' && cost(ci) <= energy)
      const powers = hand.filter((ci: any) => CARDS[ci.id].type === 'power' && cost(ci) <= energy)
      const blocks = hand.filter((ci: any) => ['defend', 'shrugItOff', 'impervious', 'ghostlyArmor', 'flameBarrier', 'powerThrough', 'trueGrit'].includes(ci.id) && cost(ci) <= energy)

      // 药水：血量低嗑血瓶；火药水收人头
      if (r.hp < r.maxHp * 0.35) {
        const bp = r.potions.findIndex((p: any) => p === 'bloodPotion')
        if (bp >= 0) { g.getState().usePotion(bp, null); log.push('pot:blood'); await sleep(30); continue }
      }
      const fp = r.potions.findIndex((p: any) => p === 'firePotion')
      if (fp >= 0 && weakest.hp <= 20) {
        g.getState().usePotion(fp, weakest.uid)
        log.push('pot:fire')
        await sleep(30)
        continue
      }

      let played = false
      if (!tried) tried = new Set()
      const okAttacks = attacks.filter((ci: any) => !tried.has(ci.uid))
      const okPowers = powers.filter((ci: any) => !tried.has(ci.uid))
      const okBlocks = blocks.filter((ci: any) => !tried.has(ci.uid))
      let before = cc.hand.length
      if (willDie && okBlocks.length) { g.getState().playCard(okBlocks[0].uid, null); played = true; if (g.getState().run.combat.hand.length === before) tried.add(okBlocks[0].uid) }
      else if (okAttacks.length) { g.getState().playCard(okAttacks[0].uid, weakest.uid); played = true; if (g.getState().run.combat?.hand.length === before) tried.add(okAttacks[0].uid) }
      else if (okPowers.length && cc.turn <= 3) { g.getState().playCard(okPowers[0].uid, null); played = true; if (g.getState().run.combat?.hand.length === before) tried.add(okPowers[0].uid) }
      else if (okBlocks.length && energy >= 1) { g.getState().playCard(okBlocks[0].uid, null); played = true; if (g.getState().run.combat?.hand.length === before) tried.add(okBlocks[0].uid) }
      if (!played || tried.size > 12) {
        tried = null
        g.getState().endTurn()
        log.push(`t${c.turn}:end`)
        let waited = 0
        while (waited++ < 60) {
          await sleep(60)
          const st: any = state()
          if (!st.busy || (st.combat && st.combat.over) || st.scr !== 'combat') break
        }
        continue
      }
      await sleep(30)
      // 处理选牌
      const sel = g.getState().select
      if (sel) {
        const u = sel.cardUids[0]
        if (u) g.getState().resolveSelect(u)
        else g.getState().cancelSelect()
        log.push('sel')
        await sleep(30)
      }
      continue
    }

    if (s.scr === 'reward') {
      const r = g.getState().run
      g.getState().takeGold()
      if (r.reward?.relic) g.getState().takeRelic()
      if (r.reward?.potion) g.getState().takePotion()
      if (r.reward?.cards?.length) g.getState().takeCard(r.reward.cards[0])
      g.getState().proceedFromReward()
      log.push('reward')
      await sleep(50)
      continue
    }

    if (s.scr === 'shop') {
      const r = g.getState().run
      const cards = r.shop.cards.map((c: any, i: number) => ({ i, p: c.price })).filter((c: any) => c.p <= r.gold && !r.shop.cards[c.i].sold)
      cards.sort((a: any, b: any) => a.p - b.p)
      if (cards.length) g.getState().buyCard(cards[0].i)
      const relics = r.shop.relics.map((c: any, i: number) => ({ i, p: c.price })).filter((c: any) => c.p <= r.gold && !r.shop.relics[c.i].sold)
      if (relics.length) g.getState().buyRelic(relics[0].i)
      g.getState().leaveShop()
      log.push('shop')
      await sleep(50)
      continue
    }

    if (s.scr === 'rest') {
      g.getState().restAction(s.hp < 40 ? 'rest' : 'smith')
      await sleep(50)
      if (g.getState().select) {
        const c = g.getState().select!.cardUids[0]
        if (c) g.getState().resolveSelect(c)
        else g.getState().cancelSelect()
      }
      log.push(s.hp < 40 ? 'rest:heal' : 'rest:smith')
      await sleep(50)
      continue
    }

    if (s.scr === 'treasure') {
      g.getState().takeTreasure()
      log.push('treasure')
      await sleep(50)
      continue
    }

    if (s.scr === 'event') {
      const evId = g.getState().run.currentEvent
      g.getState().chooseEvent(0)
      log.push(`ev:${evId}`)
      await sleep(100)
      const sel = g.getState().select
      if (sel) {
        const c = sel.cardUids[0]
        if (c) g.getState().resolveSelect(c)
        else g.getState().cancelSelect()
      }
      await sleep(50)
      continue
    }

    if (s.scr === 'bossRelic') {
      g.getState().chooseBossRelic(g.getState().bossOptions[0] || null)
      log.push('bossRelic')
      await sleep(50)
      continue
    }

    await sleep(60)
  }

  const final: any = state()
  console.log('日志:', log.join(' > '))
  console.log('最终:', JSON.stringify(final))
  const r = g.getState().run
  if (r) console.log('统计: deck=' + r.deck.length + ' relics=' + r.relics.length + ' hp=' + r.hp + '/' + r.maxHp + ' gold=' + r.gold)
}

main().catch(console.error)
