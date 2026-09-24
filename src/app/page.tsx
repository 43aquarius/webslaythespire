'use client'
// ============ 主入口：界面路由 ============
import { useGame } from '@/store/gameStore'
import { TitleScreen } from '@/components/game/TitleScreen'
import { MapScreen } from '@/components/game/MapScreen'
import { CombatScreen } from '@/components/game/CombatScreen'
import { RewardScreen, BossRelicScreen, RestScreen, TreasureScreen, GameOverScreen } from '@/components/game/RewardScreen'
import { ShopScreen, EventScreen } from '@/components/game/ShopScreen'
import { PileViewOverlay, CardSelectOverlay, ToastView } from '@/components/game/Overlays'

export default function Home() {
  const run = useGame(s => s.run)
  const screen = useGame(s => s.screen)

  // 根据 run 的 screen 决定显示内容
  const cur = run ? run.screen : 'title'

  return (
    <main className="w-screen h-screen overflow-hidden" style={{ background: '#0a0604' }}>
      <div className="w-full h-full relative">
        {cur === 'title' && <TitleScreen />}
        {cur === 'map' && <MapScreen />}
        {cur === 'combat' && <CombatScreen />}
        {cur === 'reward' && <RewardScreen />}
        {cur === 'shop' && <ShopScreen />}
        {cur === 'rest' && <RestScreen />}
        {cur === 'treasure' && <TreasureScreen />}
        {cur === 'event' && <EventScreen />}
        {cur === 'bossRelic' && <BossRelicScreen />}
        {(cur === 'gameover' || cur === 'victory') && <GameOverScreen />}
        {/* 遮罩层 */}
        {run && <PileViewOverlay />}
        {run && <CardSelectOverlay />}
        <ToastView />
      </div>
    </main>
  )
}
