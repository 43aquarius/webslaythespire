'use client'
// ============ 舞台缩放系统 ============
// 所有游戏画面按 1600×900 逻辑分辨率绘制，再整体等比缩放适配任意屏幕
// 不再拦截竖屏（无"请横屏游玩"提示），提供横竖屏切换按钮
import { ReactNode, useCallback, useEffect, useState } from 'react'

export const STAGE_W = 1600
export const STAGE_H = 900

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

// 尝试切换到指定方向（全屏 + orientation.lock；iOS 不支持时静默失败）
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

// ============ 横竖屏切换按钮（替代旧的竖屏拦截提示） ============
function RotateBtn() {
  // 仅触屏设备显示（桌面无法旋转屏幕）
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    setIsTouch(typeof matchMedia !== 'undefined' && matchMedia('(hover: none)').matches)
  }, [])
  if (!isTouch) return null
  const toggle = () => {
    const portrait = window.innerHeight > window.innerWidth
    tryOrient(portrait ? 'landscape' : 'portrait')
  }
  return (
    <button
      className="sts-btn"
      style={{ fontSize: 15, padding: '4px 10px', minWidth: 38 }}
      onClick={toggle}
      title="切换横竖屏（自动进入全屏）"
    >
      🔄
    </button>
  )
}

export function Stage({ children }: { children: ReactNode }) {
  const { w, h } = useViewport()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

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
      {/* 游戏舞台：1600×900 逻辑分辨率，等比缩放居中 */}
      <div
        className="absolute"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) scale(${mounted ? scale : 1})`,
          transformOrigin: 'center center',
          background: '#0a0604',
          boxShadow: '0 0 80px rgba(0,0,0,0.9)',
        }}
        onClick={onStageClick}
      >
        {children}
        {/* 右上角控制簇：横竖屏切换 + 全屏 */}
        <div className="absolute flex gap-1.5 items-center" style={{ top: 10, right: 10, zIndex: 500 }}>
          <RotateBtn />
          <FullscreenBtn />
        </div>
      </div>
    </div>
  )
}
