// ============ 联机（仿杀戮尖塔2合作模式）：WebSocket 中转网络层 ============
// 架构：轻量 WebSocket 中转服务器（scripts/ws-server.js）负责房间管理与消息转发；
//       游戏逻辑仍为"房主权威"——房主持有完整状态并广播快照，客机动作转发给房主执行。
// 相比旧版 PeerJS P2P：不再依赖公共信令服务器与 WebRTC 打洞，连接稳定可靠；
//                       服务器同时提供房间大厅列表（创建/浏览/一键加入）。
import type { CharacterId } from './types'

export type NetRole = 'host' | 'guest'
export type NetStatus = 'idle' | 'starting' | 'waiting' | 'connecting' | 'connected' | 'error'

export interface NetLobby {
  hostChar: CharacterId | null
  guestChar: CharacterId | null
}

export type NetMsg =
  | { t: 'hello'; name: string }
  | { t: 'welcome'; hostName: string }
  | { t: 'lobby'; lobby: NetLobby }
  | { t: 'act'; fn: string; args: unknown[] }
  | { t: 'snap'; run: unknown; select: unknown; busy: boolean; endBanner: unknown; toast: string | null }
  | { t: 'left'; reason: string }

/** 大厅房间信息（服务器房间列表） */
export interface RoomInfo {
  code: string
  host: string
  guests: number
  status: 'open' | 'full'
  created: number
}

export interface NetState {
  role: NetRole | null
  status: NetStatus
  roomCode: string
  myName: string
  peerName: string
  myIdx: number            // 房主 0 / 客机 1
  connected: boolean
  lobby: NetLobby
  error: string | null
}

type Listener = (msg: NetMsg) => void
type StateListener = (s: Partial<NetState>) => void
type RoomsListener = (rooms: RoomInfo[]) => void

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'   // 去掉易混淆字符
const SERVER_KEY = 'stsNetServer'

export function makeRoomCode(len = 4): string {
  let s = ''
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}

/** 联机服务器地址候选（依次尝试） */
export function wsCandidates(): string[] {
  const out: string[] = []
  try {
    const saved = localStorage.getItem(SERVER_KEY)
    if (saved) out.push(saved.replace(/\/+$/, ''))
  } catch { /* localStorage 不可用 */ }
  if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) {
    const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    out.push(`${wsProto}//${location.host}/?XTransformPort=3001`)
    out.push(`${wsProto}//${location.host}:3001`)
  }
  out.push('ws://localhost:3001')
  out.push('ws://127.0.0.1:3001')
  return [...new Set(out)]
}

/** 手动设置联机服务器地址（保存到 localStorage） */
export function setServerUrl(url: string) {
  try {
    if (url.trim()) localStorage.setItem(SERVER_KEY, url.trim().replace(/\/+$/, ''))
    else localStorage.removeItem(SERVER_KEY)
  } catch { /* noop */ }
}

export function getServerUrl(): string {
  try { return localStorage.getItem(SERVER_KEY) || '' } catch { return '' }
}

/** 服务器→客户端 消息 */
type SrvMsg =
  | { t: 'created'; code: string }
  | { t: 'joined'; code: string; host: string }
  | { t: 'peer'; name: string }
  | { t: 'peer-left'; reason: string }
  | { t: 'relay'; payload: NetMsg }
  | { t: 'rooms'; rooms: RoomInfo[] }
  | { t: 'pong' }
  | { t: 'error'; msg: string }

class NetManager {
  ws: WebSocket | null = null
  role: NetRole | null = null
  roomCode = ''
  myName = '玩家'
  peerName = ''
  private lobbyWatching = false
  private lastRooms: RoomInfo[] = []
  private listeners: Listener[] = []
  private stateListeners: StateListener[] = []
  private roomsListeners: RoomsListener[] = []
  private lastErrorToast = 0
  private hbTimer: ReturnType<typeof setInterval> | null = null
  private confirms: ((m: SrvMsg) => void)[] = []

  onMessage(fn: Listener) { this.listeners.push(fn) }
  onState(fn: StateListener) { this.stateListeners.push(fn) }
  onRooms(fn: RoomsListener) { this.roomsListeners.push(fn) }
  private emit(msg: NetMsg) { this.listeners.forEach(l => { try { l(msg) } catch { /* noop */ } }) }
  private setState(s: Partial<NetState>) { this.stateListeners.forEach(l => { try { l(s) } catch { /* noop */ } }) }

  /** 依次尝试候选地址建立 WebSocket 连接 */
  private connect(): Promise<WebSocket> {
    const candidates = wsCandidates()
    return new Promise((resolve, reject) => {
      let idx = 0
      const tryNext = () => {
        if (idx >= candidates.length) {
          reject(new Error('无法连接联机服务器（已尝试：' + candidates.join('、') + '）。自托管用户请先运行 node scripts/ws-server.js，或在下方填写服务器地址'))
          return
        }
        const url = candidates[idx++]
        let settled = false
        let ws: WebSocket
        try { ws = new WebSocket(url) } catch { tryNext(); return }
        const timer = setTimeout(() => {
          if (settled) return
          settled = true
          try { ws.close() } catch { /* noop */ }
          tryNext()
        }, 3500)
        ws.onopen = () => {
          if (settled) { try { ws.close() } catch { /* noop */ } return }
          settled = true
          clearTimeout(timer)
          this.attachWs(ws)
          resolve(ws)
        }
        ws.onerror = () => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          tryNext()
        }
        ws.onclose = () => {
          if (!settled) { settled = true; clearTimeout(timer); tryNext() }
        }
      }
      tryNext()
    })
  }

  private attachWs(ws: WebSocket) {
    this.ws = ws
    // 心跳（一个周期内无任何服务器消息则判定断线）
    if (this.hbTimer) clearInterval(this.hbTimer)
    let alive = true
    ws.addEventListener('message', () => { alive = true })
    this.hbTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== 1) { if (this.hbTimer) clearInterval(this.hbTimer); return }
      if (!alive) { try { this.ws.close() } catch { /* noop */ } return }
      alive = false
      this.sendRaw({ t: 'ping' })
    }, 30000)
    // 客户端 pong 标记（收到任何服务器消息即存活）
    ws.onmessage = ev => {
      alive = true
      try {
        const msg = JSON.parse(String(ev.data)) as SrvMsg
        this.confirms.forEach(h => { try { h(msg) } catch { /* noop */ } })
        this.handleSrv(msg)
      } catch { /* 忽略坏包 */ }
    }
    ws.onclose = () => {
      if (this.hbTimer) { clearInterval(this.hbTimer); this.hbTimer = null }
      if (this.ws === ws) {
        const wasConnected = this.role !== null
        this.ws = null
        if (wasConnected) {
          this.setState({ connected: false })
          this.emit({ t: 'left', reason: '与服务器的连接已断开' })
        }
      }
    }
    ws.onerror = () => { /* onclose 会跟着触发 */ }
  }

  private handleSrv(msg: SrvMsg) {
    switch (msg.t) {
      case 'created':
        this.roomCode = msg.code
        this.setState({ status: 'waiting', roomCode: msg.code, connected: false })
        break
      case 'joined':
        this.roomCode = msg.code
        this.setState({ status: 'connected', connected: true, myIdx: 1, peerName: msg.host })
        this.send({ t: 'hello', name: this.myName })
        break
      case 'peer':   // 房主：客机进入房间
        this.setState({ status: 'connected', connected: true, myIdx: 0, peerName: msg.name })
        break
      case 'peer-left':
        this.setState({ connected: false, peerName: '' })
        this.emit({ t: 'left', reason: msg.reason })
        break
      case 'relay':
        this.emit(msg.payload)
        break
      case 'rooms':
        this.lastRooms = msg.rooms || []
        this.roomsListeners.forEach(l => { try { l(this.lastRooms) } catch { /* noop */ } })
        break
      case 'error':
        this.toastError(msg.msg)
        break
      case 'pong':
        break
    }
  }

  /** 等待服务器特定确认消息（host/join 的握手应答） */
  private waitConfirm<T>(accept: (m: SrvMsg) => T | null, timeoutMs = 8000): Promise<T> {
    return new Promise((resolve, reject) => {
      let done = false
      const finish = (fn: () => void) => {
        if (done) return
        done = true
        clearTimeout(timer)
        const i = this.confirms.indexOf(h)
        if (i >= 0) this.confirms.splice(i, 1)
        fn()
      }
      const timer = setTimeout(() => finish(() => reject(new Error('服务器响应超时，请重试'))), timeoutMs)
      const h = (m: SrvMsg) => {
        let r: T | null = null
        try { r = accept(m) } catch (err) { finish(() => reject(err)); return }
        if (r === null) return
        const val = r
        finish(() => resolve(val))
      }
      this.confirms.push(h)
    })
  }

  /** 创建房间（房主） */
  async host(myName: string): Promise<string> {
    this.cleanup()
    this.role = 'host'
    this.myName = myName
    this.setState({ role: 'host', status: 'starting', connected: false, error: null, myName, lobby: { hostChar: null, guestChar: null } })
    const confirmP = this.waitConfirm<string>(m => {
      if (m.t === 'created') return m.code
      if (m.t === 'error') throw new Error(m.msg)
      return null
    })
    await this.connect()
    this.sendRaw({ t: 'create', name: myName })
    const code = await confirmP
    this.roomCode = code
    return code
  }

  /** 加入房间（客机） */
  async join(myName: string, code: string): Promise<void> {
    this.cleanup()
    this.role = 'guest'
    this.myName = myName
    this.roomCode = code
    this.setState({ role: 'guest', status: 'connecting', roomCode: code, connected: false, error: null, myName })
    const confirmP = this.waitConfirm<void>(m => {
      if (m.t === 'joined') return undefined as unknown as void
      if (m.t === 'error') throw new Error(m.msg)
      return null
    })
    await this.connect()
    this.sendRaw({ t: 'join', code: code.toUpperCase(), name: myName })
    await confirmP
  }

  /** 订阅房间大厅列表（进入联机界面时调用，服务器会推送实时更新） */
  async watchLobby(): Promise<void> {
    if (this.ws && this.ws.readyState === 1) {
      this.lobbyWatching = true
      this.sendRaw({ t: 'watch-lobby' })
      return
    }
    // 尚无连接：先连服务器（不进入房间），失败静默（大厅显示离线）
    try {
      const savedRole = this.role
      await this.connect()
      this.lobbyWatching = true
      this.role = savedRole
      this.sendRaw({ t: 'watch-lobby' })
    } catch (err) {
      this.roomsListeners.forEach(l => { try { l([]) } catch { /* noop */ } })
      throw err
    }
  }

  unwatchLobby() {
    this.lobbyWatching = false
    if (this.ws && this.ws.readyState === 1 && !this.role) this.sendRaw({ t: 'unwatch-lobby' })
  }

  /** 一次性拉取房间列表 */
  async listRooms(): Promise<RoomInfo[]> {
    if (!this.ws || this.ws.readyState !== 1) throw new Error('未连接服务器')
    this.sendRaw({ t: 'list' })
    return this.lastRooms
  }

  private sendRaw(obj: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== 1) return
    try { this.ws.send(JSON.stringify(obj)) } catch { /* noop */ }
  }

  /** 发送游戏消息给队友（经服务器中转） */
  send(msg: NetMsg): boolean {
    if (!this.ws || this.ws.readyState !== 1) return false
    this.sendRaw({ t: 'relay', payload: msg })
    return true
  }

  /** 玩家可见的错误提示（带节流，避免重复轰炸） */
  toastError(msg: string) {
    const now = Date.now()
    if (now - this.lastErrorToast < 3000) return
    this.lastErrorToast = now
    this.setState({ error: msg })
    setTimeout(() => this.setState({ error: null }), 5000)
  }

  cleanup() {
    if (this.hbTimer) { clearInterval(this.hbTimer); this.hbTimer = null }
    try { this.ws?.close() } catch { /* noop */ }
    this.ws = null
    this.role = null
    this.lobbyWatching = false
    this.lastRooms = []
  }

  leave() {
    if (this.ws && this.ws.readyState === 1) this.sendRaw({ t: 'leave' })
    const keepWs = this.lobbyWatching && this.ws   // 留在大厅浏览时保持连接
    if (!keepWs) setTimeout(() => this.cleanup(), 100)
    this.role = null
    this.setState({ role: null, status: 'idle', connected: false, roomCode: '', peerName: '' })
  }
}

export const net = new NetManager()
