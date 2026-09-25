'use client'
// ============ 舞台缩放系统 ============
// 所有游戏画面按 1600×900 逻辑分辨率绘制，再整体等比缩放适配任意屏幕
// 旋转按钮：点击后整个画面旋转 180 度（适配手机倒拿/充电口朝上等场景）
import { ReactNode, useCallback, useEffect, useState } from 'react'

export const STAGE_W = 1600
export const STAGE_H = 900

const FLIP_KEY = 'stsFlip180'

/** 读取持久化的 180 度翻转状态 */
function loadFlip(): boolean {
  try { return localStorage.getItem(FLIP_KEY) === '1' } catch { return false }
}
function saveFlip(v: boolean) {
  try { v ? localStorage.setItem(FLIP_KEY, '1') : localStorage.removeItem(FLIP_KEY) } catch { /* noop */ }
}

function useViewport() {
  const [size, setSize] = useState({ w: 1280, h: 720 })
  useEffect(() => {
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    // 移动端 Safari 工具栏伸缩时 visualViewport 更准
    if (window.visualViewport) window.visualViewport.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [])
  return size
}

// 尝试全屏 + 锁定横屏（仅全屏按钮使用）
async function tryOrient(lock: 'landscape' | 'portrait') {
  try {
    const d = document as unknown as { fullscreenElement?: Element; documentElement: HTMLElement & { requestFullscreen?: () => Promise<void> } }
    if (!d.fullscreenElement) await d.documentElement.requestFullscreen?.().catch(() => { })
    const so = (screen as unknown as { orientation?: { lock?: (o: string) => Promise<void> } }).orientation
    await so?.lock?.(lock)?.catch(() => { })
  } catch { /* iOS 不支持，静默 */ }
}

// ============ 全屏按钮 ============
function FullscreenBtn() {
  const [isFs, setIsFs] = useState(false)
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    setSupported(!!document.documentElement.requestFullscreen)
    const h = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])
  if (!supported) return null
  const toggle = async () => {
    try {
      if (!document.fullscreenElement) {
        await tryOrient('landscape')
      } else {
        await document.exitFullscreen()
      }
    } catch { /* 忽略 */ }
  }
  return (
    <button
      className="sts-btn"
      style={{ fontSize: 16, padding: '4px 10px', minWidth: 38 }}
      onClick={toggle}
      title={isFs ? '退出全屏' : '全屏'}
    >
      ⛶
    </button>
  )
}

// ============ 旋转 180 度按钮（点击翻转整个画面；仅触屏设备显示） ============
function RotateBtn({ flipped, onToggle }: { flipped: boolean; onToggle: () => void }) {
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    setIsTouch(typeof matchMedia !== 'undefined' && matchMedia('(hover: none)').matches)
  }, [])
  if (!isTouch) return null
  return (
    <button
      className="sts-btn"
      style={{
        fontSize: 15, padding: '4px 10px', minWidth: 38,
        transform: flipped ? 'rotate(180deg)' : undefined,   // 画面倒转后按钮图标转正，方便识别
      }}
      onClick={onToggle}
      title="旋转 180 度（手机倒拿时点此翻转画面）"
    >
      🔄
    </button>
  )
}

export function Stage({ children }: { children: ReactNode }) {
  const { w, h } = useViewport()
  const [mounted, setMounted] = useState(false)
  const [flipped, setFlipped] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => setFlipped(loadFlip()), [])

  const toggleFlip = useCallback(() => {
    setFlipped(f => {
      const next = !f
      saveFlip(next)
      return next
    })
  }, [])

  // 预加载关键背景图，避免首次切屏白闪
  useEffect(() => {
    for (const src of ['/assets/bg/combat.jpg', '/assets/bg/map.jpg', '/assets/bg/menu.jpg']) {
      const img = new Image()
      img.src = src
    }
  }, [])

  const scale = Math.min(w / STAGE_W, h / STAGE_H)

  const onStageClick = useCallback((e: React.MouseEvent) => {
    // 舞台空白区域点击不冒泡影响（保留给子组件处理）
    void e
  }, [])

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: '#050302', touchAction: 'manipulation' }}>
      {/* 游戏舞台：1600×900 逻辑分辨率，等比缩放居中；点击🔄可整屏旋转180度 */}
      <div
        data-stage
        className="absolute"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) scale(${mounted ? scale : 1})${flipped ? ' rotate(180deg)' : ''}`,
          transformOrigin: 'center center',
          background: '#0a0604',
          boxShadow: '0 0 80px rgba(0,0,0,0.9)',
        }}
        onClick={onStageClick}
      >
        {children}
        {/* 右上角控制簇：旋转180度 + 全屏 */}
        <div className="absolute flex gap-1.5 items-center" style={{ top: 10, right: 10, zIndex: 500 }}>
          <RotateBtn flipped={flipped} onToggle={toggleFlip} />
          <FullscreenBtn />
        </div>
      </div>
    </div>
  )
}
