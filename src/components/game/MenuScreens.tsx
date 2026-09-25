'use client'
// ============ 主菜单系列界面（参照原版布局还原） ============
// 主菜单（开始冒险/继续冒险/联机合作/统计/设置/制作名单）
// 角色选择（四角色站立 + 出发/返回）
import { useEffect, useState } from 'react'
import { useGame } from '@/store/gameStore'
import { CHARACTER_INFO } from '@/game/run'
import { CharacterId } from '@/game/types'
import { hasSave, loadStats, loadSettings, savePlayerName, saveMusicVolume, StatsData } from '@/game/persist'
import { RELICS } from '@/game/relics'
import { music } from '@/game/music'
import { GitHubIcon } from './TitleScreen'

const A = '/assets'

const CHARACTERS: CharacterId[] = ['ironclad', 'silent', 'defect', 'watcher']

const CHAR_BORDER: Record<CharacterId, string> = {
  ironclad: '#b03828',
  silent: '#3a9a5a',
  defect: '#3a7ac8',
  watcher: '#9a5ab8',
}

// ============ 原版风格主菜单 ============
export function MainMenuScreen() {
  const gotoMenuScreen = useGame(s => s.gotoMenuScreen)
  const continueRun = useGame(s => s.continueRun)
  const [canContinue, setCanContinue] = useState(false)
  useEffect(() => { setCanContinue(hasSave()) }, [])

  const items: { label: string; onClick: () => void; disabled?: boolean }[] = [
    { label: '开 始 冒 险', onClick: () => gotoMenuScreen('charSelect') },
    { label: '继 续 冒 险', onClick: () => continueRun(), disabled: !canContinue },
    { label: '联 机 合 作', onClick: () => gotoMenuScreen('mpLobby') },
    { label: '统　　计', onClick: () => gotoMenuScreen('stats') },
    { label: '设　　置', onClick: () => gotoMenuScreen('settings') },
    { label: '制 作 名 单', onClick: () => gotoMenuScreen('credits') },
  ]

  return (
    <div className="w-full h-full relative flex flex-col items-center justify-center select-none overflow-hidden sts-screen-fade">
      {/* 原版主视觉背景：尖塔剪影 */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${A}/bg/menu.jpg)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 38%',
        }}
      />
      <div className="main-menu-fog" />

      {/* 官方 Logo */}
      <div className="relative flex flex-col items-center" style={{ marginBottom: 30 }}>
        <img
          src={`${A}/bg/logo.png`}
          alt="Slay the Spire"
          draggable={false}
          className="menu-logo"
          style={{ width: 286 }}
        />
      </div>

      {/* 竖排菜单（原版石板按钮） */}
      <div className="relative flex flex-col items-center" style={{ gap: 13 }}>
        {items.map(it => (
          <button
            key={it.label}
            className="menu-item sts-title"
            style={{
              fontSize: 21,
              letterSpacing: 7,
              padding: '11px 0',
              width: 340,
              opacity: it.disabled ? 1 : undefined,
              cursor: it.disabled ? 'not-allowed' : 'pointer',
            }}
            disabled={it.disabled}
            onClick={it.onClick}
          >
            <span style={{ opacity: it.disabled ? 0.45 : 1, display: 'block' }}>{it.label}</span>
          </button>
        ))}
      </div>

      {/* 版本信息（左下角，原版样式） */}
      <div className="absolute sts-body" style={{ left: 16, bottom: 12, color: '#8a7458', fontSize: 12 }}>
        Web 复刻版 v1.6
      </div>

      {/* GitHub 入口（右下角） */}
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

// ============ 角色选择界面（原版：角色站立 + 信息 + 出发/返回） ============
export function CharacterSelectScreen() {
  const startRun = useGame(s => s.startRun)
  const gotoMenuScreen = useGame(s => s.gotoMenuScreen)
  const selectedCharacter = useGame(s => s.selectedCharacter)
  const selectCharacter = useGame(s => s.selectCharacter)
  const [hoverInfo, setHoverInfo] = useState<CharacterId | null>(null)
  const info = CHARACTER_INFO[hoverInfo || selectedCharacter]

  return (
    <div
      className="w-full h-full relative flex flex-col items-center justify-center gap-6 select-none overflow-hidden sts-screen-fade"
      style={{
        backgroundImage: `url(${A}/bg/menu.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 30%',
      }}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(6,3,2,0.5)' }} />

      <div className="relative sts-title" style={{ fontSize: 36, color: '#ffd980', textShadow: '3px 3px 0 #000', letterSpacing: 8, marginTop: 8 }}>
        选 择 你 的 角 色
      </div>

      {/* 角色立绘一排（原版站位：无框站立，选中发光） */}
      <div className="relative flex items-end justify-center gap-9" style={{ marginTop: 4 }}>
        {CHARACTERS.map(cid => {
          const c = CHARACTER_INFO[cid]
          const active = selectedCharacter === cid
          return (
            <button
              key={cid}
              className={`relative flex flex-col items-center char-stand ${active ? 'active' : ''}`}
              style={{
                transform: active ? 'translateY(-10px) scale(1.06)' : 'none',
                transition: 'transform .18s ease, filter .18s ease',
              }}
              onClick={() => selectCharacter(cid)}
              onMouseEnter={() => setHoverInfo(cid)}
              onMouseLeave={() => setHoverInfo(null)}
            >
              <img
                src={`${A}/hero/${c.sprite}.png`}
                alt={c.name}
                width={210}
                height={150}
                draggable={false}
                style={{ objectFit: 'contain' }}
              />
              <div
                className="sts-title"
                style={{
                  fontSize: 19, marginTop: 2, letterSpacing: 3,
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

      {/* 选中角色信息 */}
      <div className="relative sts-body text-center" style={{ color: '#c8b090', fontSize: 14, lineHeight: 1.8, maxWidth: 580, minHeight: 46 }}>
        <span style={{ color: '#ffd980' }}>{info.name}</span> · {info.desc}<br />
        生命值 <span style={{ color: '#ff8a7a' }}>{info.hp}</span> · 初始遗物「<span style={{ color: '#9ad8f0' }}>{RELICS[info.relic]?.name}</span>」 · 全 4 幕 · 220+ 卡牌 · 60+ 敌人 · 12 首领
      </div>

      {/* 底部按钮（原版：左侧返回、右侧出发） */}
      <div className="relative flex items-center gap-10">
        <button
          className="sts-btn sts-title"
          style={{ fontSize: 20, padding: '10px 44px', letterSpacing: 4 }}
          onClick={() => gotoMenuScreen('title')}
        >
          返 回
        </button>
        <button
          className="sts-btn sts-btn-gold sts-title"
          style={{ fontSize: 26, padding: '12px 72px', letterSpacing: 6 }}
          onClick={() => startRun()}
        >
          出 发
        </button>
      </div>
    </div>
  )
}

// ============ 设置界面 ============
export function SettingsScreen() {
  const gotoMenuScreen = useGame(s => s.gotoMenuScreen)
  const [vol, setVol] = useState(music.volume)
  const [muted, setMuted] = useState(music.muted)
  const [name, setName] = useState('')

  useEffect(() => {
    const s = loadSettings()
    setName(s.playerName)
  }, [])

  return (
    <div className="w-full h-full relative flex items-center justify-center sts-screen-fade"
      style={{ backgroundImage: `url(${A}/bg/combat.jpg)`, backgroundSize: 'cover', backgroundPosition: 'center 20%' }}>
      <div className="absolute inset-0" style={{ background: 'rgba(6,3,2,0.66)' }} />
      <div className="relative sts-panel flex flex-col items-center gap-5" style={{ padding: '36px 56px', maxWidth: 560 }}>
        <div className="sts-title" style={{ fontSize: 32, color: '#ffd980', letterSpacing: 6 }}>设 置</div>

        <div className="flex items-center gap-3 w-full">
          <span className="sts-body" style={{ color: '#c8b090', width: 110, fontSize: 15 }}>音乐音量</span>
          <input
            type="range" min={0} max={1} step={0.05} value={muted ? 0 : vol}
            onChange={e => {
              const v = Number(e.target.value)
              setVol(v); music.setVolume(v); music.setMuted(false); setMuted(false)
              saveMusicVolume(v)
            }}
            style={{ flex: 1, accentColor: '#c8a060' }}
          />
          <span className="sts-body" style={{ color: '#d8c8a8', width: 40, fontSize: 14 }}>{muted ? 0 : Math.round(vol * 100)}</span>
        </div>

        <div className="flex items-center gap-3 w-full">
          <span className="sts-body" style={{ color: '#c8b090', width: 110, fontSize: 15 }}>静音</span>
          <button
            className="sts-btn sts-body"
            style={{ fontSize: 14, padding: '6px 22px' }}
            onClick={() => { const m = !muted; setMuted(m); music.setMuted(m) }}
          >
            {muted ? '已静音（点击开启）' : '开启中（点击静音）'}
          </button>
        </div>

        <div className="flex items-center gap-3 w-full">
          <span className="sts-body" style={{ color: '#c8b090', width: 110, fontSize: 15 }}>联机昵称</span>
          <input
            className="sts-body"
            style={{ flex: 1, background: 'rgba(0,0,0,0.5)', border: '1.5px solid #6b4a2e', borderRadius: 8, color: '#e8d8b8', padding: '8px 12px', fontSize: 15 }}
            value={name}
            maxLength={10}
            onChange={e => { setName(e.target.value); savePlayerName(e.target.value) }}
            placeholder="联机时显示的名字"
          />
        </div>

        <div className="flex items-center gap-3 w-full">
          <span className="sts-body" style={{ color: '#c8b090', width: 110, fontSize: 15 }}>全屏</span>
          <button
            className="sts-btn sts-body"
            style={{ fontSize: 14, padding: '6px 22px' }}
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
              else document.documentElement.requestFullscreen().catch(() => {})
            }}
          >
            切换全屏（手机端自动横屏）
          </button>
        </div>

        <button className="sts-btn sts-title" style={{ fontSize: 20, padding: '10px 60px', marginTop: 10 }} onClick={() => gotoMenuScreen('title')}>
          返 回
        </button>
      </div>
    </div>
  )
}

// ============ 统计界面 ============
export function StatsScreen() {
  const gotoMenuScreen = useGame(s => s.gotoMenuScreen)
  const [stats, setStats] = useState<StatsData | null>(null)
  useEffect(() => { setStats(loadStats()) }, [])

  const charNames: Record<CharacterId, string> = {
    ironclad: '铁甲战士', silent: '寂静猎手', defect: '故障机器人', watcher: '观者',
  }
  const winRate = stats && stats.runs > 0 ? Math.round((stats.wins / stats.runs) * 100) : 0

  return (
    <div className="w-full h-full relative flex items-center justify-center sts-screen-fade"
      style={{ backgroundImage: `url(${A}/bg/combat.jpg)`, backgroundSize: 'cover', backgroundPosition: 'center 20%' }}>
      <div className="absolute inset-0" style={{ background: 'rgba(6,3,2,0.66)' }} />
      <div className="relative sts-panel flex flex-col items-center gap-4" style={{ padding: '32px 60px', minWidth: 520 }}>
        <div className="sts-title" style={{ fontSize: 32, color: '#ffd980', letterSpacing: 6 }}>统 计</div>
        {stats && (
          <>
            <div className="grid grid-cols-2 gap-x-12 gap-y-2 sts-body" style={{ color: '#c8b090', fontSize: 15 }}>
              <span>冒险次数</span><b style={{ color: '#e8d8b8' }}>{stats.runs}</b>
              <span>登顶次数</span><b style={{ color: '#8ee888' }}>{stats.wins}</b>
              <span>胜率</span><b style={{ color: '#e8d8b8' }}>{winRate}%</b>
              <span>最高层数</span><b style={{ color: '#ffd980' }}>{stats.bestFloor}</b>
              <span>累计击杀</span><b style={{ color: '#e8d8b8' }}>{stats.totalKills}</b>
              <span>累计精英</span><b style={{ color: '#e8d8b8' }}>{stats.totalElites}</b>
              <span>累计金币</span><b style={{ color: '#ffd97a' }}>{stats.totalGold}</b>
            </div>
            <div className="sts-title" style={{ fontSize: 17, color: '#c8a878', marginTop: 8, letterSpacing: 3 }}>—— 各角色 ——</div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-1.5 sts-body" style={{ color: '#c8b090', fontSize: 14 }}>
              {CHARACTERS.map(c => {
                const e = stats.perChar[c]
                return (
                  <span key={c} className="col-span-2 flex justify-between" style={{ minWidth: 320 }}>
                    <span>{charNames[c]}</span>
                    <b style={{ color: '#e8d8b8' }}>{e ? `${e.runs} 局 · ${e.wins} 胜 · 最高 ${e.bestFloor} 层` : '未使用'}</b>
                  </span>
                )
              })}
            </div>
          </>
        )}
        <button className="sts-btn sts-title" style={{ fontSize: 20, padding: '10px 60px', marginTop: 10 }} onClick={() => gotoMenuScreen('title')}>
          返 回
        </button>
      </div>
    </div>
  )
}

// ============ 制作名单 ============
export function CreditsScreen() {
  const gotoMenuScreen = useGame(s => s.gotoMenuScreen)
  return (
    <div className="w-full h-full relative flex items-center justify-center sts-screen-fade overflow-hidden"
      style={{ backgroundImage: `url(${A}/bg/combat.jpg)`, backgroundSize: 'cover', backgroundPosition: 'center 20%' }}>
      <div className="absolute inset-0" style={{ background: 'rgba(6,3,2,0.7)' }} />
      <div className="relative sts-panel flex flex-col items-center gap-4 sts-body" style={{ padding: '34px 64px', maxWidth: 640, color: '#c8b090', fontSize: 15, lineHeight: 2.1, textAlign: 'center' }}>
        <div className="sts-title" style={{ fontSize: 32, color: '#ffd980', letterSpacing: 6 }}>制 作 名 单</div>
        <div>
          <b style={{ color: '#e8d8b8' }}>Web 复刻版</b><br />
          基于 Mega Crit Games 的《杀戮尖塔》(Slay the Spire) 玩法复刻<br />
          仅供学习交流使用 · 请支持正版原作
        </div>
        <div style={{ marginTop: 6 }}>
          <b style={{ color: '#e8d8b8' }}>技术栈</b><br />
          Next.js · React · Zustand · Canvas/Web Animations · PeerJS 联机
        </div>
        <div style={{ marginTop: 6 }}>
          <b style={{ color: '#e8d8b8' }}>素材</b><br />
          游戏素材与音乐来自原版资源（学习用途）<br />
          wiki.gg 素材库 · 原版 OST
        </div>
        <div style={{ marginTop: 6 }}>
          <b style={{ color: '#e8d8b8' }}>开源</b><br />
          github.com/43aquarius/webslaythespire
        </div>
        <button className="sts-btn sts-title" style={{ fontSize: 20, padding: '10px 60px', marginTop: 12 }} onClick={() => gotoMenuScreen('title')}>
          返 回
        </button>
      </div>
    </div>
  )
}
