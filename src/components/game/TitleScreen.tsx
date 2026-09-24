'use client'
// ============ 标题界面：角色选择 + GitHub 入口 ============
import { useGame } from '@/store/gameStore'
import { CHARACTER_INFO } from '@/game/run'
import { CharacterId } from '@/game/types'
import { useState } from 'react'

const A = '/assets'

// GitHub 图标（内联 SVG，不依赖外链）
export function GitHubIcon({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

const CHARACTERS: CharacterId[] = ['ironclad', 'silent', 'defect', 'watcher']

const CHAR_BORDER: Record<CharacterId, string> = {
  ironclad: '#b03828',
  silent: '#3a9a5a',
  defect: '#3a7ac8',
  watcher: '#9a5ab8',
}

export function TitleScreen() {
  const startRun = useGame(s => s.startRun)
  const selectedCharacter = useGame(s => s.selectedCharacter)
  const selectCharacter = useGame(s => s.selectCharacter)
  const [hoverInfo, setHoverInfo] = useState<CharacterId | null>(null)
  const info = CHARACTER_INFO[hoverInfo || selectedCharacter]

  return (
    <div
      className="w-full h-full relative flex flex-col items-center justify-center gap-5 select-none overflow-hidden sts-screen-fade"
      style={{
        backgroundImage: `url(${A}/bg/combat.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 20%',
      }}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(6,3,2,0.55)' }} />
      <div className="relative flex flex-col items-center gap-1">
        <h1
          className="sts-title"
          style={{
            fontSize: 74,
            color: '#ffd980',
            textShadow: '4px 4px 0 #000, 0 0 80px rgba(255,180,60,0.45)',
            letterSpacing: 8,
          }}
        >
          杀戮尖塔
        </h1>
        <div className="sts-title" style={{ fontSize: 20, color: '#c8a878', textShadow: '2px 2px 0 #000', letterSpacing: 4 }}>
          —— SLAY THE SPIRE · WEB 复刻版 ——
        </div>
      </div>

      {/* ===== 角色选择 ===== */}
      <div className="relative flex items-end justify-center gap-6" style={{ marginTop: 6 }}>
        {CHARACTERS.map(cid => {
          const c = CHARACTER_INFO[cid]
          const active = selectedCharacter === cid
          return (
            <button
              key={cid}
              className="relative flex flex-col items-center transition-transform"
              style={{
                transform: active ? 'translateY(-10px) scale(1.08)' : 'none',
                filter: active ? 'drop-shadow(0 0 18px rgba(255,200,80,0.45))' : 'brightness(0.75) drop-shadow(0 8px 10px rgba(0,0,0,0.7))',
                transition: 'transform .18s ease, filter .18s ease',
              }}
              onClick={() => selectCharacter(cid)}
              onMouseEnter={() => setHoverInfo(cid)}
              onMouseLeave={() => setHoverInfo(null)}
            >
              <img
                src={`${A}/hero/${c.sprite}.png`}
                alt={c.name}
                width={190}
                height={135}
                draggable={false}
                style={{
                  objectFit: 'contain',
                  borderRadius: 12,
                  border: active ? `3px solid ${CHAR_BORDER[cid]}` : '3px solid transparent',
                  background: 'radial-gradient(ellipse at 50% 70%, rgba(40,26,14,0.9), rgba(10,6,4,0.95))',
                }}
              />
              <div
                className="sts-title"
                style={{
                  fontSize: 19, marginTop: 8, letterSpacing: 2,
                  color: active ? '#ffd980' : '#a89070',
                  textShadow: '2px 2px 0 #000',
                }}
              >
                {c.name}
              </div>
            </button>
          )
        })}
      </div>

      {/* ===== 选中角色信息 ===== */}
      <div className="relative sts-body text-center" style={{ color: '#c8b090', fontSize: 14, lineHeight: 1.8, maxWidth: 560, minHeight: 44 }}>
        <span style={{ color: '#ffd980' }}>{info.name}</span> · {info.desc}<br />
        生命值 <span style={{ color: '#ff8a7a' }}>{info.hp}</span> · 初始遗物：<span style={{ color: '#9ad8f0' }}>「{info.nameEn}」专属</span> · 全 4 幕 · 4 位角色 · 200+ 卡牌 · 45+ 怪物 · 12 首领
      </div>

      <button
        className="sts-btn sts-title relative"
        style={{ fontSize: 28, padding: '12px 64px' }}
        onClick={() => startRun()}
      >
        开始攀登
      </button>

      {/* ===== GitHub 入口（右下角） ===== */}
      <a
        href="https://github.com/43aquarius/webslaythespire"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute flex items-center gap-2 sts-body"
        style={{
          right: 22, bottom: 18, zIndex: 60,
          color: '#c8b090', fontSize: 14, textDecoration: 'none',
          background: 'rgba(20,12,8,0.72)',
          border: '1.5px solid #5a4230',
          borderRadius: 10, padding: '8px 14px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
        }}
        title="GitHub 仓库"
      >
        <GitHubIcon size={20} />
        <span>43aquarius/webslaythespire</span>
      </a>
    </div>
  )
}
