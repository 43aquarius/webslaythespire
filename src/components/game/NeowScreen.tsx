'use client'
// ============ 涅奥祝福界面（大鲸鱼；联机：双人顺序选择） ============
import { useGame } from '@/store/gameStore'

const A = '/assets'

export function NeowScreen() {
  const run = useGame(s => s.run)
  const chooseNeow = useGame(s => s.chooseNeow)
  const net = useGame(s => s.net)
  if (!run?.neow) return null
  const mp = run.players.length > 1
  const chooserIdx = mp ? (run.neow.chooserIdx ?? 0) : 0
  const isMyChoice = !mp || chooserIdx === net.myIdx
  const chosen = mp ? run.neow.mpChosen?.[chooserIdx] ?? null : run.neow.chosen
  const options = mp ? (run.neow.mpOptions?.[chooserIdx] ?? []) : run.neow.options
  const chooserName = mp ? run.players[chooserIdx]?.name : ''

  return (
    <div
      className="w-full h-full relative flex flex-col items-center justify-center select-none overflow-hidden sts-screen-fade"
      style={{
        backgroundImage: `url(${A}/bg/map.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 30%',
      }}
    >
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(4,4,10,0.82) 0%, rgba(8,6,14,0.62) 45%, rgba(4,4,10,0.86) 100%)' }} />

      {/* 大鲸鱼 */}
      <div className="relative flex items-center justify-center" style={{ marginBottom: 8 }}>
        <img
          src={`${A}/neow/neow.png`}
          alt="涅奥"
          draggable={false}
          className="sts-neow-float"
          style={{
            width: 620, maxWidth: '46vw', objectFit: 'contain',
            filter: 'drop-shadow(0 24px 40px rgba(0,0,0,0.9)) drop-shadow(0 0 60px rgba(90,140,255,0.25))',
          }}
        />
      </div>

      <div className="relative sts-title" style={{ fontSize: 44, color: '#b8d0ff', textShadow: '3px 3px 0 #000, 0 0 50px rgba(80,120,255,0.5)', letterSpacing: 6 }}>
        涅奥
      </div>
      <div className="relative sts-body text-center" style={{ color: '#a8b8d8', fontSize: 16, lineHeight: 1.9, maxWidth: 640, marginTop: 6, marginBottom: 22, textShadow: '1px 1px 0 #000' }}>
        巨鲸涅奥在尖塔脚下苏醒。<br />
        {mp
          ? (isMyChoice
            ? `「${run.players[chooserIdx]?.name}，轮到你了——选择你的祝福。」`
            : `「${chooserName} 正在选择祝福…」`)
          : <>「<span style={{ color: '#ffd980' }}>{CHARACTER_GREETING(run.character)}</span>，我将赐予你一份祝福——选择吧。」</>}
      </div>

      {/* 联机等待提示 */}
      {mp && !isMyChoice && (
        <div className="relative sts-title flex items-center gap-3" style={{ fontSize: 22, color: '#ffe9a0', marginBottom: 20 }}>
          <span className="sts-wait-dot">●</span> 等待 {chooserName} 选择祝福…
        </div>
      )}

      {/* 四个祝福选项 */}
      <div className="relative flex items-stretch justify-center gap-4 flex-wrap" style={{ maxWidth: 1160 }}>
        {options.map((opt, i) => {
          const picked = chosen === opt.id
          const disabled = !!chosen || (mp && !isMyChoice)
          return (
            <button
              key={opt.id}
              disabled={disabled}
              onClick={() => chooseNeow(i)}
              className="sts-neow-option"
              style={{
                width: 262,
                padding: '16px 16px',
                borderRadius: 12,
                cursor: disabled ? 'default' : 'pointer',
                background: picked
                  ? 'linear-gradient(170deg, rgba(60,90,170,0.55) 0%, rgba(20,30,70,0.85) 100%)'
                  : 'linear-gradient(170deg, rgba(34,28,52,0.9) 0%, rgba(16,12,30,0.94) 100%)',
                border: picked ? '2px solid #9ab8ff' : '2px solid #4a4266',
                boxShadow: picked ? '0 0 26px rgba(120,160,255,0.45)' : '0 6px 18px rgba(0,0,0,0.65)',
                opacity: disabled && !picked ? 0.45 : 1,
                transition: 'all .18s ease',
                transform: !disabled ? 'translateY(0)' : undefined,
              }}
              onMouseEnter={e => {
                if (disabled) return
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.borderColor = '#8aa0e8'
                e.currentTarget.style.boxShadow = '0 10px 26px rgba(0,0,0,0.7), 0 0 18px rgba(110,140,255,0.25)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.borderColor = '#4a4266'
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.65)'
              }}
            >
              <div className="sts-title" style={{ fontSize: 17, color: picked ? '#cfe0ff' : '#e8d8a8', textShadow: '1px 1px 0 #000', marginBottom: 8, lineHeight: 1.4 }}>
                {opt.title}
              </div>
              <div className="sts-body" style={{ fontSize: 14, color: '#b0bcd8', lineHeight: 1.6, textShadow: '1px 1px 0 #000' }}>
                {opt.desc}
              </div>
            </button>
          )
        })}
      </div>

      {chosen && (
        <div className="relative sts-body" style={{ color: '#8a96b8', fontSize: 13, marginTop: 18, textShadow: '1px 1px 0 #000' }}>
          涅奥的祝福已生效……（若需选牌，请在弹出的选牌界面中选择）
        </div>
      )}
    </div>
  )
}

function CHARACTER_GREETING(character: string): string {
  switch (character) {
    case 'silent': return '寂静猎手'
    case 'defect': return '故障机器人'
    case 'watcher': return '观者'
    default: return '铁甲战士'
  }
}
