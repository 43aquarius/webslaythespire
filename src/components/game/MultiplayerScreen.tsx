'use client'
// ============ 联机合作大厅（仿杀戮尖塔2合作模式） ============
// 大厅：房间列表（实时刷新）+ 创建房间 + 房间码加入 → 双方选角色 → 出发
import { useEffect, useRef, useState } from 'react'
import { useGame } from '@/store/gameStore'
import { CHARACTER_INFO } from '@/game/run'
import { CharacterId } from '@/game/types'
import { loadSettings } from '@/game/persist'
import { net as netMgr, RoomInfo, getServerUrl, setServerUrl, wsCandidates } from '@/game/net'

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

  const [name, setName] = useState('玩家')
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState(false)

  // ===== 大厅状态 =====
  const [rooms, setRooms] = useState<RoomInfo[]>([])
  const [srvOk, setSrvOk] = useState<boolean | null>(null)   // null=检测中
  const [showSrv, setShowSrv] = useState(false)
  const [srvInput, setSrvInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setName(loadSettings().playerName); setSrvInput(getServerUrl()) }, [])

  // 进入界面：订阅房间列表；离开界面：退订
  useEffect(() => {
    netMgr.onRooms(list => setRooms(list))
    netMgr.watchLobby().then(() => setSrvOk(true)).catch(() => setSrvOk(false))
    const tick = setInterval(() => {
      netMgr.listRooms().catch(() => {})
    }, 3000)
    return () => {
      clearInterval(tick)
      netMgr.unwatchLobby()
    }
  }, [])

  // ===== 阶段1：大厅（选择创建/浏览/加入） =====
  if (!net.role) {
    return (
      <Shell>
        <div className="sts-title" style={{ fontSize: 34, color: '#ffd980', letterSpacing: 8 }}>联 机 合 作</div>
        <div className="sts-body text-center" style={{ color: '#c8b090', fontSize: 14, lineHeight: 1.8, maxWidth: 520 }}>
          仿照《杀戮尖塔 2》的合作模式：与好友一起攀登尖塔。<br />
          共享地图与敌人，各自拥有独立的牌组、生命与能量，轮流行动，共同战斗。
        </div>

        {/* 昵称 */}
        <div className="flex items-center gap-3">
          <span className="sts-body" style={{ color: '#c8b090', fontSize: 15 }}>昵称</span>
          <input
            className="sts-body"
            style={{ background: 'rgba(0,0,0,0.5)', border: '1.5px solid #6b4a2e', borderRadius: 8, color: '#e8d8b8', padding: '8px 12px', fontSize: 15, width: 180 }}
            value={name} maxLength={10}
            onChange={e => setName(e.target.value)}
          />
          <button className="sts-btn sts-title" style={{ fontSize: 20, padding: '9px 54px', letterSpacing: 4 }}
            onClick={() => { setCode(''); netCreateRoom(name) }}>
            创 建 房 间
          </button>
        </div>

        {/* 房间大厅列表 */}
        <div className="sts-panel flex flex-col" style={{ width: 620, padding: '14px 18px', gap: 8 }}>
          <div className="flex items-center justify-between">
            <div className="sts-title" style={{ fontSize: 17, color: '#e8d8b8', letterSpacing: 3 }}>房间大厅</div>
            <div className="flex items-center gap-2">
              <span className="sts-body" style={{ fontSize: 12, color: srvOk === null ? '#c8a878' : srvOk ? '#8ee888' : '#ff9a8a' }}>
                {srvOk === null ? '连接服务器中…' : srvOk ? '● 服务器已连接' : '○ 服务器离线'}
              </span>
              <button className="sts-btn sts-body" style={{ fontSize: 12, padding: '3px 12px' }}
                onClick={() => netMgr.listRooms().catch(() => setSrvOk(false))}>
                刷新
              </button>
              <button className="sts-btn sts-body" style={{ fontSize: 12, padding: '3px 12px' }}
                onClick={() => setShowSrv(s => !s)} title="联机服务器设置">
                服务器
              </button>
            </div>
          </div>

          {showSrv && (
            <div className="flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '8px 10px' }}>
              <span className="sts-body" style={{ fontSize: 12, color: '#a89070', whiteSpace: 'nowrap' }}>服务器地址</span>
              <input
                className="sts-body" style={{ flex: 1, background: 'rgba(0,0,0,0.5)', border: '1px solid #6b4a2e', borderRadius: 6, color: '#e8d8b8', padding: '5px 8px', fontSize: 12 }}
                placeholder={srvInput ? '' : wsCandidates()[1] || 'ws://localhost:3001'}
                value={srvInput} onChange={e => setSrvInput(e.target.value)}
              />
              <button className="sts-btn sts-body" style={{ fontSize: 12, padding: '4px 12px' }}
                onClick={() => { setServerUrl(srvInput); location.reload() }}>保存</button>
            </div>
          )}

          <div ref={listRef} className="flex flex-col gap-1.5" style={{ maxHeight: 190, overflowY: 'auto' }}>
            {rooms.length === 0 && (
              <div className="sts-body text-center" style={{ color: srvOk ? '#8a7458' : '#a87868', fontSize: 13, padding: '20px 0' }}>
                {srvOk ? '暂无开放房间 —— 创建一个，或输入房间码加入好友' : '无法连接联机服务器：自托管用户请运行 node scripts/ws-server.js，或点击右上角「服务器」填写地址'}
              </div>
            )}
            {rooms.map(r => (
              <div key={r.code} className="flex items-center gap-3"
                style={{ background: 'rgba(0,0,0,0.32)', border: '1px solid #4a3520', borderRadius: 8, padding: '7px 12px' }}>
                <span className="sts-title" style={{ fontSize: 19, color: '#8ee8ff', letterSpacing: 5, width: 84, textShadow: '2px 2px 0 #000' }}>{r.code}</span>
                <span className="sts-body" style={{ fontSize: 14, color: '#e8d8b8', flex: 1 }}>
                  {r.host} 的房间
                  <span className="sts-body" style={{ fontSize: 12, color: '#8a7458', marginLeft: 8 }}>
                    {r.guests > 0 ? '2/2' : '1/2'} 人
                  </span>
                </span>
                <span className="sts-body" style={{ fontSize: 12, color: r.status === 'open' ? '#8ee888' : '#8a7458' }}>
                  {r.status === 'open' ? '等待中' : '已满'}
                </span>
                <button
                  className="sts-btn sts-body"
                  style={{ fontSize: 13, padding: '5px 18px' }}
                  disabled={r.status !== 'open'}
                  onClick={() => netJoinRoom(name, r.code)}
                >
                  加入
                </button>
              </div>
            ))}
          </div>

          {/* 房间码加入 */}
          <div className="flex items-center gap-2 justify-center" style={{ borderTop: '1px solid rgba(90,64,32,0.6)', paddingTop: 10 }}>
            <span className="sts-body" style={{ fontSize: 13, color: '#a89070' }}>房间码加入</span>
            <input
              className="sts-body"
              style={{ background: 'rgba(0,0,0,0.5)', border: '1.5px solid #6b4a2e', borderRadius: 8, color: '#e8d8b8', padding: '6px 10px', fontSize: 16, width: 130, letterSpacing: 3, textAlign: 'center' }}
              value={code} maxLength={6} placeholder="ABCD"
              onChange={e => setCode(e.target.value.toUpperCase())}
            />
            <button className="sts-btn sts-body" style={{ fontSize: 13, padding: '6px 16px' }}
              disabled={code.trim().length < 4}
              onClick={() => netJoinRoom(name, code)}>
              加入房间
            </button>
          </div>
        </div>

        <button className="sts-btn sts-body" style={{ fontSize: 15, padding: '6px 30px' }} onClick={() => gotoMenuScreen('title')}>
          返回主菜单
        </button>
        {net.error && <div className="sts-body" style={{ color: '#ff9a8a', fontSize: 14, maxWidth: 560, textAlign: 'center' }}>{net.error}</div>}
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
      <div className="sts-title" style={{ fontSize: 32, color: '#ffd980', letterSpacing: 6 }}>合 作 房 间</div>

      {/* 房间码 */}
      <div className="flex flex-col items-center gap-1">
        <div className="sts-body" style={{ color: '#a89070', fontSize: 13 }}>房间码（告诉你的好友，或在大厅列表中找到它）</div>
        <div className="flex items-center gap-3">
          <div className="sts-title" style={{ fontSize: 46, color: '#8ee8ff', letterSpacing: 12, textShadow: '0 0 24px rgba(100,200,255,0.5), 3px 3px 0 #000' }}>
            {net.roomCode || '····'}
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
          ? (isHost ? '等待好友加入…（房间已显示在大厅列表中）' : '正在连接房间…')
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
    <div className="w-full h-full relative flex flex-col items-center justify-center gap-4 select-none overflow-hidden sts-screen-fade"
      style={{ backgroundImage: `url(${A}/bg/combat.jpg)`, backgroundSize: 'cover', backgroundPosition: 'center 20%' }}>
      <div className="absolute inset-0" style={{ background: 'rgba(6,3,2,0.64)' }} />
      <div className="relative flex flex-col items-center gap-4">{children}</div>
    </div>
  )
}
