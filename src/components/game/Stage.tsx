'use client'
// ============ 舞台缩放系统 ============
// 所有游戏画面按 1600×900 逻辑分辨率绘制，再整体等比缩放适配任意屏幕
// 解决手机端比例问题；竖屏时提示横屏；提供全屏按钮
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
        await document.documentElement.requestFullscreen()
        // Android 全屏时可尝试锁定横屏（iOS 不支持，静默失败）
        const so = (screen as unknown as { orientation?: { lock?: (o: string) => Promise<void> } }).orientation
        so?.lock?.('landscape')?.catch(() => { })
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
      {isFs ? '⛶' : '⛶'}
    </button>
  )
}

// ============ 竖屏提示 ============
function RotatePrompt() {
  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-6 select-none"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #241408 0%, #0a0604 70%)' }}>
      <div className="sts-rotate-phone" />
      <div className="sts-title" style={{ fontSize: 30, color: '#ffd980', textShadow: '2px 2px 0 #000' }}>
        请横屏游玩
      </div>
      <div className="sts-body text-center" style={{ color: '#a89070', fontSize: 15, lineHeight: 1.8 }}>
        杀戮尖塔为横屏游戏<br />旋转设备以获得最佳体验
      </div>
    </div>
  )
}

export function Stage({ children }: { children: ReactNode }) {
  const { w, h } = useViewport()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // 预加载关键背景图，避免首次切屏白闪
  useEffect(() => {
    for (const src of ['/assets/bg/combat.jpg', '/assets/bg/map.jpg']) {
      const img = new Image()
      img.src = src
    }
  }, [])

  const scale = Math.min(w / STAGE_W, h / STAGE_H)
  // 竖屏 + 小屏（手机）→ 提示横屏
  const needRotate = h > w && Math.min(w, h) < 760

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
        {/* 右上角控制簇：音乐 + 全屏 */}
        <div className="absolute flex gap-1.5 items-center" style={{ top: 10, right: 10, zIndex: 500 }}>
          <FullscreenBtn />
        </div>
      </div>
      {needRotate && <RotatePrompt />}
    </div>
  )
}
