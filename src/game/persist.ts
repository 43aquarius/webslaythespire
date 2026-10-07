// ============ 本地持久化：存档 / 统计 / 设置 / 玩家名 ============
import { RunState } from './types'
import type { CharacterId } from './types'

const K_SAVE = 'stsw_save_v1'
const K_STATS = 'stsw_stats_v1'
const K_NAME = 'stsw_name_v1'
const K_MUSIC = 'stsw_music_v1'

export interface SelectLike {
  kind: string
  title: string
  cardUids: string[]
  source: string
  remaining?: number
}

export interface SavePayload {
  run: RunState
  select: SelectLike | null
  bossOptions: string[]
  savedAt: number
}

// ---------- 存档 ----------
export function saveRun(run: RunState, select: SelectLike | null, bossOptions: string[]): boolean {
  try {
    // 联机局不存档（房主机各持一半状态，无法可靠恢复）
    if (run.players.length > 1) return false
    const payload: SavePayload = { run, select, bossOptions, savedAt: Date.now() }
    localStorage.setItem(K_SAVE, JSON.stringify(payload))
    return true
  } catch { return false }
}

export function loadSave(): SavePayload | null {
  try {
    const raw = localStorage.getItem(K_SAVE)
    if (!raw) return null
    const p = JSON.parse(raw) as SavePayload
    if (!p?.run?.players?.length) return null
    return p
  } catch { return null }
}

export function hasSave(): boolean { return !!loadSave() }

export function clearSave() {
  try { localStorage.removeItem(K_SAVE) } catch { /* noop */ }
}

/** 存档是否处于可安全恢复的时点（非敌人回合中） */
export function saveableMoment(run: RunState | null): boolean {
  if (!run) return false
  if (run.screen === 'gameover' || run.screen === 'victory') return false
  if (run.combat && run.combat.phase === 'enemy') return false
  return true
}

// ---------- 统计 ----------
export interface StatsData {
  runs: number
  wins: number
  bestFloor: number
  totalKills: number
  totalElites: number
  totalGold: number
  perChar: Partial<Record<CharacterId, { runs: number; wins: number; bestFloor: number }>>
}

const EMPTY_STATS: StatsData = {
  runs: 0, wins: 0, bestFloor: 0, totalKills: 0, totalElites: 0, totalGold: 0, perChar: {},
}

export function loadStats(): StatsData {
  try {
    const raw = localStorage.getItem(K_STATS)
    if (!raw) return { ...EMPTY_STATS, perChar: {} }
    return { ...EMPTY_STATS, perChar: {}, ...JSON.parse(raw) }
  } catch { return { ...EMPTY_STATS, perChar: {} } }
}

export function recordRunResult(characters: CharacterId[], victory: boolean, floor: number, kills: number, elites: number, gold: number) {
  try {
    const s = loadStats()
    s.runs += 1
    if (victory) s.wins += 1
    s.bestFloor = Math.max(s.bestFloor, floor)
    s.totalKills += kills
    s.totalElites += elites
    s.totalGold += gold
    for (const c of characters) {
      const e = s.perChar[c] || { runs: 0, wins: 0, bestFloor: 0 }
      e.runs += 1
      if (victory) e.wins += 1
      e.bestFloor = Math.max(e.bestFloor, floor)
      s.perChar[c] = e
    }
    localStorage.setItem(K_STATS, JSON.stringify(s))
  } catch { /* noop */ }
}

// ---------- 设置 ----------
export interface SettingsData {
  musicVolume: number   // 0-1
  playerName: string
}

export function loadSettings(): SettingsData {
  let musicVolume = 0.55
  let playerName = ''
  try {
    const m = localStorage.getItem(K_MUSIC)
    if (m !== null) musicVolume = Math.max(0, Math.min(1, parseFloat(m) || 0))
    playerName = localStorage.getItem(K_NAME) || ''
  } catch { /* noop */ }
  if (!playerName) playerName = '玩家' + Math.floor(Math.random() * 900 + 100)
  return { musicVolume, playerName }
}

export function saveMusicVolume(v: number) {
  try { localStorage.setItem(K_MUSIC, String(v)) } catch { /* noop */ }
}

export function savePlayerName(name: string) {
  try { localStorage.setItem(K_NAME, name) } catch { /* noop */ }
}
