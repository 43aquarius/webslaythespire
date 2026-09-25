// ============ 联机（仿杀戮尖塔2合作模式）：PeerJS P2P 网络层 ============
// 房主权威：房主持有完整游戏状态并广播快照；客机动作转发给房主执行。
// 依赖 PeerJS 公共信令服务器（0.peerjs.com）建立 WebRTC 直连，无需自建后端。
import Peer, { DataConnection } from 'peerjs'
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

const ID_PREFIX = 'stsw3-'
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'   // 去掉易混淆字符

export function makeRoomCode(len = 4): string {
  let s = ''
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}

class NetManager {
  peer: Peer | null = null
  conn: DataConnection | null = null
  role: NetRole | null = null
  roomCode = ''
  myName = '玩家'
  peerName = ''
  private listeners: Listener[] = []
  private stateListeners: StateListener[] = []
  private lastErrorToast = 0

  onMessage(fn: Listener) { this.listeners.push(fn) }
  onState(fn: StateListener) { this.stateListeners.push(fn) }
  private emit(msg: NetMsg) { this.listeners.forEach(l => { try { l(msg) } catch { /* noop */ } }) }
  private setState(s: Partial<NetState>) { this.stateListeners.forEach(l => { try { l(s) } catch { /* noop */ } }) }

  /** 创建房间（房主） */
  host(myName: string, code = makeRoomCode()): Promise<string> {
    this.cleanup()
    this.role = 'host'
    this.myName = myName
    this.roomCode = code
    this.setState({ role: 'host', status: 'starting', roomCode: code, connected: false, error: null, myName, lobby: { hostChar: null, guestChar: null } })
    return new Promise((resolve, reject) => {
      const peer = new Peer(ID_PREFIX + code, { debug: 0 })
      this.peer = peer
      const timeout = setTimeout(() => {
        reject(new Error('连接信令服务器超时，请检查网络后重试'))
        this.cleanup()
      }, 15000)
      peer.on('open', () => {
        clearTimeout(timeout)
        this.setState({ status: 'waiting' })
        resolve(code)
      })
      peer.on('connection', conn => {
        if (this.conn && this.conn.open) { conn.close(); return }   // 已有玩家
        this.bindConn(conn, 'host')
      })
      peer.on('error', err => {
        clearTimeout(timeout)
        const msg = String((err as Error)?.message || err)
        if (msg.includes('taken') || msg.includes('unavailable')) {
          // 房间码冲突：换一个重试
          this.host(myName).then(resolve).catch(reject)
          return
        }
        this.setState({ status: 'error', error: '网络错误：' + msg })
        reject(new Error(msg))
      })
    })
  }

  /** 加入房间（客机） */
  join(myName: string, code: string): Promise<void> {
    this.cleanup()
    this.role = 'guest'
    this.myName = myName
    this.roomCode = code
    this.setState({ role: 'guest', status: 'connecting', roomCode: code, connected: false, error: null, myName })
    return new Promise((resolve, reject) => {
      const peer = new Peer({ debug: 0 })
      this.peer = peer
      const timeout = setTimeout(() => {
        reject(new Error('连接超时：检查房间码与网络'))
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
      peer.on('error', err => {
        clearTimeout(timeout)
        const msg = String((err as Error)?.message || err)
        this.setState({ status: 'error', error: '无法加入：请检查房间码（' + msg + '）' })
        reject(new Error(msg))
      })
    })
  }

  private bindConn(conn: DataConnection, role: NetRole) {
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

  /** 玩家可见的错误提示（带节流，避免重复轰炸） */
  toastError(msg: string) {
    const now = Date.now()
    if (now - this.lastErrorToast < 3000) return
    this.lastErrorToast = now
    this.setState({ error: msg })
    setTimeout(() => this.setState({ error: null }), 4000)
  }

  cleanup() {
    try { this.conn?.close() } catch { /* noop */ }
    try { this.peer?.destroy() } catch { /* noop */ }
    this.conn = null
    this.peer = null
    this.role = null
  }

  leave() {
    if (this.conn?.open) this.send({ t: 'left', reason: '主动退出' })
    setTimeout(() => this.cleanup(), 100)
    this.setState({ role: null, status: 'idle', connected: false, roomCode: '', peerName: '' })
  }
}

export const net = new NetManager()
