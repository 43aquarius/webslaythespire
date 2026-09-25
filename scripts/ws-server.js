// ============ 杀戮尖塔 Web 联机服务器（WebSocket 中转 + 房间大厅） ============
// 用途：替代 PeerJS P2P —— 提供稳定可靠的房间管理与消息中转
// 启动：node scripts/ws-server.js  （默认端口 3001，可用 WS_PORT 环境变量覆盖）
// 架构：纯中转，不含游戏逻辑 —— 房主权威：房主执行全部游戏逻辑并广播快照，
//       客机动作经服务器转发给房主；服务器只负责房间生命周期与消息路由。
//
// 协议（JSON）：
//   客户端 → 服务器：
//     {t:'create', name}          创建房间（成为房主）
//     {t:'join', code, name}      加入房间
//     {t:'leave'}                 离开房间（保持服务器连接）
//     {t:'watch-lobby'}           订阅房间列表推送
//     {t:'unwatch-lobby'}         取消订阅
//     {t:'list'}                  立即拉取一次房间列表
//     {t:'relay', payload}        转发消息给房间内另一位玩家
//     {t:'ping'}                  心跳
//   服务器 → 客户端：
//     {t:'created', code}         房间创建成功
//     {t:'joined', code, host}    加入成功（host = 房主昵称）
//     {t:'peer', name}            房主收到：玩家进入房间
//     {t:'peer-left', reason}     对方离开/断线
//     {t:'rooms', rooms:[...]}    房间列表（订阅者 + 变更时推送）
//     {t:'relay', payload}        来自队友的消息
//     {t:'pong'}                  心跳应答
//     {t:'error', msg}            错误
const { WebSocketServer } = require('ws')

const PORT = Number(process.env.WS_PORT || 3001)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ROOM_TTL = 4 * 60 * 60 * 1000        // 房间最长存活 4 小时
const LOBBY_PUSH_INTERVAL = 3000           // 大厅列表推送间隔（有订阅者时）

const wss = new WebSocketServer({ port: PORT }, () => {
  console.log(`[ws-server] 杀戮尖塔联机服务器已启动: ws://localhost:${PORT}`)
})

/** 房间：code → { code, host: ws, hostName, guest: ws|null, guestName, created } */
const rooms = new Map()

function makeCode() {
  for (let i = 0; i < 200; i++) {
    let s = ''
    for (let j = 0; j < 4; j++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    if (!rooms.has(s)) return s
  }
  return 'R' + Date.now().toString(36).toUpperCase().slice(-4)
}

function send(ws, obj) {
  if (ws && ws.readyState === 1) {
    try { ws.send(JSON.stringify(obj)) } catch { /* noop */ }
  }
}

function roomList() {
  const now = Date.now()
  return [...rooms.values()]
    .filter(r => now - r.created < ROOM_TTL)
    .map(r => ({
      code: r.code,
      host: r.hostName,
      guests: r.guest ? 1 : 0,
      status: r.guest ? 'full' : 'open',
      created: r.created,
    }))
}

function lobbyWatchers() {
  return [...wss.clients].filter(ws => ws.readyState === 1 && ws.__lobbyWatch)
}

function broadcastRooms() {
  const msg = { t: 'rooms', rooms: roomList() }
  for (const ws of lobbyWatchers()) send(ws, msg)
}

function detachFromRooms(ws) {
  for (const room of [...rooms.values()]) {
    if (room.host === ws) {
      // 房主离开 → 通知客机并销毁房间
      if (room.guest) send(room.guest, { t: 'peer-left', reason: '房主已关闭房间' })
      room.guest = null
      rooms.delete(room.code)
    } else if (room.guest === ws) {
      // 客机离开 → 通知房主，房间重新开放
      send(room.host, { t: 'peer-left', reason: '对方已离开房间' })
      room.guest = null
      room.guestName = ''
    }
  }
  broadcastRooms()
}

wss.on('connection', (ws, req) => {
  ws.__room = null
  ws.__role = null
  ws.__lobbyWatch = false
  ws.isAlive = true
  if (req && req.socket && req.socket.remoteAddress) {
    // 连接日志（仅记录地址前缀，避免噪声）
    const ip = String(req.socket.remoteAddress).slice(0, 24)
    console.log(`[ws-server] 连接: ${ip}（当前 ${wss.clients.size} 个连接）`)
  }

  ws.on('pong', () => { ws.isAlive = true })

  ws.on('message', raw => {
    let msg
    try { msg = JSON.parse(String(raw)) } catch { return }
    if (!msg || typeof msg.t !== 'string') return
    ws.isAlive = true

    switch (msg.t) {
      case 'create': {
        if (ws.__room) { send(ws, { t: 'error', msg: '你已在房间中' }); return }
        const name = String(msg.name || '玩家').slice(0, 12)
        const code = makeCode()
        rooms.set(code, { code, host: ws, hostName: name, guest: null, guestName: '', created: Date.now() })
        ws.__room = code
        ws.__role = 'host'
        send(ws, { t: 'created', code })
        broadcastRooms()
        console.log(`[ws-server] 创建房间 ${code}（${name}）`)
        return
      }
      case 'join': {
        if (ws.__room) { send(ws, { t: 'error', msg: '你已在房间中' }); return }
        const code = String(msg.code || '').toUpperCase().trim()
        const name = String(msg.name || '玩家').slice(0, 12)
        const room = rooms.get(code)
        if (!room) { send(ws, { t: 'error', msg: '房间不存在或已关闭' }); return }
        if (room.guest) { send(ws, { t: 'error', msg: '房间已满（双人合作）' }); return }
        if (room.host === ws) { send(ws, { t: 'error', msg: '不能加入自己的房间' }); return }
        room.guest = ws
        room.guestName = name
        ws.__room = code
        ws.__role = 'guest'
        send(ws, { t: 'joined', code, host: room.hostName })
        send(room.host, { t: 'peer', name })
        broadcastRooms()
        console.log(`[ws-server] ${name} 加入房间 ${code}`)
        return
      }
      case 'leave': {
        detachFromRooms(ws)
        ws.__room = null
        ws.__role = null
        return
      }
      case 'watch-lobby': {
        ws.__lobbyWatch = true
        send(ws, { t: 'rooms', rooms: roomList() })
        return
      }
      case 'unwatch-lobby': {
        ws.__lobbyWatch = false
        return
      }
      case 'list': {
        send(ws, { t: 'rooms', rooms: roomList() })
        return
      }
      case 'relay': {
        if (!ws.__room) return
        const room = rooms.get(ws.__room)
        if (!room) return
        const peer = room.host === ws ? room.guest : room.host
        if (peer) send(peer, { t: 'relay', payload: msg.payload })
        return
      }
      case 'ping': {
        send(ws, { t: 'pong' })
        return
      }
    }
  })

  ws.on('close', () => {
    detachFromRooms(ws)
    console.log(`[ws-server] 断开（当前 ${wss.clients.size} 个连接）`)
  })

  ws.on('error', () => { /* close 会跟着触发 */ })
})

// 心跳：30s 检查一次，两次无响应的连接强制断开
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { try { ws.terminate() } catch { /* noop */ } continue }
    ws.isAlive = false
    try { ws.ping() } catch { /* noop */ }
  }
}, 30000)

// 定期清理超时房间 + 向订阅者推送列表
setInterval(() => {
  const now = Date.now()
  let changed = false
  for (const [code, room] of [...rooms.entries()]) {
    if (now - room.created > ROOM_TTL) {
      if (room.guest) send(room.guest, { t: 'peer-left', reason: '房间已超时关闭' })
      if (room.host) send(room.host, { t: 'peer-left', reason: '房间已超时关闭' })
      rooms.delete(code)
      changed = true
    }
  }
  if (changed || lobbyWatchers().length) broadcastRooms()
}, LOBBY_PUSH_INTERVAL)

process.on('SIGINT', () => {
  console.log('[ws-server] 关闭中…')
  for (const room of rooms.values()) {
    if (room.guest) send(room.guest, { t: 'peer-left', reason: '服务器关闭' })
    if (room.host) send(room.host, { t: 'peer-left', reason: '服务器关闭' })
  }
  setTimeout(() => process.exit(0), 200)
})
