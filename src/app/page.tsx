'use client'
// ============ 主入口：界面路由 + 全局键盘快捷键 ============
// 快捷键（还原原版）：1-9 出牌 / E·空格·回车 结束回合 / Esc 菜单
import { useEffect, useRef, useState } from 'react'
import { useGame } from '@/store/gameStore'
import { Stage } from '@/components/game/Stage'
import { MainMenuScreen, CharacterSelectScreen, SettingsScreen, StatsScreen, CreditsScreen } from '@/components/game/MenuScreens'
import { MultiplayerScreen } from '@/components/game/MultiplayerScreen'
import { MapScreen } from '@/components/game/MapScreen'
import { CombatScreen } from '@/components/game/CombatScreen'
import { RewardScreen, BossRelicScreen, RestScreen, TreasureScreen, GameOverScreen } from '@/components/game/RewardScreen'
import { ShopScreen, EventScreen } from '@/components/game/ShopScreen'
import { NeowScreen } from '@/components/game/NeowScreen'
import { PileViewOverlay, CardSelectOverlay, ToastView, UpgradeVfxOverlay } from '@/components/game/Overlays'
import { MusicPlayer } from '@/components/game/MusicPlayer'
import { InGameMenu } from '@/components/game/InGameMenu'
import { ActTransition } from '@/components/game/RewardScreen'
import { AP } from '@/game/engine'
import { CARDS } from '@/game/cards'

// ============ 房间切换过渡（原版 NTransition） ============
// RoomFadeOut：0.5s 停顿 → 0.6s 软边黑幕自上扫落 + 平黑淡入（旧画面保持可见）
// 全黑瞬间切换画面；RoomFadeIn：0.8s 平黑淡出
const ROOM_FADE_OUT_MS = 1100, ROOM_FADE_IN_MS = 800
function useRoomFade(actual: string): { shown: string; phase: 'none' | 'out' | 'in'; seq: number } {
  const [state, setState] = useState({ shown: actual, phase: 'none' as 'none' | 'out' | 'in', seq: 0 })
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => {
    if (actual === state.shown) return
    if (state.phase === 'in') {
      // 淡入途中再次切换：直接换画面并重播淡入（黑幕基本不透明，视觉平滑）
      setState(s => ({ shown: actual, phase: 'in', seq: s.seq + 1 }))
      return
    }
    timers.current.forEach(clearTimeout); timers.current = []
    setState(s => ({ shown: s.shown, phase: 'out', seq: s.seq + 1 }))
    timers.current.push(setTimeout(() => {
      setState(s => ({ shown: actual, phase: 'in', seq: s.seq + 1 }))
    }, ROOM_FADE_OUT_MS))
    timers.current.push(setTimeout(() => {
      setState(s => (s.phase === 'in' ? { ...s, phase: 'none' } : s))
    }, ROOM_FADE_OUT_MS + ROOM_FADE_IN_MS))
  }, [actual]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  return state
}

export default function Home() {
  const run = useGame(s => s.run)
  const menuScreen = useGame(s => s.menuScreen)

  // 根据 run 的 screen 决定显示内容；无 run 时按 menuScreen 路由
  const actual = run ? run.screen : menuScreen
  // 房间过渡期间渲染旧画面，黑幕全黑后再切换
  const { shown, phase, seq } = useRoomFade(actual)

  // ===== 全局键盘快捷键 =====
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useGame.getState()
      const target = e.target as HTMLElement
      // 输入框中不拦截
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      const combat = s.run?.combat

      // Esc：关闭遮罩/菜单（检视层打开时由检视组件自行处理；关闭任一遮罩后不再触发菜单）
      if (e.key === 'Escape') {
        if (document.body.dataset.stsInspect) return
        if (s.pileView) { s.closePile(); e.stopImmediatePropagation(); return }
        if (s.selectedCardUid !== null || s.selectedPotionIdx !== null) { s.cancelSelection(); e.stopImmediatePropagation(); return }
        if (s.select && !s.select.kind.startsWith('neow') && s.select.kind !== 'restSmith' && s.select.kind !== 'shopRemove') { s.cancelSelect(); e.stopImmediatePropagation(); return }
        return
      }
      if (!combat || combat.phase !== 'player' || combat.combatOver || s.busy) return
      const P = AP(combat)

      // 1-9：打出第 N 张手牌（仅自己的回合）
      if (/^[1-9]$/.test(e.key)) {
        const idx = Number(e.key) - 1
        const card = P.hand[idx]
        if (!card) return
        if (combat.players.length > 1 && s.net.myIdx !== combat.activeIdx) return
        const def = CARDS[card.id]
        const living = combat.enemies.filter(en => !en.dying && en.hp > 0)
        if (def.target === 'enemy' && living.length > 1) {
          // 多目标：仅选中，等待点击敌人
          s.clickCard(card.uid)
          return
        }
        s.playCard(card.uid, def.target === 'enemy' ? living[0]?.uid ?? null : null)
        return
      }
      // E / 空格 / 回车：结束回合
      if (e.key === 'e' || e.key === 'E' || e.key === ' ' || e.key === 'Enter') {
        if (combat.players.length > 1 && s.net.myIdx !== combat.activeIdx) return
        e.preventDefault()
        s.endTurn()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Stage>
      <div className="w-full h-full relative">
        {/* ===== 主菜单系列（无 run） ===== */}
        {shown === 'title' && <MainMenuScreen />}
        {shown === 'charSelect' && <CharacterSelectScreen />}
        {shown === 'mpLobby' && <MultiplayerScreen />}
        {shown === 'stats' && <StatsScreen />}
        {shown === 'settings' && <SettingsScreen />}
        {shown === 'credits' && <CreditsScreen />}
        {/* ===== 游戏画面（有 run） ===== */}
        {shown === 'neow' && <NeowScreen />}
        {shown === 'map' && <MapScreen />}
        {shown === 'combat' && <CombatScreen />}
        {shown === 'reward' && <RewardScreen />}
        {shown === 'shop' && <ShopScreen />}
        {shown === 'rest' && <RestScreen />}
        {shown === 'treasure' && <TreasureScreen />}
        {shown === 'event' && <EventScreen />}
        {shown === 'bossRelic' && <BossRelicScreen />}
        {(shown === 'gameover' || shown === 'victory') && <GameOverScreen />}
        {shown === 'actTransition' && <ActTransition />}
        {/* 房间切换黑幕（原版 NTransition：软边黑幕扫落 + 平黑淡入/淡出；key 确保重触发） */}
        {phase !== 'none' && (
          <div key={`rf-${seq}`} className={`sts-room-fade ${phase}`}>
            <div className="rf-sweep" />
            <div className="rf-black" />
          </div>
        )}
        {/* 遮罩层 */}
        {run && <PileViewOverlay />}
        {run && <CardSelectOverlay />}
        <UpgradeVfxOverlay />
        <ToastView />
        {/* BGM 控制（舞台内右上角） */}
        <MusicPlayer />
        {/* 游戏内菜单（齿轮 + Esc） */}
        <InGameMenu />
      </div>
    </Stage>
  )
}
