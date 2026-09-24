'use client'
// ============ 游戏主控 Store ============
import { create } from 'zustand'
import { RunState, Screen, CardInstance, FxEvent, NodeType } from '@/game/types'
import { CARDS, makeCard, cardCost } from '@/game/cards'
import {
  startCombat, playCard as engPlayCard, endPlayerTurn, enemyTurnStart, enemyStep,
  enemyTurnEnd, startPlayerTurn, usePotion as engUsePotion, usePotionOutOfCombat,
  canPlayCard, exhaustCard,
} from '@/game/engine'
import {
  newRun, pickEncounter, makeCombatReward, makeShop, applyEventEffect, bossRelicChoices,
  gainRelic, addPotion, EventResult,
} from '@/game/run'
import { EVENTS as EVENTS_POOL } from '@/game/events'
import { RELICS } from '@/game/relics'

export type SelectKind = 'armaments' | 'headbutt' | 'warcry' | 'trueGrit'
  | 'eventRemove' | 'eventUpgrade' | 'restSmith' | 'shopRemove' | 'sacrifice'

export interface SelectState {
  kind: SelectKind
  title: string
  cardUids: string[]   // 可选的卡
  source: 'deck' | 'hand' | 'discard'
}

export interface FxItem extends FxEvent { ts: number }

interface GameStore {
  run: RunState | null
  screen: Screen
  busy: boolean                 // 动画锁
  fxList: FxItem[]
  select: SelectState | null
  pileView: null | 'draw' | 'discard' | 'exhaust' | 'deck'
  selectedCardUid: string | null   // 战斗中待选目标的卡
  selectedPotionIdx: number | null
  eventMsg: string | null
  bossOptions: string[]
  toast: string | null
  endBanner: 'win' | 'lose' | null

  startRun: () => void
  backToTitle: () => void
  chooseNode: (nodeId: string) => void
  playCard: (uid: string, targetUid: string | null) => void
  endTurn: () => void
  usePotion: (idx: number, targetUid: string | null) => void
  usePotionMap: (idx: number) => void
  discardPotion: (idx: number) => void
  clickCard: (uid: string) => void
  clickEnemy: (uid: string) => void
  cancelSelection: () => void
  resolveSelect: (cardUid: string) => void
  cancelSelect: () => void
  openPile: (pile: 'draw' | 'discard' | 'exhaust' | 'deck') => void
  closePile: () => void
  takeGold: () => void
  takeCard: (cardId: string) => void
  takePotion: () => void
  takeRelic: () => void
  proceedFromReward: () => void
  chooseBossRelic: (id: string | null) => void
  buyCard: (idx: number) => void
  buyRelic: (idx: number) => void
  buyPotion: (idx: number) => void
  buyRemoval: () => void
  leaveShop: () => void
  restAction: (act: 'rest' | 'smith') => void
  chooseEvent: (idx: number) => void
  takeTreasure: () => void
  removeFx: (id: number) => void
  showToast: (msg: string) => void
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const clone = <T,>(x: T): T => structuredClone(x)

export const useGame = create<GameStore>((set, get) => {
  // ============ 内部工具 ============
  function drainFx(run: RunState) {
    if (!run.combat || run.combat.fx.length === 0) return
    const items: FxItem[] = run.combat.fx.map(f => ({ ...f, ts: Date.now() }))
    run.combat.fx = []
    set(s => ({ fxList: [...s.fxList, ...items] }))
  }
  function showToastSafe(msg: string) {
    set({ toast: msg })
    setTimeout(() => { if (get().toast === msg) set({ toast: null }) }, 2400)
  }

  function finishCombat() {
    const state = get()
    if (state.endBanner) return
    const combat = state.run!.combat!
    const won = combat.playerWon
    set({ endBanner: won ? 'win' : 'lose' })
    setTimeout(() => {
      set({ endBanner: null })
      const run = clone(get().run!)
      const c = run.combat!
      if (won) {
        run.monsterKilled += 1
        if (c.isElite) run.eliteKilled += 1
        if (run.relics.includes('burningBlood')) {
          run.hp = Math.min(run.maxHp, run.hp + 6)
        }
        if (run.relics.includes('meatOnTheBone') && run.hp < run.maxHp * 0.5) {
          run.hp = Math.min(run.maxHp, run.hp + 12)
        }
        // 金币改为奖励界面主动领取（takeGold），修复双倍计入
        run.reward = makeCombatReward(run, c.isElite, c.isBoss)
        run.screen = 'reward'
        set({ run, fxList: [] })
      } else {
        run.gameOverInfo = {
          victory: false,
          floor: run.visitedNodes.length,
          monstersSlain: run.monsterKilled,
          elitesSlain: run.eliteKilled,
          goldEarned: run.goldEarned,
        }
        run.screen = 'gameover'
        set({ run, fxList: [] })
      }
    }, 1500)
  }

  function beginCombatFromNode(run: RunState, type: NodeType) {
    const isElite = type === 'elite'
    const isBoss = type === 'boss'
    const enc = pickEncounter(run, isElite, isBoss)
    run.combat = startCombat(run, enc.name, enc.enemies, isElite, isBoss)
    run.screen = 'combat'
  }

  function checkPendingSelect() {
    const run = get().run!
    const combat = run.combat
    if (!combat || combat.combatOver) return
    if (combat.pendingArmaments === 'all') {
      const r = clone(run)
      r.combat!.hand.forEach(c => { c.upgraded = Math.max(1, c.upgraded) })
      r.combat!.pendingArmaments = null
      set({ run: r })
      return
    }
    if (combat.pendingArmaments === 'one') {
      const cands = combat.hand.filter(c => c.upgraded === 0 && c.id !== 'searingBlow')
      const r = clone(run)
      r.combat!.pendingArmaments = null
      set({ run: r })
      if (cands.length === 0) { showToastSafe('没有可升级的牌'); return }
      set({
        select: {
          kind: 'armaments', title: '武装：升级手牌中的一张牌',
          cardUids: cands.map(c => c.uid), source: 'hand',
        },
      })
      return
    }
    if (combat.pendingHeadbutt) {
      const r = clone(run)
      r.combat!.pendingHeadbutt = false
      set({ run: r })
      if (combat.discardPile.length === 0) return
      set({
        select: {
          kind: 'headbutt', title: '头槌：将弃牌堆中的一张牌置于抽牌堆顶',
          cardUids: combat.discardPile.map(c => c.uid), source: 'discard',
        },
      })
      return
    }
    if (combat.pendingWarcry) {
      const r = clone(run)
      r.combat!.pendingWarcry = false
      set({ run: r })
      if (combat.hand.length === 0) return
      set({
        select: {
          kind: 'warcry', title: '战吼：将手牌中的一张牌置于抽牌堆顶',
          cardUids: combat.hand.map(c => c.uid), source: 'hand',
        },
      })
      return
    }
    if (combat.pendingTrueGrit) {
      const r = clone(run)
      r.combat!.pendingTrueGrit = false
      set({ run: r })
      if (combat.hand.length === 0) return
      set({
        select: {
          kind: 'trueGrit', title: '坚毅：消耗手牌中的一张牌',
          cardUids: combat.hand.map(c => c.uid), source: 'hand',
        },
      })
      return
    }
  }

  // ============ 对外动作 ============
  return {
    run: null,
    screen: 'title',
    busy: false,
    fxList: [],
    select: null,
    pileView: null,
    selectedCardUid: null,
    selectedPotionIdx: null,
    eventMsg: null,
    bossOptions: [],
    toast: null,
    endBanner: null,

    startRun: () => {
      set({
        run: newRun(), screen: 'map', busy: false, fxList: [], select: null, pileView: null,
        selectedCardUid: null, selectedPotionIdx: null, eventMsg: null, bossOptions: [], toast: null, endBanner: null,
      })
    },
    backToTitle: () => set({
      run: null, screen: 'title', busy: false, fxList: [], select: null, pileView: null,
      selectedCardUid: null, selectedPotionIdx: null, eventMsg: null, bossOptions: [], toast: null, endBanner: null,
    }),

    chooseNode: (nodeId) => {
      const { run, busy } = get()
      if (!run || busy) return
      const node = run.map.nodes[nodeId]
      if (!node) return
      const reach = run.currentNodeId ? run.map.nodes[run.currentNodeId]?.edges : run.map.startNodes
      if (!reach.includes(nodeId)) return
      const r = clone(run)
      r.currentNodeId = nodeId
      r.visitedNodes.push(nodeId)
      r.reward = null
      r.shop = null
      r.currentEvent = null
      switch (node.type) {
        case 'monster': case 'elite': case 'boss':
          beginCombatFromNode(r, node.type)
          break
        case 'shop':
          r.shop = makeShop(r)
          r.screen = 'shop'
          break
        case 'rest':
          r.screen = 'rest'
          break
        case 'treasure':
          r.screen = 'treasure'
          break
        case 'event': {
          let pool = Object.keys(EVENTS_POOL).filter(id => !r.eventsSeen.includes(id))
          if (pool.length === 0) pool = Object.keys(EVENTS_POOL)
          const evId = pool[Math.floor(Math.random() * pool.length)]
          r.currentEvent = evId
          r.eventsSeen.push(evId)
          r.screen = 'event'
          break
        }
      }
      set({ run: r, screen: r.screen })
    },

    playCard: (uid, targetUid) => {
      const { run, busy } = get()
      if (!run || busy || !run.combat) return
      const combat = run.combat
      if (combat.phase !== 'player' || combat.combatOver) return
      const card = combat.hand.find(c => c.uid === uid)
      if (!card) return
      const check = canPlayCard(combat, run, card)
      if (!check.ok) { showToastSafe(check.reason || '无法打出'); return }
      const r = clone(run)
      engPlayCard(r.combat!, r, uid, targetUid)
      set({ run: r, selectedCardUid: null })
      drainFx(r)
      if (r.combat!.combatOver) {
        finishCombat()
      } else {
        checkPendingSelect()
      }
    },

    endTurn: async () => {
      const { run, busy } = get()
      if (!run || busy || !run.combat) return
      const combat = run.combat
      if (combat.phase !== 'player' || combat.combatOver) return
      set({ busy: true, selectedCardUid: null, selectedPotionIdx: null })

      // try/finally 保证 busy 一定复位：任何异常都不会永久锁死战斗界面
      try {
        let r = clone(run)
        endPlayerTurn(r.combat!, r)
        set({ run: r })
        drainFx(r)
        if (r.combat!.combatOver) { finishCombat(); return }

        r = clone(get().run!)
        enemyTurnStart(r.combat!)
        set({ run: r })

        for (let guard = 0; guard < 30; guard++) {
          await sleep(600)
          r = clone(get().run!)
          const more = enemyStep(r.combat!, r)
          set({ run: r })
          drainFx(r)
          if (!more || r.combat!.combatOver) break
        }
        if (get().run!.combat!.combatOver) { finishCombat(); return }

        await sleep(400)
        r = clone(get().run!)
        enemyTurnEnd(r.combat!, r)
        if (r.hp > 0 && !r.combat!.combatOver) {
          startPlayerTurn(r.combat!, r)
        }
        set({ run: r })
        drainFx(r)
        if (r.combat!.combatOver) { finishCombat() }
      } catch (err) {
        // 引擎异常：记录并强制恢复玩家回合，避免界面锁死
        console.error('[endTurn] 引擎异常:', err)
        const r = clone(get().run!)
        if (r.combat && !r.combat.combatOver) {
          r.combat.phase = 'player'
          set({ run: r, toast: '发生异常，回合已恢复' })
          setTimeout(() => { if (get().toast === '发生异常，回合已恢复') set({ toast: null }) }, 2000)
        }
      } finally {
        set({ busy: false })
      }
    },

    usePotion: (idx, targetUid) => {
      const { run, busy } = get()
      if (!run || busy || !run.combat) return
      const pid = run.potions[idx]
      if (!pid) return
      const r = clone(run)
      const ok = engUsePotion(r.combat!, r, idx, targetUid)
      if (!ok) { showToastSafe('无法使用该药水'); return }
      set({ run: r, selectedPotionIdx: null })
      drainFx(r)
      if (r.combat!.combatOver) finishCombat()
    },

    // 地图/非战斗场景使用药水（血瓶、果汁可直接生效）
    usePotionMap: (idx) => {
      const { run } = get()
      if (!run || run.combat) return
      const pid = run.potions[idx]
      if (!pid) return
      const r = clone(run)
      const res = usePotionOutOfCombat(r, idx)
      if (!res.ok) { showToastSafe(res.msg || '无法使用该药水'); return }
      set({ run: r, toast: res.msg || null })
      if (res.msg) setTimeout(() => { if (get().toast === res.msg) set({ toast: null }) }, 2200)
    },

    discardPotion: (idx) => {
      const { run } = get()
      if (!run) return
      const r = clone(run)
      r.potions[idx] = null
      set({ run: r, selectedPotionIdx: null })
    },

    clickCard: (uid) => {
      const { run, selectedCardUid } = get()
      if (!run?.combat) return
      const combat = run.combat
      if (combat.phase !== 'player' || combat.combatOver || get().busy) return
      if (selectedCardUid === uid) { set({ selectedCardUid: null }); return }
      const card = combat.hand.find(c => c.uid === uid)
      if (!card) return
      const def = CARDS[card.id]
      const check = canPlayCard(combat, run, card)
      if (!check.ok) { showToastSafe(check.reason || '无法打出'); return }
      const living = combat.enemies.filter(e => !e.dying && e.hp > 0)
      if (def.target === 'enemy') {
        if (living.length === 1) { get().playCard(uid, living[0].uid); return }
        set({ selectedCardUid: uid })
        return
      }
      get().playCard(uid, null)
    },

    clickEnemy: (uid) => {
      const { run, selectedCardUid, selectedPotionIdx } = get()
      if (!run?.combat) return
      if (selectedCardUid) { get().playCard(selectedCardUid, uid); return }
      if (selectedPotionIdx !== null) { get().usePotion(selectedPotionIdx, uid); return }
    },

    cancelSelection: () => set({ selectedCardUid: null, selectedPotionIdx: null }),

    resolveSelect: (cardUid) => {
      const { run, select } = get()
      if (!run || !select) return
      const r = clone(run)

      if (select.kind === 'armaments') {
        const c = r.combat?.hand.find(x => x.uid === cardUid)
        if (c) c.upgraded = Math.max(1, c.upgraded)
      } else if (select.kind === 'headbutt') {
        const i = r.combat?.discardPile.findIndex(x => x.uid === cardUid) ?? -1
        if (i >= 0) {
          const [c] = r.combat!.discardPile.splice(i, 1)
          r.combat!.drawPile.push(c)
        }
      } else if (select.kind === 'warcry') {
        const i = r.combat?.hand.findIndex(x => x.uid === cardUid) ?? -1
        if (i >= 0) {
          const [c] = r.combat!.hand.splice(i, 1)
          r.combat!.drawPile.push(c)
        }
      } else if (select.kind === 'trueGrit') {
        const c = r.combat?.hand.find(x => x.uid === cardUid)
        if (c) exhaustCard(r.combat!, r, c, 'hand')
      } else if (select.kind === 'eventRemove' || select.kind === 'shopRemove' || select.kind === 'sacrifice') {
        const i = r.deck.findIndex(x => x.uid === cardUid)
        if (i >= 0) r.deck.splice(i, 1)
        if (select.kind === 'shopRemove') {
          r.gold -= r.shop!.removalPrice
          r.shop!.removalUsed = true
          r.removalCount += 1
        }
      } else if (select.kind === 'eventUpgrade' || select.kind === 'restSmith') {
        const c = r.deck.find(x => x.uid === cardUid)
        if (c) c.upgraded = Math.max(1, c.upgraded)
        if (select.kind === 'restSmith') {
          r.screen = 'map'
          set({ run: r, select: null, toast: '锻造完成！卡牌已升级' })
          setTimeout(() => { if (get().toast === '锻造完成！卡牌已升级') set({ toast: null }) }, 2200)
          return
        }
      }
      set({ run: r, select: null })
    },

    cancelSelect: () => set({ select: null }),

    openPile: (pile) => set({ pileView: pile }),
    closePile: () => set({ pileView: null }),

    takeGold: () => {
      const { run } = get()
      if (!run?.reward || run.reward.gold === undefined) return
      if (run.reward.taken.includes('gold')) return
      const r = clone(run)
      r.gold += r.reward!.gold!
      r.goldEarned += r.reward!.gold!
      r.reward!.taken.push('gold')
      set({ run: r })
    },
    takeCard: (cardId) => {
      const { run } = get()
      if (!run?.reward) return
      // 原版规则：奖励只能选一张卡，选后其他卡不可再选
      const alreadyTook = run.reward.taken.some(t => t.startsWith('card_'))
      if (alreadyTook) { showToastSafe('已经选择过一张卡牌了'); return }
      if (run.reward.taken.includes('card_' + cardId)) return
      const r = clone(run)
      r.deck.push(makeCard(cardId))
      r.reward!.taken.push('card_' + cardId)
      set({ run: r })
    },
    takePotion: () => {
      const { run } = get()
      if (!run?.reward?.potion) return
      if (run.reward.taken.includes('potion')) return
      const r = clone(run)
      if (addPotion(r, r.reward!.potion!)) {
        r.reward!.taken.push('potion')
        set({ run: r })
      } else {
        showToastSafe('药水栏已满')
      }
    },
    takeRelic: () => {
      const { run } = get()
      if (!run?.reward?.relic) return
      if (run.reward.taken.includes('relic')) return
      const r = clone(run)
      gainRelic(r, r.reward!.relic!)
      r.reward!.taken.push('relic')
      set({ run: r })
    },

    proceedFromReward: () => {
      const { run } = get()
      if (!run) return
      const wasBoss = run.combat?.isBoss
      if (wasBoss) {
        const r = clone(run)
        r.screen = 'bossRelic'
        const opts = bossRelicChoices(run)
        set({ run: r, bossOptions: opts, screen: 'bossRelic' })
        return
      }
      const r2 = clone(run)
      r2.combat = null
      r2.reward = null
      r2.screen = 'map'
      set({ run: r2, screen: 'map', fxList: [] })
    },

    chooseBossRelic: (id) => {
      const { run } = get()
      if (!run) return
      const r = clone(run)
      if (id) gainRelic(r, id)
      r.gameOverInfo = {
        victory: true,
        floor: r.visitedNodes.length,
        monstersSlain: r.monsterKilled,
        elitesSlain: r.eliteKilled,
        goldEarned: r.goldEarned,
      }
      r.screen = 'victory'
      r.combat = null
      set({ run: r, screen: 'victory', bossOptions: [] })
    },

    buyCard: (idx) => {
      const { run } = get()
      if (!run?.shop) return
      const item = run.shop.cards[idx]
      if (!item || item.sold) return
      if (run.gold < item.price) { showToastSafe('金币不足'); return }
      const r = clone(run)
      r.gold -= item.price
      r.shop!.cards[idx].sold = true
      r.deck.push(makeCard(item.cardId))
      set({ run: r })
    },
    buyRelic: (idx) => {
      const { run } = get()
      if (!run?.shop) return
      const item = run.shop.relics[idx]
      if (!item || item.sold) return
      if (run.gold < item.price) { showToastSafe('金币不足'); return }
      const r = clone(run)
      r.gold -= item.price
      r.shop!.relics[idx].sold = true
      gainRelic(r, item.relicId)
      set({ run: r })
    },
    buyPotion: (idx) => {
      const { run } = get()
      if (!run?.shop) return
      const item = run.shop.potions[idx]
      if (!item || item.sold) return
      if (!run.potions.some(p => p === null)) { showToastSafe('药水栏已满'); return }
      if (run.gold < item.price) { showToastSafe('金币不足'); return }
      const r = clone(run)
      r.gold -= item.price
      r.shop!.potions[idx].sold = true
      addPotion(r, item.potionId)
      set({ run: r })
    },
    buyRemoval: () => {
      const { run } = get()
      if (!run?.shop) return
      const shop = run.shop
      if (shop.removalUsed) return
      if (run.gold < shop.removalPrice) { showToastSafe('金币不足'); return }
      set({
        select: {
          kind: 'shopRemove', title: `移除一张牌（${shop.removalPrice} 金币）`,
          cardUids: run.deck.map(c => c.uid), source: 'deck',
        },
      })
    },
    leaveShop: () => {
      const { run } = get()
      if (!run) return
      const r = clone(run)
      r.shop = null
      r.screen = 'map'
      set({ run: r, screen: 'map' })
    },

    restAction: (act) => {
      const { run } = get()
      if (!run) return
      if (act === 'rest') {
        if (run.relics.includes('coffeeDripper')) { showToastSafe('咖啡滴滤壶：无法在篝火休息'); return }
        const r = clone(run)
        const heal = Math.min(Math.floor(r.maxHp * 0.3), r.maxHp - r.hp)
        r.hp += heal
        r.screen = 'map'
        set({ run: r, screen: 'map', toast: `休息回复了 ${heal} 点生命` })
        setTimeout(() => { if (get().toast?.includes('休息回复')) set({ toast: null }) }, 2200)
      } else {
        set({
          select: {
            kind: 'restSmith', title: '锻造：升级一张牌',
            cardUids: run.deck.map(c => c.uid), source: 'deck',
          },
        })
      }
    },

    chooseEvent: (idx) => {
      const { run, select } = get()
      if (!run?.currentEvent || select) return
      const ev = EVENTS_POOL[run.currentEvent]
      const choice = ev.choices[idx]
      // 先克隆再应用效果，避免直接突变 store 状态
      const r = clone(run)
      const result: EventResult = applyEventEffect(r, ev.id, choice.effect)

      if (result.gold) { r.gold += result.gold; r.goldEarned += Math.max(0, result.gold) }
      if (result.healPct) {
        const heal = Math.floor(r.maxHp * result.healPct)
        r.hp = Math.min(r.maxHp, r.hp + heal)
      }
      if (result.relic) gainRelic(r, result.relic)

      if (result.combat) {
        beginCombatFromNode(r, 'monster')
        set({ run: r, eventMsg: result.msg })
        setTimeout(() => set({ eventMsg: null }), 1800)
        return
      }

      // 需要选牌的效果：立即切回地图并同步打开选牌遮罩（避免重复触发事件）
      if (result.select === 'remove' || result.select === 'sacrifice') {
        r.currentEvent = null
        r.screen = 'map'
        if (r.deck.length > 0) {
          set({
            run: r, screen: 'map',
            select: {
              kind: result.select === 'sacrifice' ? 'sacrifice' : 'eventRemove',
              title: result.select === 'sacrifice' ? '献祭：移除一张牌' : '选择要移除的牌',
              cardUids: r.deck.map(c => c.uid), source: 'deck',
            },
            toast: result.msg || null,
          })
          if (result.msg) setTimeout(() => { if (get().toast === result.msg) set({ toast: null }) }, 2400)
        } else {
          set({ run: r, screen: 'map' })
        }
        return
      }
      if (result.select === 'upgrade') {
        r.currentEvent = null
        r.screen = 'map'
        if (r.deck.length > 0) {
          set({
            run: r, screen: 'map',
            select: {
              kind: 'eventUpgrade', title: '选择要升级的牌',
              cardUids: r.deck.map(c => c.uid), source: 'deck',
            },
            toast: result.msg || null,
          })
          if (result.msg) setTimeout(() => { if (get().toast === result.msg) set({ toast: null }) }, 2400)
        } else {
          set({ run: r, screen: 'map' })
        }
        return
      }
      if (result.select === 'randomUpgrade') {
        const cands = r.deck.filter(c => c.upgraded === 0 && c.id !== 'searingBlow')
        if (cands.length) cands[Math.floor(Math.random() * cands.length)].upgraded = 1
      }
      if (result.select === 'upgradeStrikeDefend') {
        r.deck.forEach(c => { if (c.id === 'strike' || c.id === 'defend') c.upgraded = Math.max(1, c.upgraded) })
      }

      r.currentEvent = null
      r.screen = 'map'
      set({ run: r, screen: 'map', eventMsg: result.msg || null })
      setTimeout(() => set({ eventMsg: null }), 2000)
    },

    takeTreasure: () => {
      const { run } = get()
      if (!run) return
      const r = clone(run)
      const owned = new Set(r.relics)
      const pool = Object.values(RELICS).filter(x => (x.rarity === 'common' || x.rarity === 'uncommon') && !owned.has(x.id))
      const relicId = pool.length ? pool[Math.floor(Math.random() * pool.length)].id : null
      if (relicId) gainRelic(r, relicId)
      r.screen = 'map'
      set({ run: r, screen: 'map', toast: relicId ? `获得遗物：${RELICS[relicId].name}` : '箱子是空的' })
      setTimeout(() => set({ toast: null }), 2200)
    },

    removeFx: (id) => set(s => ({ fxList: s.fxList.filter(f => f.id !== id) })),
    showToast: (msg) => showToastSafe(msg),
  }
})

// 调试钩子（浏览器控制台可通过 __sts 访问游戏状态）
if (typeof window !== 'undefined') {
  ;(window as any).__sts = useGame
  ;(window as any).__STS_CARDS = CARDS
  ;(window as any).__STS_COST = cardCost
  ;(window as any).__STS_EVENTS = EVENTS_POOL
}
