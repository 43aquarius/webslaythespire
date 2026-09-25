'use client'
// ============ 主入口：界面路由 + 全局键盘快捷键 ============
// 快捷键（还原原版）：1-9 出牌 / E·空格·回车 结束回合 / Esc 菜单
import { useEffect } from 'react'
import { useGame } from '@/store/gameStore'
import { Stage } from '@/components/game/Stage'
import { MainMenuScreen, CharacterSelectScreen, SettingsScreen, StatsScreen, CreditsScreen } from '@/components/game/MenuScreens'
import { MultiplayerScreen } from '@/components/game/MultiplayerScreen'
import { MapScreen } from '@/components/game/MapScreen'
import { CombatScreen } from '@/components/game/CombatScreen'
import { RewardScreen, BossRelicScreen, RestScreen, TreasureScreen, GameOverScreen } from '@/components/game/RewardScreen'
import { ShopScreen, EventScreen } from '@/components/game/ShopScreen'
import { NeowScreen } from '@/components/game/NeowScreen'
import { PileViewOverlay, CardSelectOverlay, ToastView } from '@/components/game/Overlays'
import { MusicPlayer } from '@/components/game/MusicPlayer'
import { InGameMenu } from '@/components/game/InGameMenu'
import { ActTransition } from '@/components/game/RewardScreen'
import { AP } from '@/game/engine'
import { CARDS } from '@/game/cards'

export default function Home() {
  const run = useGame(s => s.run)
  const menuScreen = useGame(s => s.menuScreen)

  // 根据 run 的 screen 决定显示内容；无 run 时按 menuScreen 路由
  const cur = run ? run.screen : menuScreen

  // ===== 全局键盘快捷键 =====
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useGame.getState()
      const target = e.target as HTMLElement
      // 输入框中不拦截
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      const combat = s.run?.combat

      // Esc：关闭遮罩/菜单（游戏内菜单组件自行处理 Esc）
      if (e.key === 'Escape') {
        if (s.pileView) { s.closePile(); return }
        if (s.selectedCardUid !== null || s.selectedPotionIdx !== null) { s.cancelSelection(); return }
        if (s.select && !s.select.kind.startsWith('neow') && s.select.kind !== 'restSmith' && s.select.kind !== 'shopRemove') { s.cancelSelect(); return }
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
        {cur === 'title' && <MainMenuScreen />}
        {cur === 'charSelect' && <CharacterSelectScreen />}
        {cur === 'mpLobby' && <MultiplayerScreen />}
        {cur === 'stats' && <StatsScreen />}
        {cur === 'settings' && <SettingsScreen />}
        {cur === 'credits' && <CreditsScreen />}
        {/* ===== 游戏画面（有 run） ===== */}
        {cur === 'neow' && <NeowScreen />}
        {cur === 'map' && <MapScreen />}
        {cur === 'combat' && <CombatScreen />}
        {cur === 'reward' && <RewardScreen />}
        {cur === 'shop' && <ShopScreen />}
        {cur === 'rest' && <RestScreen />}
        {cur === 'treasure' && <TreasureScreen />}
        {cur === 'event' && <EventScreen />}
        {cur === 'bossRelic' && <BossRelicScreen />}
        {(cur === 'gameover' || cur === 'victory') && <GameOverScreen />}
        {cur === 'actTransition' && run && <ActTransition />}
        {/* 遮罩层 */}
        {run && <PileViewOverlay />}
        {run && <CardSelectOverlay />}
        <ToastView />
        {/* BGM 控制（舞台内右上角） */}
        <MusicPlayer />
        {/* 游戏内菜单（齿轮 + Esc） */}
        <InGameMenu />
      </div>
    </Stage>
  )
}
