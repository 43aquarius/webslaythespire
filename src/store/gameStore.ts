'use client'
// ============ 游戏主控 Store（单人 + 联机合作） ============
// 联机架构：房主权威 —— 房主执行全部游戏逻辑并广播快照；
// 客机的可转发动作经 net 层发送给房主执行（fwd 包装），快照回传后渲染。
import { create } from 'zustand'
import { RunState, Screen, CardInstance, FxEvent, NodeType, CharacterId } from '@/game/types'
import { CARDS, makeCard, cardCost } from '@/game/cards'
import {
  startCombat, playCard as engPlayCard, endPlayerTurn, enemyTurnStart, enemyStep,
  enemyTurnEnd, startPlayerTurn, usePotion as engUsePotion, usePotionOutOfCombat,
  canPlayCard, exhaustCard, setCombatRunRef, AP,
} from '@/game/engine'
import {
  newRun, newMultiRun, pickEncounter, makeCombatReward, makeShop, applyEventEffect, bossRelicChoices,
  gainRelic, addPotion, advanceAct, transformCardId, EventResult, neowOfferCards, weightedPotionPick,
} from '@/game/run'
import { setRunActive, syncRunActive, nextActorIdx, firstActorIdx, consistentRun } from '@/game/mp'
import { EVENTS as EVENTS_POOL } from '@/game/events'
import { RELICS, bossRelicPool } from '@/game/relics'
import { POTIONS } from '@/game/potions'
import { net, NetState, NetMsg } from '@/game/net'
import { saveRun, loadSave, clearSave, saveableMoment, recordRunResult } from '@/game/persist'

export type SelectKind = 'armaments' | 'headbutt' | 'warcry' | 'trueGrit'
  | 'eventRemove' | 'eventUpgrade' | 'restSmith' | 'shopRemove' | 'sacrifice'
  | 'nightmare' | 'seek' | 'omniscience' | 'hologram' | 'neowRemove' | 'neowUpgrade' | 'neowTransform' | 'neowDuplicate'
  | 'neowGainCard'

export interface SelectState {
  kind: SelectKind
  title: string
  cardUids: string[]   // 可选的卡
  source: 'deck' | 'hand' | 'discard' | 'draw' | 'offer'
  remaining?: number    // 多选剩余次数（搜寻）
  owner?: number        // 联机：发起选牌的玩家（单人恒 0）
  offerCards?: import('@/game/types').CardInstance[] // source='offer'：直接展示的卡（获得类选牌）
}

export interface FxItem extends FxEvent { ts: number }

export type MenuScreen = 'title' | 'charSelect' | 'mpLobby' | 'stats' | 'settings' | 'credits'

interface GameStore {
  run: RunState | null
  menuScreen: MenuScreen       // 无 run 时的界面路由（主菜单/角色选择/联机大厅/统计/设置/制作名单）
  menuOpen: boolean            // 游戏内齿轮菜单
  busy: boolean                // 动画锁
  fxList: FxItem[]
  select: SelectState | null
  pileView: null | 'draw' | 'discard' | 'exhaust' | 'deck'
  selectedCardUid: string | null   // 战斗中待选目标的卡
  selectedPotionIdx: number | null
  eventMsg: string | null
  bossOptions: string[]
  toast: string | null
  endBanner: 'win' | 'lose' | null
  selectedCharacter: CharacterId
  net: NetState
  mpSmithQueue: number[]       // 联机篝火：待锻造玩家队列

  selectCharacter: (c: CharacterId) => void
  startRun: (c?: CharacterId) => void
  gotoMenuScreen: (s: MenuScreen) => void
  toggleMenu: (open?: boolean) => void
  continueRun: () => void
  abandonRun: () => void
  chooseNeow: (idx: number) => void
  backToTitle: () => void
  continueFromActTransition: () => void
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
  resolveScry: (discardUids: string[]) => void
  openPile: (pile: 'draw' | 'discard' | 'exhaust' | 'deck') => void
  closePile: () => void
  takeGold: () => void
  takeCard: (cardId: string) => void
  mpSkipCard: () => void
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
  // 联机
  netCreateRoom: (name: string) => void
  netJoinRoom: (name: string, code: string) => void
  netLeave: () => void
  lobbyPickChar: (c: CharacterId) => void
  lobbyStart: () => void
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const clone = <T,>(x: T): T => structuredClone(x)

// 联机动作转发的执行者上下文（net 层在执行远端动作前设置）
let pendingActorIdx: number | null = null
export function setPendingActor(i: number | null) { pendingActorIdx = i }

const EMPTY_NET: NetState = {
  role: null, status: 'idle', roomCode: '', myName: '玩家', peerName: '', myIdx: 0,
  connected: false, lobby: { hostChar: null, guestChar: null }, error: null,
}

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
  /** 当前动作的发起玩家（联机远端动作 = 发送者；本地 = 房主/单人 0） */
  function actorIdx(_run: RunState): number {
    if (_run.players.length === 1) return 0
    return pendingActorIdx ?? 0
  }
  /** 联机动作转发包装：客机 → 发给房主；房主/单人 → 本地执行 */
  function fwd<F extends (...a: any[]) => any>(name: string, fn: F): F {
    return ((...args: any[]) => {
      const st = get()
      if (st.net.role === 'guest' && st.net.connected && st.run) {
        net.send({ t: 'act', fn: name, args })
        return
      }
      return fn(...args)
    }) as F
  }

  /** 当前动作发起者的药水栏（活动玩家用镜像，其他玩家用 players[]） */
  function potionsOf(run: RunState, actor: number): (string | null)[] {
    return actor === run.activeIdx ? run.potions : (run.players[actor]?.potions ?? run.potions)
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
        // 战后结算：按玩家独立（联机时全员生效）
        run.players.forEach(p => {
          if (p.relics.includes('burningBlood')) p.hp = Math.min(p.maxHp, p.hp + 6)
          if (p.relics.includes('meatOnTheBone') && p.hp < p.maxHp * 0.5) p.hp = Math.min(p.maxHp, p.hp + 12)
          // 原版：Boss 战后回复全部已损失生命（单人局）
          if (c.isBoss && run.players.length === 1) p.hp = p.maxHp
          // 联机：阵亡队友战后复活（保持双人可玩性，仿合作游戏惯例）
          if (run.players.length > 1 && p.hp <= 0) {
            p.hp = Math.floor(p.maxHp * 0.5)
            p.dead = false
          }
          if (run.players.length > 1) p.dead = false
        })
        syncRunActive(run)
        // 第 4 幕 Boss（腐朽之心）：无任何奖励，直接胜利（原版）
        if (c.isBoss && run.act >= 4) {
          run.gameOverInfo = {
            victory: true,
            floor: run.visitedNodes.length,
            monstersSlain: run.monsterKilled,
            elitesSlain: run.eliteKilled,
            goldEarned: run.players.reduce((a, p) => a + p.goldEarned, 0),
          }
          run.screen = 'victory'
          run.combat = null
          recordRunResult(run.players.map(p => p.character), true, run.visitedNodes.length, run.monsterKilled, run.eliteKilled, run.gameOverInfo.goldEarned)
          if (run.players.length === 1) clearSave()
          set({ run, fxList: [] })
          return
        }
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
        recordRunResult(run.players.map(p => p.character), false, run.visitedNodes.length, run.monsterKilled, run.eliteKilled, run.players.reduce((a, p) => a + p.goldEarned, 0))
        if (run.players.length === 1) clearSave()
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

  // 战斗中的引擎 pending 选择（含新增：噩梦/全知/全息/搜寻）
  function checkPendingSelect() {
    const run = get().run!
    const combat = run.combat
    if (!combat || combat.combatOver) return
    const P = combat.players[combat.activeIdx]
    const cf = P.customFlags || {}
    if (cf.pendingNightmareSelect) {
      const n = cf.pendingNightmareSelect
      delete cf.pendingNightmareSelect
      if (P.hand.length === 0) return
      const r = clone(run)
      set({ run: r, select: {
        kind: 'nightmare', title: `噩梦：选择一张手牌（下回合获得 ${n} 张副本）`,
        cardUids: AP(r.combat!).hand.map(c => c.uid), source: 'hand', remaining: n,
        owner: combat.activeIdx,
      } })
      return
    }
    if (cf.pendingOmniscience) {
      const times = cf.pendingOmniscience
      delete cf.pendingOmniscience
      if (P.hand.length === 0) return
      const r = clone(run)
      set({ run: r, select: {
        kind: 'omniscience', title: `全知：选择一张手牌，将其打出 ${times} 次`,
        cardUids: AP(r.combat!).hand.map(c => c.uid), source: 'hand', remaining: times,
        owner: combat.activeIdx,
      } })
      return
    }
    if (cf.pendingHologram) {
      delete cf.pendingHologram
      if (P.discardPile.length === 0) return
      const r = clone(run)
      set({ run: r, select: {
        kind: 'hologram', title: '全息影像：将弃牌堆中的一张牌返回手牌',
        cardUids: AP(r.combat!).discardPile.map(c => c.uid), source: 'discard',
        owner: combat.activeIdx,
      } })
      return
    }
    if (cf.pendingSeek) {
      const n = cf.pendingSeek
      delete cf.pendingSeek
      if (P.drawPile.length === 0) return
      const r = clone(run)
      set({ run: r, select: {
        kind: 'seek', title: `搜寻：从抽牌堆选择 ${n} 张牌加入手牌`,
        cardUids: AP(r.combat!).drawPile.map(c => c.uid), source: 'draw', remaining: n,
        owner: combat.activeIdx,
      } })
      return
    }
    const C = () => AP(r2.combat!)
    let r2 = clone(run)
    if (combat.players[combat.activeIdx].pendingArmaments === 'all') {
      C().hand.forEach(c => { c.upgraded = Math.max(1, c.upgraded) })
      C().pendingArmaments = null
      set({ run: r2 })
      return
    }
    if (combat.players[combat.activeIdx].pendingArmaments === 'one') {
      const cands = P.hand.filter(c => c.upgraded === 0 && c.id !== 'searingBlow')
      const r3 = clone(run)
      AP(r3.combat!).pendingArmaments = null
      set({ run: r3 })
      if (cands.length === 0) { showToastSafe('没有可升级的牌'); return }
      set({
        run: r3,
        select: {
          kind: 'armaments', title: '武装：升级手牌中的一张牌',
          cardUids: cands.map(c => c.uid), source: 'hand',
          owner: combat.activeIdx,
        },
      })
      return
    }
    if (P.pendingHeadbutt) {
      const r3 = clone(run)
      AP(r3.combat!).pendingHeadbutt = false
      set({ run: r3 })
      if (P.discardPile.length === 0) return
      set({
        select: {
          kind: 'headbutt', title: '头槌：将弃牌堆中的一张牌置于抽牌堆顶',
          cardUids: P.discardPile.map(c => c.uid), source: 'discard',
          owner: combat.activeIdx,
        },
      })
      return
    }
    if (P.pendingWarcry) {
      const r3 = clone(run)
      AP(r3.combat!).pendingWarcry = false
      set({ run: r3 })
      if (P.hand.length === 0) return
      set({
        select: {
          kind: 'warcry', title: '战吼：将手牌中的一张牌置于抽牌堆顶',
          cardUids: P.hand.map(c => c.uid), source: 'hand',
          owner: combat.activeIdx,
        },
      })
      return
    }
    if (P.pendingTrueGrit) {
      const r3 = clone(run)
      AP(r3.combat!).pendingTrueGrit = false
      set({ run: r3 })
      if (P.hand.length === 0) return
      set({
        select: {
          kind: 'trueGrit', title: '坚毅：消耗手牌中的一张牌',
          cardUids: P.hand.map(c => c.uid), source: 'hand',
          owner: combat.activeIdx,
        },
      })
      return
    }
  }

  // 联机篝火：两位玩家都选择后统一结算
  function maybeResolveMpRest() {
    const run = get().run
    if (!run || run.players.length === 1 || !run.mpRest) return
    const alive = run.players.map((p, i) => (p.hp > 0 && !p.dead ? i : -1)).filter(i => i >= 0)
    if (!alive.every(i => run.mpRest?.[i])) return
    const r = clone(run)
    // 休息者回血
    alive.forEach(i => {
      if (r.mpRest![i] === 'rest') {
        const heal = Math.min(Math.floor(r.players[i].maxHp * 0.3), r.players[i].maxHp - r.players[i].hp)
        r.players[i].hp += heal
      }
    })
    const smithers = alive.filter(i => r.mpRest![i] === 'smith')
    r.mpRest = null
    if (smithers.length === 0) {
      r.screen = 'map'
      set({ run: r })
      return
    }
    // 链式锻造：逐个玩家选牌升级
    const queue = [...smithers]
    const first = queue.shift()!
    set({ run: r, mpSmithQueue: queue, select: {
      kind: 'restSmith', title: `锻造：${r.players[first].name} 升级一张牌`,
      cardUids: r.players[first].deck.map(c => c.uid), source: 'deck', owner: first,
    } })
  }

  // 联机涅奥：推进到下一位选择者；全部选完进地图（单人直接进地图）
  function advanceNeow(r: RunState) {
    if (r.players.length === 1) { r.screen = 'map'; return }
    const cur = r.neow!.chooserIdx ?? 0
    const next = cur + 1
    if (next < r.players.length) {
      r.neow!.chooserIdx = next
      r.screen = 'neow'
    } else {
      r.neow!.chooserIdx = -1
      r.screen = 'map'
    }
  }

  // ============ 对外动作 ============
  return {
    run: null,
    menuScreen: 'title',
    menuOpen: false,
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
    selectedCharacter: 'ironclad',
    net: { ...EMPTY_NET },
    mpSmithQueue: [],

    selectCharacter: (c) => set({ selectedCharacter: c }),

    gotoMenuScreen: (s) => set({ menuScreen: s, menuOpen: false }),

    toggleMenu: (open) => set(s => ({ menuOpen: open !== undefined ? open : !s.menuOpen })),

    startRun: (c) => {
      const character = c || get().selectedCharacter
      if (get().net.role) get().netLeave()
      set({
        run: newRun(character), menuScreen: 'title', menuOpen: false, busy: false, fxList: [], select: null, pileView: null,
        selectedCardUid: null, selectedPotionIdx: null, eventMsg: null, bossOptions: [], toast: null, endBanner: null,
        selectedCharacter: character, mpSmithQueue: [],
      })
    },

    continueRun: () => {
      const p = loadSave()
      if (!p) { showToastSafe('没有可继续的冒险'); return }
      const run = p.run
      if (!run.screen || run.screen === 'gameover' || run.screen === 'victory') run.screen = 'map'
      setCombatRunRef(run)
      set({
        run, menuScreen: 'title', menuOpen: false, busy: false, fxList: [], select: p.select as SelectState | null,
        pileView: null, selectedCardUid: null, selectedPotionIdx: null, eventMsg: null,
        bossOptions: p.bossOptions || [], toast: null, endBanner: null,
        selectedCharacter: run.character, mpSmithQueue: [],
      })
    },

    abandonRun: () => {
      const { run } = get()
      if (!run) return
      const r = clone(run)
      r.gameOverInfo = {
        victory: false,
        floor: r.visitedNodes.length,
        monstersSlain: r.monsterKilled,
        elitesSlain: r.eliteKilled,
        goldEarned: r.goldEarned,
      }
      r.screen = 'gameover'
      recordRunResult(r.players.map(p => p.character), false, r.visitedNodes.length, r.monsterKilled, r.eliteKilled, r.players.reduce((a, p) => a + p.goldEarned, 0))
      if (r.players.length === 1) clearSave()
      set({ run: r, menuOpen: false })
    },

    // ============ 涅奥祝福 ============
    chooseNeow: fwd('chooseNeow', (idx: number) => {
      const { run, busy } = get()
      if (!run || busy || !run.neow || (run.neow.chosen && run.players.length === 1)) return
      const mp = run.players.length > 1
      const chooser = mp ? (run.neow.chooserIdx ?? 0) : 0
      // 联机：只有当前选择者能选
      if (mp) {
        const sender = pendingActorIdx ?? 0
        if (sender !== chooser) return
      }
      const opts = mp ? (run.neow.mpOptions?.[chooser] ?? []) : run.neow.options
      const opt = opts[idx]
      if (!opt) return
      const r = clone(run)
      setRunActive(r, chooser)
      if (!mp) r.neow!.chosen = opt.id
      else if (r.neow!.mpChosen) r.neow!.mpChosen[chooser] = opt.id
      let toast = ''
      // 第三祝福：先结算代价
      if (opt.effect === 'tradeoff' && opt.disadvantage) {
        const char = r.players[chooser].character
        const NEOW_TRADE_LOSE: Record<CharacterId, number> = { ironclad: 8, silent: 7, defect: 7, watcher: 7 }
        switch (opt.disadvantage) {
          case 'loseMaxHp': {
            const v = NEOW_TRADE_LOSE[char]
            r.maxHp = Math.max(1, r.maxHp - v)
            r.hp = Math.min(r.hp, r.maxHp)
            r.players[chooser].maxHp = r.maxHp
            r.players[chooser].hp = r.hp
            toast = `代价：最大生命 -${v}`
            break
          }
          case 'takeDamage': {
            const dmg = Math.max(0, Math.floor(r.hp / 10) * 3)
            if (dmg > 0) {
              r.hp = Math.max(1, r.hp - dmg)
              r.players[chooser].hp = r.hp
            }
            toast = `代价：失去 ${dmg} 生命`
            break
          }
          case 'curseCard': {
            const curseId = ['regret', 'injury', 'doubt'][Math.floor(Math.random() * 3)]
            r.deck.push(makeCard(curseId))
            r.players[chooser].deck = r.deck
            toast = '代价：一张诅咒进入了你的卡组'
            break
          }
          case 'loseGold':
            r.gold = 0
            r.players[chooser].gold = 0
            toast = '代价：失去了所有金币'
            break
        }
      }
      switch (opt.effect) {
        case 'relic': {
          const owned = new Set(r.relics)
          const pool = ['vajra', 'anchor', 'bagOfMarbles', 'lantern', 'bagOfPreparation', 'bronzeScales', 'centennialPuzzle', 'warPaint', 'whetstone', 'smoothlyStone', 'preservedInsect', 'meatOnTheBone', 'bloodVial', 'tungstenRod']
            .filter(id => !owned.has(id))
          if (pool.length) {
            gainRelic(r, pool[Math.floor(Math.random() * pool.length)])
            toast = (toast ? toast + '；' : '') + '获得了一件遗物！'
          } else toast = (toast ? toast + '；' : '') + '涅奥沉默了…'
          break
        }
        case 'rareRelic': {
          // 第三祝福奖励：随机罕见遗物
          const owned = new Set(r.relics)
          const pool = Object.values(RELICS).filter(x => x.rarity === 'uncommon' && !owned.has(x.id)).map(x => x.id)
          if (pool.length) {
            gainRelic(r, pool[Math.floor(Math.random() * pool.length)])
            toast = (toast ? toast + '；' : '') + '获得了一件罕见遗物！'
          } else toast = (toast ? toast + '；' : '') + '涅奥沉默了…'
          break
        }
        case 'maxHp':
        case 'gainMaxHp':
          r.maxHp += opt.value || 8
          r.hp += opt.value || 8
          r.players[chooser].maxHp = r.maxHp
          r.players[chooser].hp = r.hp
          toast = (toast ? toast + '；' : '') + `最大生命值 +${opt.value || 8}`
          break
        case 'heal':
          r.hp = r.maxHp
          r.players[chooser].hp = r.hp
          toast = '生命值已完全恢复'
          break
        case 'gold':
          r.gold += opt.value || 100
          r.goldEarned += opt.value || 100
          r.players[chooser].gold = r.gold
          r.players[chooser].goldEarned = r.goldEarned
          toast = (toast ? toast + '；' : '') + `获得 ${opt.value || 100} 金币`
          break
        case 'potions': {
          let added = 0
          for (let i = 0; i < (opt.value || 3); i++) {
            if (addPotion(r, weightedPotionPick())) added++
          }
          r.players[chooser].potions = r.potions
          toast = (toast ? toast + '；' : '') + `获得了 ${added} 瓶药水`
          break
        }
        case 'neowLament':
          r.neowLament = opt.value || 3
          toast = '涅奥的哀歌将伴随你 3 场战斗'
          break
        case 'bossSwap': {
          // 第四祝福：用初始遗物交换随机 Boss 遗物（原版 Boss Swap）
          const starter = r.players[chooser].relics[0]
          const pool = bossRelicPool().filter(id => !r.relics.includes(id))
          if (pool.length) {
            const sw = pool[Math.floor(Math.random() * pool.length)]
            // 移除初始遗物（保留其它）
            r.relics = r.relics.filter(id => id !== starter)
            r.players[chooser].relics = r.relics
            gainRelic(r, sw)
            r.players[chooser].relics = r.relics
            toast = `失去了「${RELICS[starter]?.name ?? '初始遗物'}」，获得「${RELICS[sw].name}」！`
          } else toast = '涅奥沉默了…'
          break
        }
        case 'randomRareCard': {
          // 第一祝福：获得随机稀有卡
          const pools = neowOfferCards(r.players[chooser].character, true)
          if (pools.length) {
            r.deck.push(makeCard(pools[0]))
            r.players[chooser].deck = r.deck
            toast = `获得了「${CARDS[pools[0]].name}」`
          } else toast = '涅奥沉默了…'
          break
        }
        case 'gainCard': {
          // 第一祝福：3 张随机卡三选一
          const ids = neowOfferCards(r.players[chooser].character, false).slice(0, 3)
          if (ids.length) {
            const offer = ids.map(id => makeCard(id))
            set({ run: r, select: {
              kind: 'neowGainCard', title: `涅奥：${r.players[chooser].name} 选择一张卡牌获得`,
              cardUids: offer.map(c => c.uid), source: 'offer', owner: chooser, offerCards: offer,
            } })
            return
          }
          toast = '涅奥沉默了…'
          break
        }
        case 'removeCard':
          set({ run: r, select: {
            kind: 'neowRemove', title: `涅奥：${r.players[chooser].name} 选择要移除的牌`,
            cardUids: r.players[chooser].deck.map(c => c.uid), source: 'deck', owner: chooser,
          } })
          return
        case 'upgradeCard':
          set({ run: r, select: {
            kind: 'neowUpgrade', title: `涅奥：${r.players[chooser].name} 选择要升级的牌`,
            cardUids: r.players[chooser].deck.map(c => c.uid), source: 'deck', owner: chooser,
          } })
          return
        case 'transformCard':
          set({ run: r, select: {
            kind: 'neowTransform', title: `涅奥：${r.players[chooser].name} 选择要转化的牌`,
            cardUids: r.players[chooser].deck.map(c => c.uid), source: 'deck', owner: chooser,
          } })
          return
        case 'duplicateCard':
          set({ run: r, select: {
            kind: 'neowDuplicate', title: `涅奥：${r.players[chooser].name} 选择要复制的牌`,
            cardUids: r.players[chooser].deck.map(c => c.uid), source: 'deck', owner: chooser,
          } })
          return
      }
      // 第三祝福奖励中的选牌类（代价已在上方结算）
      if (opt.effect === 'tradeoff') {
        const adv = opt.advantage!
        if (adv === 'removeCard2') {
          set({ run: r, select: {
            kind: 'neowRemove', title: `涅奥：${r.players[chooser].name} 选择要移除的牌（第 1/2 张）`,
            cardUids: r.players[chooser].deck.map(c => c.uid), source: 'deck', owner: chooser, remaining: 2,
          } })
          return
        }
        if (adv === 'transformCard2') {
          set({ run: r, select: {
            kind: 'neowTransform', title: `涅奥：${r.players[chooser].name} 选择要转化的牌（第 1/2 张）`,
            cardUids: r.players[chooser].deck.map(c => c.uid), source: 'deck', owner: chooser, remaining: 2,
          } })
          return
        }
        if (adv === 'chooseRareCard') {
          const ids = neowOfferCards(r.players[chooser].character, true).slice(0, 3)
          if (ids.length) {
            const offer = ids.map(id => makeCard(id))
            set({ run: r, select: {
              kind: 'neowGainCard', title: `涅奥：${r.players[chooser].name} 选择一张稀有卡牌获得`,
              cardUids: offer.map(c => c.uid), source: 'offer', owner: chooser, offerCards: offer,
            } })
            return
          }
        }
        if (adv === 'gold') {
          r.gold += 250
          r.goldEarned += 250
          r.players[chooser].gold = r.gold
          r.players[chooser].goldEarned = r.goldEarned
          toast = (toast ? toast + '；' : '') + '获得 250 金币'
        }
        if (adv === 'gainMaxHp') {
          const v = opt.value || 14
          r.maxHp += v
          r.hp += v
          r.players[chooser].maxHp = r.maxHp
          r.players[chooser].hp = r.hp
          toast = (toast ? toast + '；' : '') + `最大生命值 +${v}`
        }
        if (adv === 'rareRelic') {
          const owned = new Set(r.relics)
          const pool = Object.values(RELICS).filter(x => x.rarity === 'uncommon' && !owned.has(x.id)).map(x => x.id)
          if (pool.length) {
            gainRelic(r, pool[Math.floor(Math.random() * pool.length)])
            toast = (toast ? toast + '；' : '') + '获得了一件罕见遗物！'
          }
        }
      }
      advanceNeow(r)
      if (r.screen === 'map') toast = toast || '祝福已生效'
      set({ run: r, toast: toast || null })
      if (toast) setTimeout(() => { if (get().toast === toast) set({ toast: null }) }, 2400)
    }),

    continueFromActTransition: () => {
      const { run } = get()
      if (!run) return
      const r = clone(run)
      r.screen = 'map'
      set({ run: r })
    },
    backToTitle: () => {
      if (get().net.role) get().netLeave()
      set({
        run: null, menuScreen: 'title', menuOpen: false, busy: false, fxList: [], select: null, pileView: null,
        selectedCardUid: null, selectedPotionIdx: null, eventMsg: null, bossOptions: [], toast: null, endBanner: null,
        mpSmithQueue: [],
      })
    },

    chooseNode: fwd('chooseNode', (nodeId: string) => {
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
      r.mpRest = null
      switch (node.type) {
        case 'monster': case 'elite': case 'boss':
          beginCombatFromNode(r, node.type)
          break
        case 'shop':
          r.shop = makeShop(r)
          r.screen = 'shop'
          break
        case 'rest':
          // 联机：初始化双人选择状态
          if (r.players.length > 1) r.mpRest = r.players.map(() => null)
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
      set({ run: r })
    }),

    playCard: fwd('playCard', (uid: string, targetUid: string | null) => {
      const { run, busy } = get()
      if (!run || busy || !run.combat) return
      const combat = run.combat
      if (combat.phase !== 'player' || combat.combatOver) return
      // 联机：只有当前活动玩家能出牌
      if (combat.players.length > 1 && (pendingActorIdx ?? 0) !== combat.activeIdx) return
      const P = AP(combat)
      const card = P.hand.find(c => c.uid === uid)
      if (!card) return
      const check = canPlayCard(combat, run, card)
      if (!check.ok) { showToastSafe(check.reason || '无法打出'); return }
      const r = clone(run)
      setCombatRunRef(r)
      engPlayCard(r.combat!, r, uid, targetUid)
      set({ run: r, selectedCardUid: null })
      drainFx(r)
      if (r.combat!.combatOver) {
        finishCombat()
        return
      }
      // 结案/穹顶：打牌后立即结束回合
      const actP = AP(r.combat!)
      if (actP.customFlags?.endTurnNow) {
        delete actP.customFlags.endTurnNow
        set({ run: r })
        setTimeout(() => { get().endTurn() }, 450)
        return
      }
      checkPendingSelect()
    }),

    endTurn: fwd('endTurn', async () => {
      const { run, busy } = get()
      if (!run || busy || !run.combat) return
      const combat = run.combat
      if (combat.phase !== 'player' || combat.combatOver) return
      if (combat.players.length > 1 && (pendingActorIdx ?? 0) !== combat.activeIdx) return
      set({ busy: true, selectedCardUid: null, selectedPotionIdx: null })

      // try/finally 保证 busy 一定复位：任何异常都不会永久锁死战斗界面
      try {
        let r = clone(run)
        endPlayerTurn(r.combat!, r)
        set({ run: r })
        drainFx(r)
        if (r.combat!.combatOver) { finishCombat(); return }

        // ===== 联机：轮转到下一位未行动玩家 =====
        if (r.combat!.players.length > 1) {
          let nxt = nextActorIdx(r.combat!)
          while (nxt !== null) {
            r = clone(get().run!)
            r.combat!.activeIdx = nxt
            setRunActive(r, nxt)
            startPlayerTurn(r.combat!, r)
            set({ run: r })
            drainFx(r)
            if (r.combat!.combatOver) { finishCombat(); return }
            if (!AP(r.combat!).dead && r.hp > 0) break   // 正常开始该玩家回合
            // 起手死亡（亵渎/中毒）：标记已行动并继续轮转
            r = clone(get().run!)
            r.combat!.acted[nxt] = true
            set({ run: r })
            nxt = nextActorIdx(r.combat!)
          }
          if (nxt !== null) { set({ busy: false }); return }
          // 全员已行动 → 敌人回合
          r = clone(get().run!)
        }

        // ===== 穹顶：跳过敌人回合（所有玩家行动完后检查） =====
        if (AP(r.combat!).statuses.vaultS) {
          delete AP(r.combat!).statuses.vaultS
          r = clone(get().run!)
          if (r.combat!.players.length > 1) {
            r.combat!.acted = r.combat!.players.map(() => false)
            const first = firstActorIdx(r.combat!)
            r.combat!.activeIdx = first
            setRunActive(r, first)
          }
          startPlayerTurn(r.combat!, r)
          set({ run: r })
          drainFx(r)
          showToastSafe('穹顶：跳过敌人回合')
          return
        }

        // ===== 敌人回合 =====
        r.combat!.phase = 'enemy'
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
        // 新一轮：重置行动标记，第一位存活玩家先手
        if (r.combat!.players.length > 1) {
          r.combat!.acted = r.combat!.players.map(() => false)
          const first = firstActorIdx(r.combat!)
          r.combat!.activeIdx = first
          setRunActive(r, first)
        }
        const anyAlive = r.combat!.players.length > 1
          ? r.combat!.players.some((p, i) => !p.dead && r.players[i].hp > 0)
          : r.hp > 0
        if (anyAlive && !r.combat!.combatOver) {
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
    }),

    usePotion: fwd('usePotion', (idx: number, targetUid: string | null) => {
      const { run, busy } = get()
      if (!run || busy || !run.combat) return
      const combat = run.combat
      if (combat.players.length > 1 && (pendingActorIdx ?? 0) !== combat.activeIdx) return
      const actor = actorIdx(run)
      const pid = potionsOf(run, actor)[idx]
      if (!pid) return
      const r = clone(run)
      setRunActive(r, actor)
      const ok = engUsePotion(r.combat!, r, idx, targetUid)
      if (!ok) { showToastSafe('无法使用该药水'); return }
      set({ run: r, selectedPotionIdx: null })
      drainFx(r)
      if (r.combat!.combatOver) finishCombat()
    }),

    // 地图/非战斗场景使用药水（血瓶、果汁可直接生效）
    usePotionMap: fwd('usePotionMap', (idx: number) => {
      const { run } = get()
      if (!run || run.combat) return
      const actor = actorIdx(run)
      const pid = potionsOf(run, actor)[idx]
      if (!pid) return
      const r = clone(run)
      setRunActive(r, actor)
      const res = usePotionOutOfCombat(r, idx)
      if (!res.ok) { showToastSafe(res.msg || '无法使用该药水'); return }
      set({ run: r, toast: res.msg || null })
      if (res.msg) setTimeout(() => { if (get().toast === res.msg) set({ toast: null }) }, 2200)
    }),

    discardPotion: fwd('discardPotion', (idx: number) => {
      const { run } = get()
      if (!run) return
      const actor = actorIdx(run)
      if (!run.players[actor]) return
      const r = clone(run)
      setRunActive(r, actor)
      r.potions[idx] = null
      r.players[actor].potions = r.potions
      set({ run: r, selectedPotionIdx: null })
    }),

    clickCard: fwd('clickCard', (uid: string) => {
      const { run, selectedCardUid } = get()
      if (!run?.combat) return
      const combat = run.combat
      if (combat.phase !== 'player' || combat.combatOver || get().busy) return
      // 联机：只能操作自己回合的手牌
      if (combat.players.length > 1 && (pendingActorIdx ?? get().net.myIdx) !== combat.activeIdx) return
      const P = AP(combat)
      const card = P.hand.find(c => c.uid === uid)
      if (!card) return
      const def = CARDS[card.id]
      const living = combat.enemies.filter(e => !e.dying && e.hp > 0)

      // 已选中同一张牌 → 确认打出（触屏两段式：先预览再打出）
      if (selectedCardUid === uid) {
        if (def.target === 'enemy' && living.length > 1) return  // 多目标仍需点敌人
        get().playCard(uid, def.target === 'enemy' ? living[0]?.uid ?? null : null)
        return
      }

      const check = canPlayCard(combat, run, card)
      if (!check.ok) { showToastSafe(check.reason || '无法打出'); return }
      // 触屏设备无 hover 预览：第一次点选中放大，第二次点确认
      const isTouch = typeof matchMedia !== 'undefined' && matchMedia('(hover: none)').matches
      if (def.target === 'enemy') {
        if (living.length === 1 && !isTouch) { get().playCard(uid, living[0].uid); return }
        set({ selectedCardUid: uid })
        return
      }
      if (isTouch) { set({ selectedCardUid: uid }); return }
      get().playCard(uid, null)
    }),

    clickEnemy: fwd('clickEnemy', (uid: string) => {
      const { run, selectedCardUid, selectedPotionIdx } = get()
      if (!run?.combat) return
      if (selectedCardUid) { get().playCard(selectedCardUid, uid); return }
      if (selectedPotionIdx !== null) { get().usePotion(selectedPotionIdx, uid); return }
    }),

    cancelSelection: () => set({ selectedCardUid: null, selectedPotionIdx: null }),

    resolveSelect: fwd('resolveSelect', (cardUid: string) => {
      const { run, select } = get()
      if (!run || !select) return
      const owner = select.owner ?? 0
      const r = clone(run)
      setRunActive(r, owner)
      setCombatRunRef(r)
      const combat = r.combat

      // ---- 多选流程（搜寻）----
      if (select.kind === 'seek' && combat) {
        const P = AP(combat)
        const i = P.drawPile.findIndex(x => x.uid === cardUid)
        if (i >= 0) {
          const [c] = P.drawPile.splice(i, 1)
          P.hand.push(c)
        }
        const left = (select.remaining || 1) - 1
        if (left > 0 && combat && P.drawPile.length > 0) {
          set({ run: r, select: {
            kind: 'seek', title: `搜寻：再选 ${left} 张`,
            cardUids: P.drawPile.map(c => c.uid), source: 'draw', remaining: left, owner,
          } })
          return
        }
        set({ run: r, select: null })
        return
      }
      // ---- 噩梦：选牌设 pendingNightmare ----
      if (select.kind === 'nightmare' && combat) {
        const P = AP(combat)
        const c = P.hand.find(x => x.uid === cardUid)
        if (c) P.pendingNightmare = { cardId: c.id, upgraded: c.upgraded, count: select.remaining || 3 }
        set({ run: r, select: null })
        return
      }
      // ---- 全知：将选中牌打出 N 次 ----
      if (select.kind === 'omniscience' && combat) {
        const times = select.remaining || 2
        const living = combat.enemies.filter(e => !e.dying && e.hp > 0)
        for (let t = 0; t < times; t++) {
          const c = AP(combat).hand.find(x => x.uid === cardUid)
          if (!c) break
          const targetUid = living[0]?.uid ?? null
          engPlayCard(combat, r, cardUid, targetUid)
        }
        set({ run: r, select: null })
        drainFx(r)
        if (combat.combatOver) finishCombat()
        return
      }
      // ---- 全息影像：弃牌堆返回手牌 ----
      if (select.kind === 'hologram' && combat) {
        const P = AP(combat)
        const i = P.discardPile.findIndex(x => x.uid === cardUid)
        if (i >= 0) {
          const [c] = P.discardPile.splice(i, 1)
          P.hand.push(c)
        }
        set({ run: r, select: null })
        return
      }
      // ---- 涅奥祝福选牌（联机：作用于选择者自己的牌组） ----
      if (select.kind === 'neowRemove') {
        const i = r.deck.findIndex(x => x.uid === cardUid)
        if (i >= 0) r.deck.splice(i, 1)
        r.players[owner].deck = r.deck
        // 第三祝福「移除 2 张」：顺序选择
        const left = (select.remaining || 1) - 1
        if (left > 0 && r.players[owner].deck.length > 0) {
          set({ run: r, select: {
            kind: 'neowRemove', title: `涅奥：${r.players[owner].name} 选择要移除的牌（还剩 ${left} 张）`,
            cardUids: r.players[owner].deck.map(c => c.uid), source: 'deck', owner, remaining: left,
          } })
          return
        }
        finishNeowSelect(r, owner, select.remaining ? '涅奥净化了两张牌' : '涅奥净化了一张牌')
        return
      }
      if (select.kind === 'neowUpgrade') {
        const c = r.deck.find(x => x.uid === cardUid)
        if (c) c.upgraded = Math.max(1, c.upgraded)
        r.players[owner].deck = r.deck
        finishNeowSelect(r, owner, '涅奥锤炼了一张牌')
        return
      }
      if (select.kind === 'neowTransform') {
        const c = r.deck.find(x => x.uid === cardUid)
        if (c) {
          const newId = transformCardId(r, c.id)
          c.id = newId
          c.upgraded = 0
        }
        r.players[owner].deck = r.deck
        // 第三祝福「转化 2 张」：顺序选择
        const left = (select.remaining || 1) - 1
        if (left > 0 && r.players[owner].deck.length > 0) {
          set({ run: r, select: {
            kind: 'neowTransform', title: `涅奥：${r.players[owner].name} 选择要转化的牌（还剩 ${left} 张）`,
            cardUids: r.players[owner].deck.map(c => c.uid), source: 'deck', owner, remaining: left,
          } })
          return
        }
        finishNeowSelect(r, owner, select.remaining ? '涅奥改变了你的命运（2 张）' : '涅奥改变了你的命运')
        return
      }
      if (select.kind === 'neowGainCard') {
        // 第一/第三祝福：从提供的卡中获得选中的一张
        const c = select.offerCards?.find(x => x.uid === cardUid)
        if (c) {
          r.deck.push({ ...c })
          r.players[owner].deck = r.deck
          finishNeowSelect(r, owner, `获得了「${CARDS[c.id]?.name ?? '卡牌'}」`)
        } else {
          finishNeowSelect(r, owner, '祝福已生效')
        }
        return
      }
      if (select.kind === 'neowDuplicate') {
        const c = r.deck.find(x => x.uid === cardUid)
        if (c) r.deck.push({ ...c, uid: `nd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` })
        r.players[owner].deck = r.deck
        finishNeowSelect(r, owner, '涅奥复制了一张牌')
        return
      }

      if (select.kind === 'armaments' && combat) {
        const c = AP(combat).hand.find(x => x.uid === cardUid)
        if (c) c.upgraded = Math.max(1, c.upgraded)
      } else if (select.kind === 'headbutt' && combat) {
        const P = AP(combat)
        const i = P.discardPile.findIndex(x => x.uid === cardUid)
        if (i >= 0) {
          const [c] = P.discardPile.splice(i, 1)
          P.drawPile.push(c)
        }
      } else if (select.kind === 'warcry' && combat) {
        const P = AP(combat)
        const i = P.hand.findIndex(x => x.uid === cardUid)
        if (i >= 0) {
          const [c] = P.hand.splice(i, 1)
          P.drawPile.push(c)
        }
      } else if (select.kind === 'trueGrit' && combat) {
        const P = AP(combat)
        const c = P.hand.find(x => x.uid === cardUid)
        if (c) exhaustCard(combat, r, c, 'hand')
      } else if (select.kind === 'eventRemove' || select.kind === 'shopRemove' || select.kind === 'sacrifice') {
        const i = r.deck.findIndex(x => x.uid === cardUid)
        if (i >= 0) r.deck.splice(i, 1)
        if (select.kind === 'shopRemove') {
          r.gold -= r.shop!.removalPrice
          r.shop!.removalUsed = true
          r.removalCount += 1
        }
        r.players[owner].deck = r.deck
        r.players[owner].gold = r.gold
      } else if (select.kind === 'eventUpgrade' || select.kind === 'restSmith') {
        const c = r.deck.find(x => x.uid === cardUid)
        if (c) c.upgraded = Math.max(1, c.upgraded)
        r.players[owner].deck = r.deck
        if (select.kind === 'restSmith') {
          // 联机：链式锻造下一位玩家
          const q = [...get().mpSmithQueue]
          if (q.length > 0) {
            const nextP = q.shift()!
            set({
              run: r, select: {
                kind: 'restSmith', title: `锻造：${r.players[nextP].name} 升级一张牌`,
                cardUids: r.players[nextP].deck.map(c => c.uid), source: 'deck', owner: nextP,
              },
              mpSmithQueue: q, toast: '锻造完成！',
            })
            setTimeout(() => { if (get().toast === '锻造完成！') set({ toast: null }) }, 1500)
            return
          }
          r.screen = 'map'
          set({ run: r, select: null, mpSmithQueue: [], toast: '锻造完成！卡牌已升级' })
          setTimeout(() => { if (get().toast === '锻造完成！卡牌已升级') set({ toast: null }) }, 2200)
          return
        }
      }
      set({ run: r, select: null })
    }),

    cancelSelect: () => {
      const { select } = get()
      // 涅奥祝福与必选流程不可取消（否则流程卡住）
      if (select && select.kind.startsWith('neow')) return
      if (select && (select.kind === 'restSmith' || select.kind === 'shopRemove')) return
      set({ select: null })
    },

    // 预见：确认弃牌
    resolveScry: fwd('resolveScry', (discardUids: string[]) => {
      const { run } = get()
      const combat0 = run?.combat
      const P0 = combat0 ? combat0.players[combat0.activeIdx] : null
      const n0 = P0?.pendingScry
      if (!run || !combat0 || !n0) return
      const r = clone(run)
      const combat = r.combat!
      const P = AP(combat)
      const n = n0
      // 抽牌堆末尾 n 张是即将抽到的
      const top = P.drawPile.slice(-n)
      P.drawPile = P.drawPile.slice(0, -n)
      top.forEach(c => {
        if (discardUids.includes(c.uid)) P.discardPile.push(c)
        else P.drawPile.push(c)
      })
      P.pendingScry = null
      P.scryDiscarded = []
      set({ run: r })
    }),

    openPile: (pile) => set({ pileView: pile }),
    closePile: () => set({ pileView: null }),

    takeGold: fwd('takeGold', () => {
      const { run } = get()
      if (!run?.reward || run.reward.gold === undefined) return
      const actor = actorIdx(run)
      const tag = run.players.length > 1 ? `gold_${actor}` : 'gold'
      if (run.reward.taken.includes(tag)) return
      const r = clone(run)
      setRunActive(r, actor)
      r.gold += r.reward!.gold!
      r.goldEarned += r.reward!.gold!
      r.players[actor].gold = r.gold
      r.players[actor].goldEarned = r.goldEarned
      r.reward!.taken.push(tag)
      set({ run: r })
    }),

    takeCard: fwd('takeCard', (cardId: string) => {
      const { run } = get()
      if (!run?.reward) return
      const mp = run.players.length > 1
      const actor = actorIdx(run)
      if (!mp) {
        // 原版规则：奖励只能选一张卡，选后其他卡不可再选
        const alreadyTook = run.reward.taken.some(t => t.startsWith('card_'))
        if (alreadyTook) { showToastSafe('已经选择过一张卡牌了'); return }
        if (run.reward.taken.includes('card_' + cardId)) return
        const r = clone(run)
        r.deck.push(makeCard(cardId))
        r.reward!.taken.push('card_' + cardId)
        set({ run: r })
        return
      }
      // 联机：每人从自己的三选一中挑一张
      const tag = `mpcard_${actor}`
      if (run.reward.taken.includes(tag)) { showToastSafe('你已经选择过卡牌了'); return }
      const offer = run.reward.mpCards?.[actor] || []
      if (!offer.includes(cardId)) return
      const r = clone(run)
      const card = makeCard(cardId)
      r.players[actor].deck.push(card)
      r.reward!.taken.push(tag)
      if (r.reward!.mpDone) r.reward!.mpDone[actor] = true
      set({ run: r })
    }),

    mpSkipCard: fwd('mpSkipCard', () => {
      const { run } = get()
      if (!run?.reward || run.players.length === 1) return
      const actor = actorIdx(run)
      const r = clone(run)
      if (r.reward!.mpDone) r.reward!.mpDone[actor] = true
      if (!r.reward!.taken.includes(`mpcard_${actor}`)) r.reward!.taken.push(`mpcard_${actor}`)
      set({ run: r })
    }),

    takePotion: fwd('takePotion', () => {
      const { run } = get()
      if (!run?.reward?.potion) return
      if (run.reward.taken.includes('potion')) return
      const actor = actorIdx(run)
      const r = clone(run)
      setRunActive(r, actor)
      if (addPotion(r, r.reward!.potion!)) {
        r.players[actor].potions = r.potions
        r.reward!.taken.push('potion')
        set({ run: r })
      } else {
        showToastSafe('药水栏已满')
      }
    }),

    takeRelic: fwd('takeRelic', () => {
      const { run } = get()
      if (!run?.reward?.relic) return
      if (run.reward.taken.includes('relic')) return
      const actor = actorIdx(run)
      const r = clone(run)
      setRunActive(r, actor)
      gainRelic(r, r.reward!.relic!)
      r.players[actor].relics = r.relics
      r.reward!.taken.push('relic')
      set({ run: r })
    }),

    proceedFromReward: fwd('proceedFromReward', () => {
      const { run } = get()
      if (!run) return
      const mp = run.players.length > 1
      if (mp && run.reward) {
        // 联机：全员确认后才能继续
        const actor = actorIdx(run)
        const r0 = clone(run)
        if (r0.reward!.mpDone) r0.reward!.mpDone[actor] = true
        else r0.reward!.mpDone = r0.players.map((_, i) => i === actor)
        set({ run: r0 })
        const alive = r0.players.map((p, i) => (p.hp > 0 && !p.dead ? i : -1)).filter(i => i >= 0)
        const allDone = alive.every(i => r0.reward!.mpDone?.[i])
        if (!allDone) {
          set({ run: r0, toast: '等待队友确认…' })
          setTimeout(() => { if (get().toast === '等待队友确认…') set({ toast: null }) }, 1800)
          return
        }
      }
      const wasBoss = run.combat?.isBoss
      if (wasBoss) {
        const r = clone(run)
        r.screen = 'bossRelic'
        const opts = bossRelicChoices(run)
        set({ run: r, bossOptions: opts })
        return
      }
      const r2 = clone(get().run!)
      r2.combat = null
      r2.reward = null
      r2.screen = 'map'
      set({ run: r2, fxList: [] })
    }),

    chooseBossRelic: fwd('chooseBossRelic', (id: string | null) => {
      const { run } = get()
      if (!run) return
      const actor = actorIdx(run)
      const r = clone(run)
      setRunActive(r, actor)
      if (id) {
        gainRelic(r, id)
        r.players[actor].relics = r.relics
      }
      // 第 1-3 幕：进入下一幕；第 4 幕：胜利
      if (r.act < 4) {
        advanceAct(r)
        r.nextActInfo = r.act
        set({ run: r, bossOptions: [] })
        return
      }
      r.gameOverInfo = {
        victory: true,
        floor: r.visitedNodes.length,
        monstersSlain: r.monsterKilled,
        elitesSlain: r.eliteKilled,
        goldEarned: r.players.reduce((a, p) => a + p.goldEarned, 0),
      }
      r.screen = 'victory'
      r.combat = null
      recordRunResult(r.players.map(p => p.character), true, r.visitedNodes.length, r.monsterKilled, r.eliteKilled, r.gameOverInfo.goldEarned)
      if (r.players.length === 1) clearSave()
      set({ run: r, bossOptions: [] })
    }),

    buyCard: fwd('buyCard', (idx: number) => {
      const { run } = get()
      if (!run?.shop) return
      const item = run.shop.cards[idx]
      if (!item || item.sold) return
      const actor = actorIdx(run)
      if (run.players[actor].gold < item.price) { showToastSafe('金币不足'); return }
      const r = clone(run)
      setRunActive(r, actor)
      r.gold -= item.price
      r.shop!.cards[idx].sold = true
      const card = makeCard(item.cardId)
      r.deck.push(card)
      r.players[actor].gold = r.gold
      r.players[actor].deck = r.deck
      set({ run: r })
    }),

    buyRelic: fwd('buyRelic', (idx: number) => {
      const { run } = get()
      if (!run?.shop) return
      const item = run.shop.relics[idx]
      if (!item || item.sold) return
      const actor = actorIdx(run)
      if (run.players[actor].gold < item.price) { showToastSafe('金币不足'); return }
      const r = clone(run)
      setRunActive(r, actor)
      r.gold -= item.price
      r.shop!.relics[idx].sold = true
      gainRelic(r, item.relicId)
      r.players[actor].gold = r.gold
      r.players[actor].relics = r.relics
      set({ run: r })
    }),

    buyPotion: fwd('buyPotion', (idx: number) => {
      const { run } = get()
      if (!run?.shop) return
      const item = run.shop.potions[idx]
      if (!item || item.sold) return
      const actor = actorIdx(run)
      if (!run.players[actor].potions.some(p => p === null)) { showToastSafe('药水栏已满'); return }
      if (run.players[actor].gold < item.price) { showToastSafe('金币不足'); return }
      const r = clone(run)
      setRunActive(r, actor)
      r.gold -= item.price
      r.shop!.potions[idx].sold = true
      addPotion(r, item.potionId)
      r.players[actor].gold = r.gold
      r.players[actor].potions = r.potions
      set({ run: r })
    }),

    buyRemoval: fwd('buyRemoval', () => {
      const { run } = get()
      if (!run?.shop) return
      const shop = run.shop
      if (shop.removalUsed) return
      const actor = actorIdx(run)
      if (run.players[actor].gold < shop.removalPrice) { showToastSafe('金币不足'); return }
      set({
        select: {
          kind: 'shopRemove', title: `移除一张牌（${shop.removalPrice} 金币）`,
          cardUids: run.players[actor].deck.map(c => c.uid), source: 'deck', owner: actor,
        },
      })
    }),

    leaveShop: fwd('leaveShop', () => {
      const { run } = get()
      if (!run) return
      const r = clone(run)
      r.shop = null
      r.screen = 'map'
      set({ run: r })
    }),

    restAction: fwd('restAction', (act: 'rest' | 'smith') => {
      const { run } = get()
      if (!run) return
      const actor = actorIdx(run)
      if (run.players.length > 1) {
        // 联机：记录选择，全员选好后统一结算
        if (run.mpRest && run.mpRest[actor]) return   // 已选过
        if (act === 'rest' && run.players[actor].relics.includes('coffeeDripper')) {
          showToastSafe('咖啡滴滤壶：无法在篝火休息'); return
        }
        const r = clone(run)
        r.mpRest = r.mpRest || r.players.map(() => null)
        r.mpRest[actor] = act
        set({ run: r })
        maybeResolveMpRest()
        return
      }
      if (act === 'rest') {
        if (run.relics.includes('coffeeDripper')) { showToastSafe('咖啡滴滤壶：无法在篝火休息'); return }
        const r = clone(run)
        const heal = Math.min(Math.floor(r.maxHp * 0.3), r.maxHp - r.hp)
        r.hp += heal
        r.screen = 'map'
        set({ run: r, toast: `休息回复了 ${heal} 点生命` })
        setTimeout(() => { if (get().toast?.includes('休息回复')) set({ toast: null }) }, 2200)
      } else {
        set({
          select: {
            kind: 'restSmith', title: '锻造：升级一张牌',
            cardUids: run.deck.map(c => c.uid), source: 'deck', owner: 0,
          },
        })
      }
    }),

    chooseEvent: fwd('chooseEvent', (idx: number) => {
      const { run, select } = get()
      if (!run?.currentEvent || select) return
      const actor = actorIdx(run)
      const ev = EVENTS_POOL[run.currentEvent]
      const choice = ev.choices[idx]
      // 先克隆再应用效果，避免直接突变 store 状态
      const r = clone(run)
      setRunActive(r, actor)
      const result: EventResult = applyEventEffect(r, ev.id, choice.effect)

      if (result.gold) {
        r.gold += result.gold
        r.goldEarned += Math.max(0, result.gold)
        r.players[actor].gold = r.gold
        r.players[actor].goldEarned = r.goldEarned
      }
      if (result.healPct) {
        const heal = Math.floor(r.maxHp * result.healPct)
        r.hp = Math.min(r.maxHp, r.hp + heal)
        r.players[actor].hp = r.hp
      }
      if (result.relic) {
        gainRelic(r, result.relic)
        r.players[actor].relics = r.relics
      }

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
        if (r.players[actor].deck.length > 0) {
          set({
            run: r,
            select: {
              kind: result.select === 'sacrifice' ? 'sacrifice' : 'eventRemove',
              title: result.select === 'sacrifice' ? '献祭：移除一张牌' : '选择要移除的牌',
              cardUids: r.players[actor].deck.map(c => c.uid), source: 'deck', owner: actor,
            },
            toast: result.msg || null,
          })
          if (result.msg) setTimeout(() => { if (get().toast === result.msg) set({ toast: null }) }, 2400)
        } else {
          set({ run: r })
        }
        return
      }
      if (result.select === 'upgrade') {
        r.currentEvent = null
        r.screen = 'map'
        if (r.players[actor].deck.length > 0) {
          set({
            run: r,
            select: {
              kind: 'eventUpgrade', title: '选择要升级的牌',
              cardUids: r.players[actor].deck.map(c => c.uid), source: 'deck', owner: actor,
            },
            toast: result.msg || null,
          })
          if (result.msg) setTimeout(() => { if (get().toast === result.msg) set({ toast: null }) }, 2400)
        } else {
          set({ run: r })
        }
        return
      }
      if (result.select === 'randomUpgrade') {
        const cands = r.players[actor].deck.filter(c => c.upgraded === 0 && c.id !== 'searingBlow')
        if (cands.length) cands[Math.floor(Math.random() * cands.length)].upgraded = 1
        r.players[actor].deck = r.deck
      }
      if (result.select === 'upgradeStrikeDefend') {
        r.deck.forEach(c => { if (c.id === 'strike' || c.id === 'defend') c.upgraded = Math.max(1, c.upgraded) })
        r.players[actor].deck = r.deck
      }

      r.currentEvent = null
      r.screen = 'map'
      set({ run: r, eventMsg: result.msg || null })
      setTimeout(() => set({ eventMsg: null }), 2000)
    }),

    takeTreasure: fwd('takeTreasure', () => {
      const { run } = get()
      if (!run) return
      const actor = actorIdx(run)
      const r = clone(run)
      setRunActive(r, actor)
      const owned = new Set(r.relics)
      const pool = Object.values(RELICS).filter(x => (x.rarity === 'common' || x.rarity === 'uncommon') && !owned.has(x.id))
      const relicId = pool.length ? pool[Math.floor(Math.random() * pool.length)].id : null
      if (relicId) {
        gainRelic(r, relicId)
        r.players[actor].relics = r.relics
      }
      r.screen = 'map'
      set({ run: r, toast: relicId ? `获得遗物：${RELICS[relicId].name}` : '箱子是空的' })
      setTimeout(() => set({ toast: null }), 2200)
    }),

    removeFx: (id) => set(s => ({ fxList: s.fxList.filter(f => f.id !== id) })),
    showToast: (msg) => showToastSafe(msg),

    // ============ 联机大厅 ============
    netCreateRoom: (name) => {
      net.host(name).then(() => {
        set(s => ({ menuScreen: 'mpLobby', net: { ...s.net, role: 'host', status: 'waiting', roomCode: net.roomCode, myName: name, myIdx: 0 } }))
      }).catch(err => {
        net.toastError(String(err?.message || err))
      })
    },

    netJoinRoom: (name, code) => {
      net.join(name, code.trim().toUpperCase()).then(() => {
        set(s => ({ menuScreen: 'mpLobby', net: { ...s.net, role: 'guest', status: 'connected', connected: true, myIdx: 1, myName: name } }))
      }).catch(err => {
        net.toastError(String(err?.message || err))
      })
    },

    netLeave: () => {
      net.leave()
      set(s => ({
        run: null, menuScreen: 'title', menuOpen: false, busy: false, fxList: [], select: null, pileView: null,
        selectedCardUid: null, selectedPotionIdx: null, eventMsg: null, bossOptions: [], toast: null, endBanner: null,
        mpSmithQueue: [],
        net: { ...EMPTY_NET, myName: s.net.myName },
      }))
    },

    lobbyPickChar: (c) => {
      const { net: n } = get()
      if (n.role === 'host') {
        set(s => ({ net: { ...s.net, lobby: { ...s.net.lobby, hostChar: c } }, selectedCharacter: c }))
        net.send({ t: 'lobby', lobby: get().net.lobby })
      } else if (n.role === 'guest') {
        set(s => ({ net: { ...s.net, lobby: { ...s.net.lobby, guestChar: c } }, selectedCharacter: c }))
        net.send({ t: 'lobby', lobby: { hostChar: null, guestChar: c } })
      }
    },

    lobbyStart: () => {
      const { net: n } = get()
      if (n.role !== 'host' || !n.lobby.hostChar || !n.lobby.guestChar) return
      const run = newMultiRun(n.lobby.hostChar, n.lobby.guestChar, n.myName, n.peerName || '队友')
      set({
        run, menuScreen: 'title', menuOpen: false, busy: false, fxList: [], select: null, pileView: null,
        selectedCardUid: null, selectedPotionIdx: null, eventMsg: null, bossOptions: [], toast: null, endBanner: null,
        mpSmithQueue: [],
      })
    },
  }

  // 联机涅奥选牌收尾（在 resolveSelect 中调用，需访问 store 内部函数）
  function finishNeowSelect(r: RunState, owner: number, msg: string) {
    if (r.players.length > 1) {
      advanceNeow(r)
      set({ run: r, select: null, toast: msg })
    } else {
      r.screen = 'map'
      set({ run: r, select: null, toast: msg })
    }
    setTimeout(() => { if (get().toast === msg) set({ toast: null }) }, 2200)
  }
})

// ============ 联机网络集成（模块级，只注册一次） ============
let netInited = false
function initNet() {
  if (netInited) return
  netInited = true

  net.onState(s => {
    useGame.setState(st => ({ net: { ...st.net, ...s } }))
  })

  net.onMessage((msg: NetMsg) => {
    const st = useGame.getState()
    switch (msg.t) {
      case 'hello':   // 房主收到客机打招呼
        useGame.setState(s => ({ net: { ...s.net, peerName: msg.name, status: 'connected', connected: true } }))
        net.send({ t: 'welcome', hostName: st.net.myName })
        net.send({ t: 'lobby', lobby: st.net.lobby })
        break
      case 'welcome': // 客机收到房主回应
        useGame.setState(s => ({ net: { ...s.net, peerName: msg.hostName } }))
        break
      case 'lobby':
        if (st.net.role === 'host') {
          // 客机发来的部分状态（角色选择）
          useGame.setState(s => ({ net: { ...s.net, lobby: { ...s.net.lobby, guestChar: msg.lobby.guestChar ?? s.net.lobby.guestChar } } }))
          net.send({ t: 'lobby', lobby: useGame.getState().net.lobby })
        } else {
          useGame.setState(s => ({ net: { ...s.net, lobby: msg.lobby } }))
        }
        break
      case 'act': {   // 房主执行客机转发的动作
        setPendingActor(1)
        try {
          const fn = (useGame.getState() as unknown as Record<string, (...a: unknown[]) => void>)[msg.fn]
          if (typeof fn === 'function') fn(...msg.args)
        } catch (err) {
          console.error('[net] 远端动作执行失败:', msg.fn, err)
        } finally {
          setPendingActor(null)
        }
        break
      }
      case 'snap': {  // 客机应用房主快照
        if (st.net.role !== 'guest') break
        applyNetSnapshot(msg)
        break
      }
      case 'left':
        handleDisconnect(msg.reason)
        break
    }
  })
}

function applyNetSnapshot(msg: Extract<NetMsg, { t: 'snap' }>) {
  const st = useGame.getState()
  const run = msg.run as RunState
  if (!run) return
  // fx 合并（按 id 去重）
  const incomingFx: FxItem[] = ((msg as unknown as { fxList?: FxItem[] }).fxList || []).map(f => ({ ...f, ts: Date.now() }))
  const seen = new Set(st.fxList.map(f => f.id))
  const newFx = incomingFx.filter(f => !seen.has(f.id))
  const runClone = structuredClone(run)
  if (runClone.combat) runClone.combat.fx = []
  useGame.setState({
    run: runClone,
    select: (msg.select as SelectState | null) ?? null,
    busy: msg.busy,
    endBanner: msg.endBanner as 'win' | 'lose' | null,
    fxList: [...st.fxList, ...newFx].slice(-40),
    toast: msg.toast ?? null,
    selectedCardUid: ((msg as unknown as { selectedCardUid?: string | null }).selectedCardUid) ?? null,
  })
}

function handleDisconnect(reason: string) {
  const st = useGame.getState()
  if (st.net.role === 'guest') {
    // 客机：返回标题并提示
    net.cleanup()
    useGame.setState(s => ({
      run: null, menuScreen: 'title', busy: false, fxList: [], select: null,
      selectedCardUid: null, selectedPotionIdx: null, endBanner: null, menuOpen: false, mpSmithQueue: [],
      net: { ...EMPTY_NET, myName: s.net.myName },
      toast: reason || '与房主的连接已断开',
    }))
    setTimeout(() => { if (useGame.getState().toast?.includes('断开')) useGame.setState({ toast: null }) }, 3200)
    return
  }
  // 房主：队友断线 → 标记阵亡继续单人；若正轮到队友行动则自动结束其回合
  if (st.run && st.run.players.length > 1) {
    const r = structuredClone(st.run)
    r.players[1].dead = true
    if (r.players[1].hp > 0) r.players[1].hp = 0
    if (r.combat) {
      r.combat.players[1].dead = true
      r.combat.acted[1] = true
    }
    useGame.setState({ run: r, toast: '队友已断线，其角色阵亡', net: { ...st.net, connected: false, status: 'waiting' } })
    setTimeout(() => { if (useGame.getState().toast === '队友已断线，其角色阵亡') useGame.setState({ toast: null }) }, 3000)
    // 若停留在队友回合 → 自动继续
    if (r.combat && r.combat.phase === 'player' && r.combat.activeIdx === 1 && !r.combat.combatOver) {
      setPendingActor(1)
      useGame.getState().endTurn()
      setPendingActor(null)
    }
    return
  }
  // 大厅中断线
  useGame.setState(s => ({
    net: { ...s.net, connected: false, status: 'waiting', peerName: '', lobby: { hostChar: s.net.lobby.hostChar, guestChar: null } },
    toast: '对方已离开房间',
  }))
  setTimeout(() => { if (useGame.getState().toast === '对方已离开房间') useGame.setState({ toast: null }) }, 2600)
}

// ============ 房主快照广播 + 单机自动存档（订阅驱动） ============
let snapTimer: ReturnType<typeof setTimeout> | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let lastSnapJson = ''

function scheduleSnap() {
  if (snapTimer) return
  snapTimer = setTimeout(() => {
    snapTimer = null
    const s = useGame.getState()
    if (s.net.role !== 'host' || !s.net.connected || !s.run) return
    const runClone = consistentRun(structuredClone(s.run))
    if (runClone.combat) {
      runClone.combat.fx = []
      runClone.combat.log = []
    }
    const snap: Record<string, unknown> & NetMsg = {
      t: 'snap', run: runClone, select: s.select, busy: s.busy,
      endBanner: s.endBanner, toast: s.toast, fxList: s.fxList.slice(-24),
      selectedCardUid: s.selectedCardUid,
    }
    const json = JSON.stringify(snap)
    if (json === lastSnapJson) return
    lastSnapJson = json
    net.send(snap as NetMsg)
  }, 50)
}

function scheduleSave() {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    const s = useGame.getState()
    if (s.net.role || !s.run) return
    if (s.run.screen === 'gameover' || s.run.screen === 'victory') { clearSave(); return }
    if (saveableMoment(s.run)) saveRun(s.run, s.select, s.bossOptions)
  }, 400)
}

if (typeof window !== 'undefined') {
  initNet()
  useGame.subscribe(() => {
    const s = useGame.getState()
    if (s.net.role === 'host' && s.net.connected) scheduleSnap()
    else if (!s.net.role && s.run) scheduleSave()
  })
}

// 调试钩子（浏览器控制台可通过 __sts 访问游戏状态）
if (typeof window !== 'undefined') {
  ;(window as any).__sts = useGame
  ;(window as any).__STS_CARDS = CARDS
  ;(window as any).__STS_COST = cardCost
  ;(window as any).__STS_EVENTS = EVENTS_POOL
}

