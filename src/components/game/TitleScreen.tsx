'use client'
// ============ 标题界面 ============
import { useGame } from '@/store/gameStore'

const A = '/assets'

export function TitleScreen() {
  const startRun = useGame(s => s.startRun)

  return (
    <div
      className="w-full h-full relative flex flex-col items-center justify-center gap-6 select-none overflow-hidden"
      style={{
        backgroundImage: `url(${A}/bg/combat.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 20%',
      }}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(6,3,2,0.55)' }} />
      <div className="relative flex flex-col items-center gap-2">
        <img
          src={`${A}/hero/ironclad.png`}
          alt="铁甲战士"
          width={320}
          height={228}
          draggable={false}
          style={{ filter: 'drop-shadow(0 14px 22px rgba(0,0,0,0.8))' }}
        />
        <h1
          className="sts-title"
          style={{
            fontSize: 84,
            color: '#ffd980',
            textShadow: '4px 4px 0 #000, 0 0 80px rgba(255,180,60,0.45)',
            letterSpacing: 8,
          }}
        >
          杀戮尖塔
        </h1>
        <div className="sts-title" style={{ fontSize: 22, color: '#c8a878', textShadow: '2px 2px 0 #000', letterSpacing: 4 }}>
          —— SLAY THE SPIRE · WEB 复刻版 ——
        </div>
      </div>

      <div className="relative flex flex-col items-center gap-4 mt-4">
        <button
          className="sts-btn sts-title"
          style={{ fontSize: 30, padding: '14px 64px' }}
          onClick={startRun}
        >
          开始攀登
        </button>
        <div className="sts-body text-center" style={{ color: '#a89070', fontSize: 14, lineHeight: 1.9, maxWidth: 460 }}>
          扮演<span style={{ color: '#ff9a70' }}>铁甲战士</span>，征服第一幕的尖塔。<br />
          60+ 张卡牌 · 26 件遗物 · 14 种药水 · 15 种敌人 · 3 位首领
        </div>
      </div>
    </div>
  )
}
