'use client'
// ============ BGM 控制器：监听游戏场景切换曲目（含各幕专属曲） + 音乐/音效音量UI ============
import { useEffect, useRef, useState } from 'react'
import { useGame } from '@/store/gameStore'
import { music, trackForScreen } from '@/game/music'
import { sfx } from '@/game/sfx'

export function MusicPlayer() {
  const run = useGame(s => s.run)
  const [vol, setVol] = useState(music.volume)
  const [sfxVol, setSfxVol] = useState(sfx.volume)
  const [muted, setMuted] = useState(music.muted)
  const [open, setOpen] = useState(false)
  const lastStinger = useRef<string | null>(null)
  const lastScreen = useRef('')

  const cur = run ? run.screen : 'title'

  useEffect(() => {
    // 进入地图=MapOpen；离开商店=RugClose（原版 SoundMaster 键）
    if (cur === 'map' && lastScreen.current !== 'map') sfx.play('mapOpen')
    if (lastScreen.current === 'shop' && cur !== 'shop') sfx.play('shopClose')
    lastScreen.current = cur
    if (!run) {
      music.play('menu')
      return
    }
    // 胜利/死亡 → 一次性短曲
    if (cur === 'victory' && lastStinger.current !== 'victory') {
      lastStinger.current = 'victory'
      music.stinger('victory', 'credits')
      return
    }
    if (cur === 'gameover' && lastStinger.current !== 'gameover') {
      lastStinger.current = 'gameover'
      music.stinger('death')
      return
    }
    if (cur !== 'victory' && cur !== 'gameover') {
      lastStinger.current = null
      const combat = run.combat && run.screen === 'combat'
        ? { isBoss: run.combat.isBoss, isElite: run.combat.isElite }
        : null
      music.play(trackForScreen(run.screen, combat, run.act))
    }
  }, [cur, run?.combat?.isBoss, run?.combat?.isElite, run?.act])

  return (
    <div className="absolute flex gap-1.5 items-center select-none" style={{ top: 10, right: 56, zIndex: 500, pointerEvents: 'auto' }}>
      {open && (
        <div
          className="absolute right-0 top-10 rounded-lg px-3 py-3 flex items-center gap-2"
          style={{ background: 'rgba(12,8,5,0.92)', border: '1px solid #6b4a2e', boxShadow: '0 4px 16px rgba(0,0,0,.6)' }}
        >
          <input
            type="range" min={0} max={1} step={0.05} value={vol}
            onChange={e => {
              const v = Number(e.target.value)
              setVol(v); music.setVolume(v)
              if (v > 0 && muted) { setMuted(false); music.setMuted(false) }
            }}
            style={{ width: 110, accentColor: '#c8a060' }}
            title="音乐音量"
          />
          <span className="sts-body" style={{ color: '#d8c8a8', fontSize: 12, width: 30 }}>
            {muted ? 0 : Math.round(vol * 100)}
          </span>
          <span className="sts-body" style={{ color: '#c8b090', fontSize: 12, width: 58, marginLeft: 8 }}>音效</span>
          <input
            type="range" min={0} max={1} step={0.05} value={sfxVol}
            onChange={e => {
              const v = Number(e.target.value)
              setSfxVol(v); sfx.setVolume(v)
            }}
            style={{ width: 110, accentColor: '#c8a060' }}
            title="音效音量"
          />
          <span className="sts-body" style={{ color: '#d8c8a8', fontSize: 12, width: 30 }}>
            {Math.round(sfxVol * 100)}
          </span>
        </div>
      )}
      <button
        className="sts-btn"
        style={{ fontSize: 15, padding: '4px 10px', minWidth: 38 }}
        onClick={() => setOpen(o => !o)}
        title="音乐设置"
      >
        {muted || vol === 0 ? '🔇' : '🎵'}
      </button>
      {open && (
        <button
          className="sts-btn"
          style={{ fontSize: 15, padding: '4px 10px', minWidth: 38, marginLeft: 4 }}
          onClick={() => {
            const m = !muted
            setMuted(m); music.setMuted(m)
          }}
          title="静音"
        >
          {muted ? '🔇' : '🔊'}
        </button>
      )}
    </div>
  )
}
