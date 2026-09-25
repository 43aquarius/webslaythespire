'use client'
// ============ 联机合作大厅（仿杀戮尖塔2合作模式） ============
// 创建房间（房主）/ 加入房间（客机）→ 双方选角色 → 出发
import { useEffect, useState } from 'react'
import { useGame } from '@/store/gameStore'
import { CHARACTER_INFO } from '@/game/run'
import { CharacterId } from '@/game/types'
import { loadSettings } from '@/game/persist'
import { makeRoomCode } from '@/game/net'

const A = '/assets'

const CHARACTERS: CharacterId[] = ['ironclad', 'silent', 'defect', 'watcher']
const CHAR_BORDER: Record<CharacterId, string> = {
  ironclad: '#b03828', silent: '#3a9a5a', defect: '#3a7ac8', watcher: '#9a5ab8',
}

export function MultiplayerScreen() {
  const gotoMenuScreen = useGame(s => s.gotoMenuScreen)
  const netCreateRoom = useGame(s => s.netCreateRoom)
  const netJoinRoom = useGame(s => s.netJoinRoom)
  const netLeave = useGame(s => s.netLeave)
  const lobbyPickChar = useGame(s => s.lobbyPickChar)
  const lobbyStart = useGame(s => s.lobbyStart)
  const net = useGame(s => s.net)

  const [mode, setMode] = useState<'choose' | 'host' | 'join'>('choose')
  const [name, setName] = useState('玩家')
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => { setName(loadSettings().playerName) }, [])

  // ===== 阶段1：选择创建/加入 =====
  if (mode === 'choose' && !net.role) {
    return (
      <Shell>
        <div className="sts-title" style={{ fontSize: 36, color: '#ffd980', letterSpacing: 8 }}>联 机 合 作</div>
        <div className="sts-body text-center" style={{ color: '#c8b090', fontSize: 15, lineHeight: 1.9, maxWidth: 480 }}>
          仿照《杀戮尖塔 2》的合作模式：与好友一起攀登尖塔。<br />
          共享地图与敌人，各自拥有独立的牌组、生命与能量；<br />
          轮流行动，共同战斗（P2P 直连，无需服务器）。
        </div>
        <div className="flex items-center gap-3">
          <span className="sts-body" style={{ color: '#c8b090', fontSize: 15 }}>昵称</span>
          <input
            className="sts-body"
            style={{ background: 'rgba(0,0,0,0.5)', border: '1.5px solid #6b4a2e', borderRadius: 8, color: '#e8d8b8', padding: '8px 12px', fontSize: 15, width: 180 }}
            value={name} maxLength={10}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col items-center gap-3" style={{ marginTop: 8 }}>
          <button className="sts-btn sts-title" style={{ fontSize: 22, padding: '10px 70px', letterSpacing: 4 }}
            onClick={() => { setMode('host'); netCreateRoom(name) }}>
            创 建 房 间
          </button>
          <button className="sts-btn sts-title" style={{ fontSize: 22, padding: '10px 70px', letterSpacing: 4 }}
            onClick={() => setMode('join')}>
            加 入 房 间
          </button>
        </div>
        {mode === 'choose' && (
          <div className="flex items-center gap-2">
            <input
              className="sts-body"
              style={{ background: 'rgba(0,0,0,0.5)', border: '1.5px solid #6b4a2e', borderRadius: 8, color: '#e8d8b8', padding: '8px 12px', fontSize: 17, width: 150, letterSpacing: 3, textAlign: 'center' }}
              value={code} maxLength={6} placeholder="房间码"
              onChange={e => setCode(e.target.value.toUpperCase())}
            />
            <button className="sts-btn sts-body" style={{ fontSize: 14, padding: '8px 18px' }}
              disabled={code.trim().length < 4}
              onClick={() => netJoinRoom(name, code)}>
              输入房间码加入
            </button>
          </div>
        )}
        <button className="sts-btn sts-body" style={{ fontSize: 15, padding: '6px 30px', marginTop: 10 }} onClick={() => gotoMenuScreen('title')}>
          返回主菜单
        </button>
        {net.error && <div className="sts-body" style={{ color: '#ff9a8a', fontSize: 14 }}>{net.error}</div>}
      </Shell>
    )
  }

  // ===== 阶段2：房间内（等待 / 已连接） =====
  const isHost = net.role === 'host'
  const myChar = isHost ? net.lobby.hostChar : net.lobby.guestChar
  const otherChar = isHost ? net.lobby.guestChar : net.lobby.hostChar
  const otherName = net.peerName || '等待加入…'
  const bothReady = !!(net.lobby.hostChar && net.lobby.guestChar)

  return (
    <Shell>
      <div className="sts-title" style={{ fontSize: 32, color: '#ffd980', letterSpacing: 6 }}>合 作 大 厅</div>

      {/* 房间码 */}
      <div className="flex flex-col items-center gap-1">
        <div className="sts-body" style={{ color: '#a89070', fontSize: 13 }}>房间码（告诉你的好友）</div>
        <div className="flex items-center gap-3">
          <div className="sts-title" style={{ fontSize: 46, color: '#8ee8ff', letterSpacing: 12, textShadow: '0 0 24px rgba(100,200,255,0.5), 3px 3px 0 #000' }}>
            {net.roomCode || makeRoomCode()}
          </div>
          {isHost && (
            <button className="sts-btn sts-body" style={{ fontSize: 13, padding: '6px 14px' }}
              onClick={() => {
                navigator.clipboard?.writeText(net.roomCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})
              }}>
              {copied ? '已复制' : '复制'}
            </button>
          )}
        </div>
      </div>

      {/* 双方状态 */}
      <div className="flex items-center justify-center gap-14" style={{ marginTop: 6 }}>
        <PlayerSlot title={`${net.myName || '我'}（你）`} char={myChar} active onPick={lobbyPickChar} pickable />
        <div className="sts-title" style={{ fontSize: 26, color: '#8a7458' }}>VS</div>
        <PlayerSlot title={otherName} char={otherChar} active={net.connected} onPick={lobbyPickChar} pickable={false} />
      </div>

      {/* 状态提示 */}
      <div className="sts-body text-center" style={{ color: net.connected ? '#8ee888' : '#c8a878', fontSize: 14, minHeight: 22 }}>
        {!net.connected
          ? (isHost ? '等待好友加入…（把房间码发给对方）' : '正在连接房间…')
          : bothReady
            ? (isHost ? '双方已就绪，可以出发！' : '等待房主出发…')
            : (isHost ? '等待双方选择角色…' : '选择你的角色，等待房主出发…')}
      </div>

      {/* 操作 */}
      <div className="flex items-center gap-6" style={{ marginTop: 4 }}>
        {isHost ? (
          <button className="sts-btn sts-title" style={{ fontSize: 24, padding: '12px 70px', letterSpacing: 6 }}
            disabled={!net.connected || !bothReady}
            onClick={() => lobbyStart()}>
            出 发
          </button>
        ) : (
          <div className="sts-body" style={{ color: '#a89070', fontSize: 15 }}>
            {bothReady && net.connected ? '已就绪 ✔ 等待房主开始' : '选择你的角色'}
          </div>
        )}
        <button className="sts-btn sts-body" style={{ fontSize: 15, padding: '8px 26px' }} onClick={() => netLeave()}>
          离开房间
        </button>
      </div>

      {net.error && <div className="sts-body" style={{ color: '#ff9a8a', fontSize: 14 }}>{net.error}</div>}
    </Shell>
  )
}

// ============ 大厅玩家卡位 ============
function PlayerSlot({ title, char, active, onPick, pickable }: {
  title: string; char: CharacterId | null; active: boolean
  onPick: (c: CharacterId) => void; pickable: boolean
}) {
  const [hover, setHover] = useState(false)
  const info = char ? CHARACTER_INFO[char] : null
  return (
    <div className="flex flex-col items-center gap-2" style={{ opacity: active ? 1 : 0.55 }}>
      <div className="sts-body" style={{ color: '#e8d8b8', fontSize: 15 }}>{title}</div>
      <div className="relative" style={{ width: 210, height: 150 }}>
        {info ? (
          <img
            src={`${A}/hero/${info.sprite}.png`} alt={info.name}
            width={200} height={140} draggable={false}
            style={{
              objectFit: 'contain', borderRadius: 12,
              border: `3px solid ${CHAR_BORDER[char!]}`,
              background: 'radial-gradient(ellipse at 50% 70%, rgba(40,26,14,0.9), rgba(10,6,4,0.95))',
            }}
          />
        ) : (
          <div className="sts-body flex items-center justify-center"
            style={{ width: 200, height: 140, borderRadius: 12, border: '3px dashed #5a4230', color: '#8a7458', fontSize: 14 }}>
            {active ? '选择角色' : '未加入'}
          </div>
        )}
        {/* 换角色下拉（点击头像循环/悬浮选择） */}
        {pickable && (
          <div className="absolute flex gap-1" style={{ top: -14, right: -8 }}>
            {CHARACTERS.map(c => (
              <button
                key={c}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                onClick={e => { e.stopPropagation(); onPick(c) }}
                title={CHARACTER_INFO[c].name}
                style={{
                  width: 26, height: 26, borderRadius: '50%',
                  border: `2px solid ${char === c ? '#ffd980' : CHAR_BORDER[c]}`,
                  background: `radial-gradient(circle at 40% 35%, ${CHAR_BORDER[c]}, rgba(10,8,6,0.95))`,
                  boxShadow: hover ? '0 0 10px rgba(255,217,128,0.6)' : 'none',
                  cursor: 'pointer', padding: 0,
                }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="sts-title" style={{ fontSize: 16, color: info ? '#ffd980' : '#8a7458', letterSpacing: 2 }}>
        {info ? info.name : '？？？'}
      </div>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full h-full relative flex flex-col items-center justify-center gap-5 select-none overflow-hidden sts-screen-fade"
      style={{ backgroundImage: `url(${A}/bg/combat.jpg)`, backgroundSize: 'cover', backgroundPosition: 'center 20%' }}>
      <div className="absolute inset-0" style={{ background: 'rgba(6,3,2,0.64)' }} />
      <div className="relative flex flex-col items-center gap-5">{children}</div>
    </div>
  )
}
