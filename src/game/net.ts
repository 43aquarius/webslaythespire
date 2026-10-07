// ============ 联机（仿杀戮尖塔2合作模式）：双通道网络层 ============
// 通道一「服务器中转」（默认）：经 Next.js 内置的 /api/mp 轮询中转服务收发消息。
//   背景：部署平台网关对 WebSocket 升级只做假应答（101 后不转发数据帧），独立端口转发公网不可用；
//   唯一稳定通道是应用本身(3000端口)的 HTTP 请求，因此中转服务内置在 /api/mp，客户端短轮询收发。
// 通道二「P2P 直连」（可选，保留）：PeerJS + WebRTC 直连，无需服务器，
//   依赖公共信令服务器(0.peerjs.com)建立连接，无大厅列表，仅房间码互通。
// 两种通道下游戏逻辑均为"房主权威"——房主持有完整状态并广播快照，客机动作转发给房主执行。
import type { CharacterId } from './types'

export type NetRole = 'host' | 'guest'
export type NetStatus = 'idle' | 'starting' | 'waiting' | 'connecting' | 'connected' | 'error'
export type NetMode = 'server' | 'p2p'

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
const MODE_KEY = 'stsNetMode'

/** 官方联机服务器（默认） */
export const OFFICIAL_SERVER = 'https://slaythespire.space-z.ai'

export function makeRoomCode(len = 4): string {
  let s = ''
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}

// ============ 连接方式（服务器中转 / P2P 直连） ============

export function netMode(): NetMode {
  try { return localStorage.getItem(MODE_KEY) === 'p2p' ? 'p2p' : 'server' } catch { return 'server' }
}

export function setNetMode(m: NetMode) {
  try {
    if (m === 'p2p') localStorage.setItem(MODE_KEY, 'p2p')
    else localStorage.setItem(MODE_KEY, 'server')
  } catch { /* noop */ }
}

// ============ 服务器地址（HTTP 轮询中转） ============

/** 规范化服务器地址：去掉末尾斜杠；未指向 /api/mp 的自动补全 */
export function normalizeServerBase(url: string): string {
  let u = url.trim().replace(/\/+$/, '')
  if (!u) return u
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  if (!/\/api\/mp$/i.test(u)) u = u + '/api/mp'
  return u
}

/** 联机服务器地址候选（依次尝试） */
export function serverCandidates(): string[] {
  const out: string[] = []
  try {
    const saved = localStorage.getItem(SERVER_KEY)
    if (saved) out.push(normalizeServerBase(saved))
  } catch { /* localStorage 不可用 */ }
  out.push(OFFICIAL_SERVER + '/api/mp')
  if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) {
    out.push(normalizeServerBase(location.origin))
  }
  out.push('http://localhost:3000/api/mp')
  return [...new Set(out)]
}

/** 手动设置联机服务器地址（保存到 localStorage；空串 = 恢复默认） */
export function setServerUrl(url: string) {
  try {
    if (url.trim()) localStorage.setItem(SERVER_KEY, normalizeServerBase(url))
    else localStorage.removeItem(SERVER_KEY)
  } catch { /* noop */ }
}

export function getServerUrl(): string {
  try { return localStorage.getItem(SERVER_KEY) || '' } catch { return '' }
}

/** 服务器→客户端 信箱消息 */
type SrvMsg =
  | { t: 'peer'; name: string }
  | { t: 'peer-left'; reason: string }
  | { t: 'relay'; payload: NetMsg }
  | { t: 'error'; msg: string }

// ============ 公共骨架（两个后端共用的事件与状态派发） ============

abstract class NetBase {
  role: NetRole | null = null
  roomCode = ''
  myName = '玩家'
  peerName = ''
  protected listeners: Listener[] = []
  protected stateListeners: StateListener[] = []
  protected roomsListeners: RoomsListener[] = []
  protected lastErrorToast = 0

  onMessage(fn: Listener) { this.listeners.push(fn) }
  onState(fn: StateListener) { this.stateListeners.push(fn) }
  onRooms(fn: RoomsListener) { this.roomsListeners.push(fn) }
  protected emit(msg: NetMsg) { this.listeners.forEach(l => { try { l(msg) } catch { /* noop */ } }) }
  protected setState(s: Partial<NetState>) { this.stateListeners.forEach(l => { try { l(s) } catch { /* noop */ } }) }

  /** 玩家可见的错误提示（带节流，避免重复轰炸） */
  toastError(msg: string) {
    const now = Date.now()
    if (now - this.lastErrorToast < 3000) return
    this.lastErrorToast = now
    this.setState({ error: msg, status: 'error' })
    setTimeout(() => this.setState({ error: null }), 5000)
  }

  abstract host(myName: string): Promise<string>
  abstract join(myName: string, code: string): Promise<void>
  abstract send(msg: NetMsg): boolean
  abstract leave(): void
  abstract cleanup(): void
  /** 订阅房间大厅列表（P2P 无此能力，resolve 空列表） */
  abstract watchLobby(): Promise<void>
  abstract unwatchLobby(): void
  abstract listRooms(): Promise<RoomInfo[]>
}

// ============ 通道一：HTTP 轮询中转（默认，经 /api/mp） ============

class HttpRelay extends NetBase {
  private base = ''                 // 已验证可用的 /api/mp 地址
  private outbox: NetMsg[] = []     // 待发送（client→服务器）
  private pumpTimer: ReturnType<typeof setInterval> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private roomsTimer: ReturnType<typeof setInterval> | null = null
  private polling = false
  private pumping = false
  private pollFails = 0
  private lobbyWatching = false
  private lastRooms: RoomInfo[] = []
  private destroyed = false

  /** 依次尝试候选地址，返回第一个对 action 应答 ok 的地址 */
  private async tryCandidates(action: Record<string, unknown>): Promise<{ base: string; data: Record<string, unknown> }> {
    const candidates = serverCandidates()
    let lastErr = ''
    for (const base of candidates) {
      if (this.destroyed) throw new Error('已取消')
      try {
        const data = await this.post(base, action, 6000)
        if (data && data.ok) return { base, data }
        lastErr = String((data as { error?: string }).error || '服务器返回异常')
      } catch (err) {
        lastErr = String((err as Error)?.message || err)
      }
    }
    throw new Error('无法连接联机服务器（已尝试：' + candidates.join('、') + '）。可在「服务器」中填写地址，或改用 P2P 直连')
  }

  private async post(base: string, body: Record<string, unknown>, timeoutMs = 8000): Promise<Record<string, unknown>> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      return (await res.json()) as Record<string, unknown>
    } finally {
      clearTimeout(timer)
    }
  }

  async host(myName: string): Promise<string> {
    this.cleanup()
    this.destroyed = false
    this.role = 'host'
    this.myName = myName
    this.setState({ role: 'host', status: 'starting', roomCode: '', connected: false, error: null, myName, lobby: { hostChar: null, guestChar: null } })
    const { base, data } = await this.tryCandidates({ t: 'create', name: myName })
    this.base = base
    const code = String(data.code || '')
    this.roomCode = code
    this.setState({ status: 'waiting', roomCode: code })
    this.startRoomLoops()
    return code
  }

  async join(myName: string, code: string): Promise<void> {
    this.cleanup()
    this.destroyed = false
    this.role = 'guest'
    this.myName = myName
    this.roomCode = code
    this.setState({ role: 'guest', status: 'connecting', roomCode: code, connected: false, error: null, myName })
    const { base, data } = await this.tryCandidates({ t: 'join', code: code.toUpperCase(), name: myName })
    this.base = base
    this.setState({ status: 'connected', connected: true, myIdx: 1, peerName: String(data.host || '房主') })
    this.startRoomLoops()
    this.send({ t: 'hello', name: this.myName })
  }

  private startRoomLoops() {
    this.stopLoops()
    this.pollFails = 0
    this.pollTimer = setInterval(() => { this.pollOnce() }, 700)
    this.pumpTimer = setInterval(() => { this.pumpOnce() }, 180)
    this.pollOnce()
  }

  private stopLoops() {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null }
    if (this.pumpTimer) { clearInterval(this.pumpTimer); this.pumpTimer = null }
    this.polling = false
    this.pumping = false
  }

  /** 轮询自己信箱：取出 peer / peer-left / relay 消息并分发 */
  private async pollOnce() {
    if (!this.role || !this.base || this.polling || this.destroyed) return
    this.polling = true
    try {
      const data = await this.post(this.base, { t: 'poll', code: this.roomCode, role: this.role }, 6000)
      if (!data.ok) throw new Error(String(data.error || 'poll-failed'))
      this.pollFails = 0
      const msgs = (data.msgs || []) as SrvMsg[]
      for (const m of msgs) this.handleSrv(m)
    } catch {
      this.pollFails++
      if (this.pollFails >= 4) {
        this.stopLoops()
        this.setState({ connected: false })
        this.emit({ t: 'left', reason: '与服务器的连接已断开' })
      }
    } finally {
      this.polling = false
    }
  }

  /** 把待发消息逐条发往服务器（保持顺序） */
  private async pumpOnce() {
    if (!this.role || !this.base || this.pumping || this.destroyed || !this.outbox.length) return
    this.pumping = true
    try {
      while (this.outbox.length && !this.destroyed) {
        const msg = this.outbox[0]
        const data = await this.post(this.base, { t: 'relay', code: this.roomCode, role: this.role, payload: msg }, 8000)
        if (!data.ok) {
          if (data.error === 'room-gone') {
            this.outbox.length = 0
            this.stopLoops()
            this.setState({ connected: false })
            this.emit({ t: 'left', reason: '房间已关闭' })
            return
          }
          throw new Error('relay-failed')
        }
        this.outbox.shift()
        this.pollFails = 0
      }
    } catch {
      // 网络抖动：下个泵周期重试（消息留在 outbox 队首，顺序不乱）
    } finally {
      this.pumping = false
    }
  }

  private handleSrv(msg: SrvMsg) {
    switch (msg.t) {
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
      case 'error':
        this.toastError(msg.msg)
        break
    }
  }

  send(msg: NetMsg): boolean {
    if (!this.role) return false
    this.outbox.push(msg)
    if (this.outbox.length > 40) this.outbox.splice(0, this.outbox.length - 40)   // 防爆仓
    return true
  }

  async watchLobby(): Promise<void> {
    if (this.lobbyWatching) return
    const { base } = await this.tryCandidates({ t: 'rooms' })
    this.base = base
    this.lobbyWatching = true
    const fetchRooms = async () => {
      try {
        const data = await this.post(this.base, { t: 'rooms' }, 6000)
        if (data.ok) {
          this.lastRooms = (data.rooms || []) as RoomInfo[]
          this.roomsListeners.forEach(l => { try { l(this.lastRooms) } catch { /* noop */ } })
        }
      } catch { /* 大厅轮询失败静默，下轮再试 */ }
    }
    void fetchRooms()
    this.roomsTimer = setInterval(fetchRooms, 2500)
  }

  unwatchLobby() {
    this.lobbyWatching = false
    if (this.roomsTimer) { clearInterval(this.roomsTimer); this.roomsTimer = null }
  }

  async listRooms(): Promise<RoomInfo[]> {
    if (this.lobbyWatching) {
      // 已在轮询中：主动触发一次立即拉取
      try {
        const data = await this.post(this.base, { t: 'rooms' }, 6000)
        if (data.ok) {
          this.lastRooms = (data.rooms || []) as RoomInfo[]
          this.roomsListeners.forEach(l => { try { l(this.lastRooms) } catch { /* noop */ } })
        }
      } catch { /* noop */ }
      return this.lastRooms
    }
    if (!this.base) throw new Error('未连接服务器')
    return this.lastRooms
  }

  leave() {
    if (this.base && this.roomCode && this.role) {
      // 尽力通知（fire-and-forget；页面关闭场景用 keepalive）
      try {
        void fetch(this.base, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ t: 'leave', code: this.roomCode, role: this.role }),
          keepalive: true,
        }).catch(() => { /* noop */ })
      } catch { /* noop */ }
    }
    this.destroyed = true
    this.stopLoops()
    this.outbox.length = 0
    this.role = null
    this.setState({ role: null, status: 'idle', connected: false, roomCode: '', peerName: '' })
  }

  cleanup() {
    this.destroyed = true
    this.stopLoops()
    this.unwatchLobby()
    this.outbox.length = 0
    this.role = null
    this.base = ''
  }
}

// ============ 通道二：P2P 直连（PeerJS + WebRTC，无需服务器） ============

interface PeerConn {
  send: (data: unknown) => void
  close: () => void
  open: boolean
  on: (ev: string, fn: (...a: unknown[]) => void) => void
}
interface PeerInst {
  connect: (id: string, opts: { reliable: boolean }) => PeerConn
  destroy: () => void
  on: (ev: string, fn: (...a: never[]) => void) => void
}

const ID_PREFIX = 'stsw3-'

class PeerRelay extends NetBase {
  private peer: PeerInst | null = null
  private conn: PeerConn | null = null

  /** 按需加载 PeerJS（避免常规路径打包体积；esbuild/webpack 均可内联或分包） */
  private async loadPeer(): Promise<{ new (idOrOpts?: string | Record<string, unknown>, opts?: unknown): PeerInst }> {
    const mod = await import('peerjs')
    const PeerCtor = (mod as unknown as { default?: unknown }).default as unknown as { new (idOrOpts?: string | Record<string, unknown>, opts?: unknown): PeerInst }
    if (!PeerCtor) throw new Error('P2P 模块加载失败，请改用服务器中转')
    return PeerCtor
  }

  async host(myName: string): Promise<string> {
    this.cleanup()
    this.role = 'host'
    this.myName = myName
    this.setState({ role: 'host', status: 'starting', roomCode: '', connected: false, error: null, myName, lobby: { hostChar: null, guestChar: null } })
    const attempt = async (): Promise<string> => {
      const code = makeRoomCode()
      this.roomCode = code
      const PeerCtor = await this.loadPeer()
      return await new Promise<string>((resolve, reject) => {
        const peer = new PeerCtor(ID_PREFIX + code, { debug: 0 })
        this.peer = peer
        const timeout = setTimeout(() => {
          reject(new Error('连接信令服务器超时，请检查网络后重试，或改用服务器中转'))
          this.cleanup()
        }, 15000)
        peer.on('open', () => {
          clearTimeout(timeout)
          this.setState({ status: 'waiting', roomCode: code })
          resolve(code)
        })
        peer.on('connection', (conn: PeerConn) => {
          if (this.conn && this.conn.open) { conn.close(); return }   // 已有玩家
          this.bindConn(conn, 'host')
        })
        peer.on('error', (err: unknown) => {
          clearTimeout(timeout)
          const msg = String((err as Error)?.message || err)
          if (msg.includes('taken') || msg.includes('unavailable')) {
            // 房间码冲突：换一个重试
            void this.host(myName).then(resolve).catch(reject)
            return
          }
          this.setState({ status: 'error', error: '网络错误：' + msg })
          reject(new Error(msg))
        })
      })
    }
    return attempt()
  }

  async join(myName: string, code: string): Promise<void> {
    this.cleanup()
    this.role = 'guest'
    this.myName = myName
    this.roomCode = code
    this.setState({ role: 'guest', status: 'connecting', roomCode: code, connected: false, error: null, myName })
    const PeerCtor = await this.loadPeer()
    await new Promise<void>((resolve, reject) => {
      const peer = new PeerCtor({ debug: 0 }) as PeerInst
      this.peer = peer
      const timeout = setTimeout(() => {
        reject(new Error('连接超时：检查房间码与网络，或改用服务器中转'))
        this.cleanup()
      }, 20000)
      peer.on('open', () => {
        const conn = peer.connect(ID_PREFIX + code.toUpperCase(), { reliable: true })
        this.bindConn(conn, 'guest')
        conn.on('open', () => { clearTimeout(timeout); resolve() })
        conn.on('error', () => {
          clearTimeout(timeout)
          reject(new Error('无法连接到房间'))
        })
      })
      peer.on('error', (err: unknown) => {
        clearTimeout(timeout)
        const msg = String((err as Error)?.message || err)
        this.setState({ status: 'error', error: '无法加入：请检查房间码（' + msg + '）' })
        reject(new Error(msg))
      })
    })
  }

  private bindConn(conn: PeerConn, role: NetRole) {
    this.conn = conn
    conn.on('open', () => {
      this.setState({ status: 'connected', connected: true, myIdx: role === 'host' ? 0 : 1 })
      if (role === 'guest') this.send({ t: 'hello', name: this.myName })
    })
    conn.on('data', (raw: unknown) => {
      try {
        const msg = typeof raw === 'string' ? JSON.parse(raw) : raw
        this.emit(msg as NetMsg)
      } catch { /* 忽略坏包 */ }
    })
    conn.on('close', () => {
      const wasConnected = this.conn === conn
      if (wasConnected) {
        this.conn = null
        this.setState({ connected: false })
        this.emit({ t: 'left', reason: '对方已断开连接' })
      }
    })
    conn.on('error', () => { /* close 会跟着触发 */ })
  }

  send(msg: NetMsg): boolean {
    if (!this.conn || !this.conn.open) return false
    try { this.conn.send(msg) } catch { return false }
    return true
  }

  async watchLobby(): Promise<void> {
    // P2P 无服务器 → 无大厅列表（UI 隐藏列表，仅房间码互通）
    this.roomsListeners.forEach(l => { try { l([]) } catch { /* noop */ } })
  }

  unwatchLobby() { /* 无操作 */ }

  async listRooms(): Promise<RoomInfo[]> { return [] }

  leave() {
    if (this.conn?.open) this.send({ t: 'left', reason: '主动退出' })
    setTimeout(() => this.cleanup(), 100)
    this.role = null
    this.setState({ role: null, status: 'idle', connected: false, roomCode: '', peerName: '' })
  }

  cleanup() {
    try { this.conn?.close() } catch { /* noop */ }
    try { this.peer?.destroy() } catch { /* noop */ }
    this.conn = null
    this.peer = null
    this.role = null
  }
}

// ============ 对外门面：按连接方式委托到对应后端 ============

class NetManager {
  private http = new HttpRelay()
  private p2p = new PeerRelay()
  private active: NetBase = this.http

  /** 当前连接方式（读取 localStorage） */
  get mode(): NetMode { return netMode() }

  /** 切换连接方式（未在房间内时调用） */
  setMode(m: NetMode) {
    setNetMode(m)
    this.active = m === 'p2p' ? this.p2p : this.http
  }

  get role(): NetRole | null { return this.active.role }
  get roomCode(): string { return this.active.roomCode }
  get myName(): string { return this.active.myName }
  get peerName(): string { return this.active.peerName }

  onMessage(fn: Listener) { this.http.onMessage(fn); this.p2p.onMessage(fn) }
  onState(fn: StateListener) { this.http.onState(fn); this.p2p.onState(fn) }
  onRooms(fn: RoomsListener) { this.http.onRooms(fn); this.p2p.onRooms(fn) }

  host(myName: string): Promise<string> {
    this.active = netMode() === 'p2p' ? this.p2p : this.http
    return this.active.host(myName)
  }

  join(myName: string, code: string): Promise<void> {
    this.active = netMode() === 'p2p' ? this.p2p : this.http
    return this.active.join(myName, code)
  }

  send(msg: NetMsg): boolean { return this.active.send(msg) }
  leave() { this.active.leave() }
  cleanup() { this.http.cleanup(); this.p2p.cleanup() }
  watchLobby(): Promise<void> {
    this.active = netMode() === 'p2p' ? this.p2p : this.http
    return this.active.watchLobby()
  }
  unwatchLobby() { this.active.unwatchLobby() }
  async listRooms(): Promise<RoomInfo[]> { return this.active.listRooms() }
  toastError(msg: string) { this.active.toastError(msg) }
}

export const net = new NetManager()
