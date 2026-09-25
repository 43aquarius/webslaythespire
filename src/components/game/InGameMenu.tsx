'use client'
// ============ 游戏内菜单（原版齿轮：继续/设置/放弃本局/返回主菜单） ============
import { useEffect, useState } from 'react'
import { useGame } from '@/store/gameStore'
import { music } from '@/game/music'
import { loadSettings, savePlayerName } from '@/game/persist'

export function InGameMenu() {
  const run = useGame(s => s.run)
  const menuOpen = useGame(s => s.menuOpen)
  const toggleMenu = useGame(s => s.toggleMenu)
  const backToTitle = useGame(s => s.backToTitle)
  const abandonRun = useGame(s => s.abandonRun)
  const netLeave = useGame(s => s.netLeave)
  const net = useGame(s => s.net)
  const [showSettings, setShowSettings] = useState(false)
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const [vol, setVol] = useState(music.volume)
  const [muted, setMuted] = useState(music.muted)
  const [nick, setNick] = useState('')

  useEffect(() => { setNick(loadSettings().playerName) }, [])

  // ESC 键开关菜单
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && run) {
        e.preventDefault()
        toggleMenu()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [run, toggleMenu])

  if (!run) return null

  const closeAll = () => { setShowSettings(false); setConfirmAbandon(false); toggleMenu(false) }

  return (
    <>
      {/* 齿轮按钮（右上角，音乐按钮左侧） */}
      {!menuOpen && (
        <button
          className="sts-btn"
          style={{ position: 'absolute', top: 10, right: 100, zIndex: 500, fontSize: 15, padding: '4px 10px', minWidth: 38 }}
          onClick={() => toggleMenu(true)}
          title="菜单 (Esc)"
        >
          ⚙
        </button>
      )}

      {menuOpen && (
        <div
          className="absolute inset-0 z-[900] flex items-center justify-center"
          style={{ background: 'rgba(4,2,1,0.72)' }}
          onClick={closeAll}
        >
          <div
            className="sts-panel flex flex-col items-center gap-3"
            style={{ padding: '30px 54px', minWidth: 380 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="sts-title" style={{ fontSize: 26, color: '#ffd980', letterSpacing: 6, marginBottom: 6 }}>菜 单</div>

            {!showSettings ? (
              <>
                <button className="sts-btn sts-title" style={{ fontSize: 19, padding: '9px 70px', minWidth: 250 }} onClick={closeAll}>
                  继 续 游 戏
                </button>
                <button className="sts-btn sts-title" style={{ fontSize: 19, padding: '9px 70px', minWidth: 250 }} onClick={() => setShowSettings(true)}>
                  设　　置
                </button>
                {net.role ? (
                  <button className="sts-btn sts-title" style={{ fontSize: 19, padding: '9px 70px', minWidth: 250, color: '#ffa898' }}
                    onClick={() => netLeave()}>
                    退出联机房间
                  </button>
                ) : (
                  <button
                    className="sts-btn sts-title"
                    style={{ fontSize: 19, padding: '9px 70px', minWidth: 250, color: confirmAbandon ? '#ff7a5a' : '#e8d8b8' }}
                    onClick={() => {
                      if (!confirmAbandon) { setConfirmAbandon(true); setTimeout(() => setConfirmAbandon(false), 2500); return }
                      abandonRun()
                    }}
                  >
                    {confirmAbandon ? '确认放弃本局？' : '放 弃 本 局'}
                  </button>
                )}
                <button className="sts-btn sts-title" style={{ fontSize: 19, padding: '9px 70px', minWidth: 250 }} onClick={() => backToTitle()}>
                  {net.role ? '返回主菜单（断开联机）' : '返回主菜单'}
                </button>
                <div className="sts-body" style={{ color: '#8a7458', fontSize: 12, marginTop: 4 }}>
                  第 {run.act} 幕 · 第 {Math.max(1, run.visitedNodes.length)} 层{net.role ? ' · 联机合作中' : ' · 进度已自动保存'}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3" style={{ width: '100%' }}>
                  <span className="sts-body" style={{ color: '#c8b090', width: 90, fontSize: 14 }}>音乐音量</span>
                  <input
                    type="range" min={0} max={1} step={0.05} value={muted ? 0 : vol}
                    onChange={e => {
                      const v = Number(e.target.value)
                      setVol(v); music.setVolume(v); music.setMuted(false); setMuted(false)
                    }}
                    style={{ flex: 1, accentColor: '#c8a060' }}
                  />
                  <span className="sts-body" style={{ color: '#d8c8a8', width: 34, fontSize: 13 }}>{muted ? 0 : Math.round(vol * 100)}</span>
                </div>
                <div className="flex items-center gap-3" style={{ width: '100%' }}>
                  <span className="sts-body" style={{ color: '#c8b090', width: 90, fontSize: 14 }}>静音</span>
                  <button
                    className="sts-btn sts-body" style={{ fontSize: 14, padding: '6px 24px' }}
                    onClick={() => { const m = !muted; setMuted(m); music.setMuted(m) }}
                  >
                    {muted ? '已静音（点击开启）' : '开启中（点击静音）'}
                  </button>
                </div>
                <div className="flex items-center gap-3" style={{ width: '100%' }}>
                  <span className="sts-body" style={{ color: '#c8b090', width: 90, fontSize: 14 }}>联机昵称</span>
                  <input
                    className="sts-body"
                    style={{ flex: 1, background: 'rgba(0,0,0,0.5)', border: '1.5px solid #6b4a2e', borderRadius: 8, color: '#e8d8b8', padding: '7px 12px', fontSize: 14 }}
                    defaultValue={nick}
                    maxLength={10}
                    onChange={e => { setNick(e.target.value); savePlayerName(e.target.value) }}
                    placeholder="联机时显示的名字"
                  />
                </div>
                <div className="flex items-center gap-3" style={{ width: '100%' }}>
                  <span className="sts-body" style={{ color: '#c8b090', width: 90, fontSize: 14 }}>全屏</span>
                  <button className="sts-btn sts-body" style={{ fontSize: 14, padding: '6px 24px' }}
                    onClick={() => {
                      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
                      else document.documentElement.requestFullscreen().catch(() => {})
                    }}>
                    切换全屏
                  </button>
                </div>
                <button className="sts-btn sts-title" style={{ fontSize: 17, padding: '8px 50px', marginTop: 8 }} onClick={() => setShowSettings(false)}>
                  返 回
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
