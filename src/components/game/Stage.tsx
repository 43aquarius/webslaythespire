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

// ============ 竖屏提示（含逃生按钮：永不卡死） ============
function RotatePrompt({ onContinue, onTryLandscape }: { onContinue: () => void; onTryLandscape: () => void }) {
  const [showHowTo, setShowHowTo] = useState(false)
  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-5 select-none px-6"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #241408 0%, #0a0604 70%)' }}>
      <div className="sts-rotate-phone" />
      <div className="sts-title" style={{ fontSize: 30, color: '#ffd980', textShadow: '2px 2px 0 #000' }}>
        请横屏游玩
      </div>
      <div className="sts-body text-center" style={{ color: '#a89070', fontSize: 15, lineHeight: 1.8 }}>
        杀戮尖塔为横屏游戏<br />旋转设备以获得最佳体验
      </div>
      {/* 自动旋转尝试：全屏并锁定横屏（Android 有效，iOS 静默失败） */}
      <button
        className="sts-btn sts-title"
        style={{ fontSize: 18, padding: '9px 30px' }}
        onClick={onTryLandscape}
      >
        ⛶ 自动切换横屏
      </button>
      {/* 逃生按钮：即使无法横屏也能继续游戏（竖屏兼容模式，画面缩小居中） */}
      <button
        className="sts-btn"
        style={{ fontSize: 15, padding: '7px 22px', opacity: 0.85 }}
        onClick={onContinue}
      >
        竖屏继续游玩 →
      </button>
      {showHowTo ? (
        <div className="sts-body" style={{ color: '#8a7860', fontSize: 12, lineHeight: 1.7, textAlign: 'center', maxWidth: 340 }}>
          若已横屏仍见此提示：<br />1. 关闭手机系统「竖排方向锁定/自动旋转关闭」<br />2. 或点击上方「竖屏继续游玩」<br />3. 部分浏览器需从手机顶部菜单允许旋转
        </div>
      ) : (
        <button className="sts-body" style={{ color: '#6a5a48', fontSize: 12, textDecoration: 'underline', background: 'none', border: 'none' }} onClick={() => setShowHowTo(true)}>
          为什么一直显示这个？
        </button>
      )}
    </div>
  )
}

// 方向检测：双信号判断（尺寸 + matchMedia），规避 orientationchange 瞬间误判
function useIsPortrait() {
  const [isPortrait, setIsPortrait] = useState(false)
  useEffect(() => {
    const detect = () => {
      // 双信号：任一判定竖屏且宽度过小才提示（平板竖屏不提示）
      const bySize = window.innerHeight > window.innerWidth
      const byMq = window.matchMedia('(orientation: portrait)').matches
      const small = Math.min(window.innerWidth, window.innerHeight) < 760
      setIsPortrait(small && (bySize || byMq))
    }
    detect()
    // orientationchange 后 innerWidth/Height 在部分安卓浏览器延迟更新 → 多次重测
    let t1: ReturnType<typeof setTimeout>, t2: ReturnType<typeof setTimeout>, t3: ReturnType<typeof setTimeout>
    const onOrient = () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3)
      t1 = setTimeout(detect, 100)
      t2 = setTimeout(detect, 350)
      t3 = setTimeout(detect, 800)
    }
    window.addEventListener('resize', detect)
    window.addEventListener('orientationchange', onOrient)
    const mq = window.matchMedia('(orientation: portrait)')
    mq.addEventListener?.('change', onOrient)
    if (window.visualViewport) window.visualViewport.addEventListener('resize', detect)
    return () => {
      window.removeEventListener('resize', detect)
      window.removeEventListener('orientationchange', onOrient)
      mq.removeEventListener?.('change', onOrient)
      window.visualViewport?.removeEventListener('resize', detect)
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3)
    }
  }, [])
  return isPortrait
}

export function Stage({ children }: { children: ReactNode }) {
  const { w, h } = useViewport()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isPortrait = useIsPortrait()
  // 用户选择「竖屏继续」后本次会话不再拦截（localStorage 记住，横竖屏切换仍正常缩放）
  const [forceContinue, setForceContinue] = useState(false)
  useEffect(() => {
    try { setForceContinue(sessionStorage.getItem('sts-portrait-continue') === '1') } catch { }
  }, [])

  const onContinue = useCallback(() => {
    setForceContinue(true)
    try { sessionStorage.setItem('sts-portrait-continue', '1') } catch { }
  }, [])
  const onTryLandscape = useCallback(async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen().catch(() => { })
      const so = (screen as unknown as { orientation?: { lock?: (o: string) => Promise<void> } }).orientation
      await so?.lock?.('landscape')?.catch(() => { })
    } catch { /* iOS 不支持，静默 */ }
  }, [])

  // 预加载关键背景图，避免首次切屏白闪
  useEffect(() => {
    for (const src of ['/assets/bg/combat.jpg', '/assets/bg/map.jpg']) {
      const img = new Image()
      img.src = src
    }
  }, [])

  const scale = Math.min(w / STAGE_W, h / STAGE_H)
  // 竖屏 + 小屏（手机）且用户未选择继续 → 提示横屏（有逃生按钮，永不卡死）
  const needRotate = isPortrait && !forceContinue

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
      {needRotate && <RotatePrompt onContinue={onContinue} onTryLandscape={onTryLandscape} />}
    </div>
  )
}
