'use client'
// ============ BGM 引擎（客户端单例，带淡入淡出与自动播放解锁） ============
// 曲目映射自原版反编译源码 (MusicMaster.java / MainMusic.java)：
//   标题=STS_MenuTheme  第一幕地图&普通战斗=STS_Level1(Exordium)
//   精英=STS_EliteBoss  第一幕Boss=STS_Boss1  商店=STS_Merchant
//   事件=STS_Shrine  结算=STS_Credits  胜利/死亡短曲=Stinger
export type TrackKey =
  | 'menu' | 'level' | 'elite' | 'boss' | 'merchant'
  | 'shrine' | 'credits' | 'victory' | 'death'

const SRC: Record<TrackKey, string> = {
  menu: '/assets/audio/menu.ogg',
  level: '/assets/audio/level.ogg',
  elite: '/assets/audio/elite.ogg',
  boss: '/assets/audio/boss.ogg',
  merchant: '/assets/audio/merchant.ogg',
  shrine: '/assets/audio/shrine.ogg',
  credits: '/assets/audio/credits.ogg',
  victory: '/assets/audio/victory.ogg',
  death: '/assets/audio/death.ogg',
}

const VOL_KEY = 'sts-music-vol'
const MUTE_KEY = 'sts-music-muted'

class MusicEngine {
  private a: HTMLAudioElement
  private b: HTMLAudioElement
  private active: HTMLAudioElement
  private fadeTargets: Array<{ el: HTMLAudioElement; target: number }> = []
  private fadeTimer: ReturnType<typeof setInterval> | null = null
  private currentKey: TrackKey | null = null
  private pendingKey: TrackKey | null = null   // 自动播放被拦截时记录
  private unlocked = false
  private unlockBound = false
  volume = 0.55
  muted = false

  constructor() {
    if (typeof window === 'undefined') {
      // SSR 占位（不会真正使用）
      this.a = this.b = this.active = {} as HTMLAudioElement
      return
    }
    this.volume = Number(localStorage.getItem(VOL_KEY) ?? 0.55)
    this.muted = localStorage.getItem(MUTE_KEY) === '1'
    this.a = new Audio()
    this.b = new Audio()
    for (const el of [this.a, this.b]) {
      el.preload = 'auto'
      el.volume = this.effVol()
    }
    this.active = this.a
  }

  private effVol() { return this.muted ? 0 : this.volume }

  /** 解锁自动播放（首次用户手势时调用） */
  unlock() {
    if (this.unlocked) return
    this.unlocked = true
    if (this.pendingKey) {
      const k = this.pendingKey
      this.pendingKey = null
      this.play(k)
    }
  }

  private ensureUnlock() {
    if (this.unlocked) return
    if (!this.unlockBound) {
      this.unlockBound = true
      const handler = () => {
        this.unlock()
        window.removeEventListener('pointerdown', handler)
        window.removeEventListener('keydown', handler)
      }
      window.addEventListener('pointerdown', handler)
      window.addEventListener('keydown', handler)
    }
  }

  /** 播放循环 BGM（同曲目不重启；切换时 1.6s 淡入淡出） */
  play(key: TrackKey) {
    if (typeof window === 'undefined') return
    this.ensureUnlock()
    if (!this.unlocked) { this.pendingKey = key; return }
    if (this.currentKey === key && !this.active.paused) return
    this.currentKey = key
    this.crossfade(SRC[key], true, 1.6)
  }

  /** 播放一次性短曲（胜利/死亡），结束后进入 follow 曲目 */
  stinger(key: TrackKey, follow?: TrackKey) {
    if (typeof window === 'undefined') return
    this.ensureUnlock()
    if (!this.unlocked) { this.pendingKey = key; return }
    this.currentKey = key
    this.crossfade(SRC[key], false, 0.8, () => {
      if (follow) {
        this.currentKey = follow
        this.crossfade(SRC[follow], true, 2)
      }
    })
  }

  private crossfade(src: string, loop: boolean, fadeSec: number, onEnded?: () => void) {
    const from = this.active
    const to = from === this.a ? this.b : this.a
    this.active = to
    to.src = src
    to.loop = loop
    to.volume = 0
    if (onEnded) {
      to.onended = () => { to.onended = null; onEnded() }
    } else {
      to.onended = null
    }
    to.play().catch(() => { /* 静默 */ })
    // 目标音量驱动：from→0 后暂停，to→目标音量
    // （同一手势内连续切歌时，旧循环会按新目标继续，不会误停新曲目）
    this.fadeTargets = [
      { el: from, target: 0 },
      { el: to, target: this.effVol() },
    ]
    if (this.fadeTimer) return  // 循环已在跑，会按最新目标淡变
    const step = Math.max(0.02, 1 / Math.max(1, Math.round(fadeSec * 30)))
    this.fadeTimer = setInterval(() => {
      let done = true
      for (const t of this.fadeTargets) {
        const el = t.el
        const goal = t.target
        const cur = el.volume
        if (Math.abs(cur - goal) <= step) {
          el.volume = goal
          if (goal === 0 && el !== this.active && !el.paused) {
            try { el.pause(); el.currentTime = 0 } catch { /* ignore */ }
          }
        } else {
          el.volume = cur + Math.sign(goal - cur) * step
          done = false
        }
      }
      if (done) {
        if (this.fadeTimer) { clearInterval(this.fadeTimer); this.fadeTimer = null }
      }
    }, 1000 / 30)
  }

  setVolume(v: number) {
    this.volume = v
    localStorage.setItem(VOL_KEY, String(v))
    this.active.volume = this.effVol()
    // 正在淡入的曲目同步新目标
    for (const t of this.fadeTargets) {
      if (t.el === this.active) t.target = this.effVol()
    }
  }

  setMuted(m: boolean) {
    this.muted = m
    localStorage.setItem(MUTE_KEY, m ? '1' : '0')
    this.active.volume = this.effVol()
    for (const t of this.fadeTargets) {
      if (t.el === this.active) t.target = this.effVol()
    }
  }

  stop() {
    try { this.active.pause(); this.active.currentTime = 0 } catch { /* ignore */ }
    this.currentKey = null
  }
}

export const music = new MusicEngine()

// 调试/测试钩子
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__music = music
}

/** 场景 → 曲目映射 */
export function trackForScreen(screen: string, combat: { isBoss: boolean; isElite: boolean } | null): TrackKey {
  switch (screen) {
    case 'title': return 'menu'
    case 'map': case 'rest': case 'treasure': case 'reward': return 'level'
    case 'shop': return 'merchant'
    case 'event': return 'shrine'
    case 'bossRelic': return 'credits'
    case 'victory': return 'credits'
    case 'gameover': return 'death'
    case 'combat':
      if (combat?.isBoss) return 'boss'
      if (combat?.isElite) return 'elite'
      return 'level'
    default: return 'level'
  }
}
