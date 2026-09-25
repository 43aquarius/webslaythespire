// ============ 联机合作中转服务（HTTP 轮询版，内置于 Next.js） ============
// 背景：部署平台的网关对 WebSocket 升级只做假应答（101 后不转发数据帧），
//       独立端口的 XTransformPort 转发在公网不可用；唯一稳定通道 = 本应用(3000端口)的 HTTP 请求。
// 方案：房间与消息信箱全部保存在本进程内存中，客户端通过短轮询收发：
//   POST /api/mp  {t:'create', name}            → {ok, code}        创建房间（成为房主）
//   POST /api/mp  {t:'join', code, name}        → {ok, host}        加入房间（host=房主昵称）
//   POST /api/mp  {t:'relay', code, role, payload} → {ok}           消息放入对方信箱（游戏消息中转）
//   POST /api/mp  {t:'poll', code, role}        → {ok, msgs:[...]}  取走自己信箱内的全部消息（同时报告在线）
//   POST /api/mp  {t:'leave', code, role}       → {ok}              离开房间（对方收到 peer-left）
//   POST /api/mp  {t:'rooms'}                   → {ok, rooms:[...]} 房间大厅列表
//   POST /api/mp  {t:'ping'}                    → {ok, pong}        服务器连通性检测
// 架构不变：房主权威 —— 房主执行全部游戏逻辑并广播快照，客机动作转发给房主执行。
export const dynamic = 'force-dynamic'

interface Mailbox {
  name: string
  msgs: { t: string; [k: string]: unknown }[]
  lastSeen: number
}
interface Room {
  code: string
  host: Mailbox
  guest: Mailbox | null
  created: number
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'   // 去掉易混淆字符
const ROOM_TTL = 4 * 60 * 60 * 1000        // 房间最长存活 4 小时
const PLAYER_STALE = 45 * 1000             // 玩家超过 45 秒无心跳视为掉线

// 模块级状态挂在 globalThis：开发模式热重载 / 多次模块求值时状态不丢
const G = globalThis as unknown as { __stsMpRooms?: Map<string, Room>; __stsMpSweeper?: ReturnType<typeof setInterval> }
if (!G.__stsMpRooms) G.__stsMpRooms = new Map()
const rooms: Map<string, Room> = G.__stsMpRooms

// 后台清扫：超时房间删除；掉线玩家通知对方并移出房间
if (!G.__stsMpSweeper) {
  G.__stsMpSweeper = setInterval(() => {
    const now = Date.now()
    for (const [code, room] of [...rooms.entries()]) {
      if (now - room.created > ROOM_TTL) {
        if (room.guest) room.guest.msgs.push({ t: 'peer-left', reason: '房间已超时关闭' })
        if (now - room.host.lastSeen < PLAYER_STALE) room.host.msgs.push({ t: 'peer-left', reason: '房间已超时关闭' })
        rooms.delete(code)
        continue
      }
      if (room.guest && now - room.guest.lastSeen > PLAYER_STALE) {
        room.host.msgs.push({ t: 'peer-left', reason: '对方已断开连接' })
        room.guest = null
      }
      if (now - room.host.lastSeen > PLAYER_STALE) {
        if (room.guest) room.guest.msgs.push({ t: 'peer-left', reason: '房主已断开连接' })
        rooms.delete(code)   // 房主掉线 → 房间销毁
      }
    }
  }, 15000)
  // 防 unref 阻止进程退出误判（Next.js 进程常驻，无需处理）
}

function makeCode(): string {
  for (let i = 0; i < 200; i++) {
    let s = ''
    for (let j = 0; j < 4; j++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    if (!rooms.has(s)) return s
  }
  return 'R' + Date.now().toString(36).toUpperCase().slice(-4)
}

function roomList() {
  const now = Date.now()
  return [...rooms.values()]
    .filter(r => now - r.created < ROOM_TTL)
    .map(r => ({
      code: r.code,
      host: r.host.name,
      guests: r.guest ? 1 : 0,
      status: r.guest ? 'full' : 'open',
      created: r.created,
    }))
}

function mailboxOf(room: Room, role: string): Mailbox | null {
  if (role === 'host') return room.host
  if (role === 'guest') return room.guest
  return null
}

function peerOf(room: Room, role: string): Mailbox | null {
  if (role === 'host') return room.guest
  if (role === 'guest') return room.host
  return null
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, error: 'bad-request' }, { status: 400, headers: CORS })
  }
  const t = String(body.t || '')
  const now = Date.now()

  try {
    switch (t) {
      case 'ping':
        return Response.json({ ok: true, pong: true, rooms: rooms.size }, { headers: CORS })

      case 'rooms':
        return Response.json({ ok: true, rooms: roomList() }, { headers: CORS })

      case 'create': {
        const name = String(body.name || '玩家').slice(0, 12)
        const code = makeCode()
        rooms.set(code, { code, host: { name, msgs: [], lastSeen: now }, guest: null, created: now })
        return Response.json({ ok: true, code }, { headers: CORS })
      }

      case 'join': {
        const code = String(body.code || '').toUpperCase().trim()
        const name = String(body.name || '玩家').slice(0, 12)
        const room = rooms.get(code)
        if (!room) return Response.json({ ok: false, error: '房间不存在或已关闭' }, { headers: CORS })
        if (room.guest) return Response.json({ ok: false, error: '房间已满（双人合作）' }, { headers: CORS })
        room.guest = { name, msgs: [], lastSeen: now }
        room.host.msgs.push({ t: 'peer', name })
        room.host.lastSeen = Math.max(room.host.lastSeen, now - 1) // 保持房主在线判定
        return Response.json({ ok: true, host: room.host.name }, { headers: CORS })
      }

      case 'relay': {
        const code = String(body.code || '').toUpperCase().trim()
        const role = String(body.role || '')
        const room = rooms.get(code)
        if (!room) return Response.json({ ok: false, error: 'room-gone' }, { headers: CORS })
        const me = mailboxOf(room, role)
        const peer = peerOf(room, role)
        if (!me) return Response.json({ ok: false, error: 'role-invalid' }, { headers: CORS })
        me.lastSeen = now
        if (peer) peer.msgs.push({ t: 'relay', payload: body.payload })
        return Response.json({ ok: true }, { headers: CORS })
      }

      case 'poll': {
        const code = String(body.code || '').toUpperCase().trim()
        const role = String(body.role || '')
        const room = rooms.get(code)
        if (!room) {
          // 房间已销毁（房主离开/超时）→ 对房内玩家而言等价于"对方已离开"
          return Response.json({ ok: true, msgs: [{ t: 'peer-left', reason: '房间已关闭' }] }, { headers: CORS })
        }
        const me = mailboxOf(room, role)
        if (!me) return Response.json({ ok: false, error: 'role-invalid' }, { headers: CORS })
        me.lastSeen = now
        const msgs = me.msgs
        me.msgs = []
        return Response.json({ ok: true, msgs }, { headers: CORS })
      }

      case 'leave': {
        const code = String(body.code || '').toUpperCase().trim()
        const role = String(body.role || '')
        const room = rooms.get(code)
        if (room) {
          const peer = peerOf(room, role)
          if (role === 'host') {
            if (room.guest) room.guest.msgs.push({ t: 'peer-left', reason: '房主已关闭房间' })
            rooms.delete(code)
          } else if (role === 'guest') {
            room.host.msgs.push({ t: 'peer-left', reason: '对方已离开房间' })
            room.guest = null
          }
          void peer
        }
        return Response.json({ ok: true }, { headers: CORS })
      }

      default:
        return Response.json({ ok: false, error: 'unknown-action' }, { status: 400, headers: CORS })
    }
  } catch (err) {
    console.error('[api/mp] 处理错误:', err)
    return Response.json({ ok: false, error: 'server-error' }, { status: 500, headers: CORS })
  }
}
