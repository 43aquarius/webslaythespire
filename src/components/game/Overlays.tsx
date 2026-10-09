'use client'
// ============ 遮罩层：牌堆查看 / 卡牌选择 / 预见 / 检视屏 ============
import { sfx } from '@/game/sfx'
import { useEffect, useState } from 'react'
import { useGame } from '@/store/gameStore'
import { CardInstance } from '@/game/types'
import { AP } from '@/game/engine'
import { CardView } from './CardView'

// ============ 检视屏（原版 NInspectCardScreen） ============
// 点击牌堆网格中的卡牌 → 黑0.9背板 + 大卡 + 金色箭头导航（端点隐藏）+ 升级预览勾选框
// 开屏：卡 brightness0→1 淡入 0.25s + scale 0.875→1 BackOut 0.15s(延迟0.1s)；箭头 ±100px BackOut 0.25s(延迟0.1s)
// 切卡：下一张自 ±100px 滑入 0.25s ExpoOut；键盘 ←/→ 导航、Enter/Space 切升级预览、Esc 关闭
function InspectView({ cards, index, onIndex, onClose }: {
  cards: CardInstance[]; index: number; onIndex: (i: number) => void; onClose: () => void
}) {
  const card = cards[index]
  // 升级预览：默认勾选 = 卡牌已升级（原版 setCardIndex: ticked = IsUpgraded）
  const [ticked, setTicked] = useState(card.upgraded > 0)
  const [closing, setClosing] = useState(false)
  const [dir, setDir] = useState(0)
  const [gen, setGen] = useState(0)

  const upgradable = card.upgraded < 10 // 可升级（诅咒/状态卡也能看描述差异，保留勾选）
  const shown: CardInstance = ticked
    ? { ...card, upgraded: Math.max(1, card.upgraded + 1) }
    : card.upgraded > 0 ? { ...card, upgraded: card.upgraded - 1 } : card

  const step = (d: number) => {
    const i = index + d
    if (i < 0 || i >= cards.length) return // 端点隐藏箭头，不循环
    setDir(d); setGen(g => g + 1)
    setTicked(cards[i].upgraded > 0)
    onIndex(i)
  }
  const close = () => {
    if (closing) return
    setClosing(true)
    setTimeout(onClose, 240)
  }

  // 检视层开启期间打标记：page.tsx 的 Esc 处理据此让行（由本组件自行处理 Esc）
  useEffect(() => {
    document.body.dataset.stsInspect = '1'
    return () => { delete document.body.dataset.stsInspect }
  }, [])

  // 键盘导航
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (upgradable) setTicked(t => !t) }
      else if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [index, ticked, closing])

  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 320 }} onClick={e => e.stopPropagation()}>
      <div className={`sts-inspect-backdrop ${closing ? 'closing' : ''}`} onClick={close} />
      <div className="relative flex items-center justify-center" style={{ width: '100%' }}>
        {/* 大卡（切卡时自 ±100px 滑入 0.25s ExpoOut） */}
        <div
          key={`card-${gen}`}
          className={`${gen === 0 ? 'sts-inspect-card-in' : dir < 0 ? 'sts-inspect-nav-left' : 'sts-inspect-nav-right'}`}
        >
          <CardView card={shown} width={310} />
        </div>
        {/* 金色箭头（原版 NGoldArrowButton：hover 1.2亮度+1.1×，press 0.7） */}
        {index > 0 && (
          <div
            className={`sts-inspect-arrow sts-inspect-arrow-in-l absolute`}
            style={{ left: 'max(24px, calc(50% - 340px))' }}
            onClick={() => step(-1)}
            title="上一张 (←)"
          >
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <path d="M33 10 L17 26 L33 42" stroke="#e8b855" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M33 10 L17 26 L33 42" stroke="#8a6420" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.55" style={{ transform: 'scale(1.06)', transformOrigin: 'center' }} />
            </svg>
          </div>
        )}
        {index < cards.length - 1 && (
          <div
            className={`sts-inspect-arrow sts-inspect-arrow-in-r absolute`}
            style={{ right: 'max(24px, calc(50% - 340px))' }}
            onClick={() => step(1)}
            title="下一张 (→)"
          >
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <path d="M19 10 L35 26 L19 42" stroke="#e8b855" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M19 10 L35 26 L19 42" stroke="#8a6420" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.55" style={{ transform: 'scale(1.06)', transformOrigin: 'center' }} />
            </svg>
          </div>
        )}
        {/* 升级预览勾选框（原版 NTickbox + VIEW_UPGRADES） */}
        <div
          className="sts-inspect-tick absolute"
          style={{ bottom: -74 }}
          onClick={() => upgradable && setTicked(t => !t)}
        >
          <div className={`sts-tickbox ${ticked ? 'on' : ''}`}>
            {ticked && <span className="sts-tickbox-check">✓</span>}
          </div>
          <span className="sts-title" style={{ fontSize: 18, color: ticked ? '#ffd76a' : '#c8b090', textShadow: '2px 2px 0 #000', letterSpacing: 2 }}>
            查看升级
          </span>
        </div>
        {/* 计数 */}
        <div className="absolute sts-num" style={{ bottom: -74, right: 'max(24px, calc(50% - 340px))', fontSize: 20, color: '#a89070', textShadow: '1px 1px 0 #000' }}>
          {index + 1} / {cards.length}
        </div>
        {/* 关闭提示 */}
        <div className="absolute sts-body" style={{ bottom: -74, left: 'max(24px, calc(50% - 340px))', fontSize: 13, color: '#8a7458', textShadow: '1px 1px 0 #000' }}>
          ←/→ 切换 · 空格升级预览 · Esc 关闭
        </div>
      </div>
    </div>
  )
}

// ============ 牌堆查看 ============
export function PileViewOverlay() {
  const run = useGame(s => s.run)
  const pileView = useGame(s => s.pileView)
  const closePile = useGame(s => s.closePile)
  const [inspectIdx, setInspectIdx] = useState<number | null>(null)
  // deck 模式（查看牌组）在地图等非战斗场景也可用
  if (!run || !pileView) return null
  if (pileView !== 'deck' && !run.combat) return null
  const closeWithSfx = () => { sfx.play('deckClose'); closePile() }

  const titles: Record<string, string> = {
    draw: '抽牌堆（随机排序）',
    discard: '弃牌堆',
    exhaust: '消耗堆',
    deck: '牌组',
  }
  let cards: CardInstance[] = []
  if (pileView === 'draw') cards = [...(run.combat ? AP(run.combat).drawPile : [])].reverse()
  else if (pileView === 'discard') cards = [...(run.combat ? AP(run.combat).discardPile : [])].reverse()
  else if (pileView === 'exhaust') cards = [...(run.combat ? AP(run.combat).exhaustPile : [])].reverse()
  else cards = run.deck

  return (
    <div className="sts-overlay" onClick={closeWithSfx}>
      <div className="sts-panel p-6 flex flex-col items-center gap-4 relative" style={{ maxWidth: 1440, maxHeight: 800 }}
        onClick={e => e.stopPropagation()}>
        <div className="sts-title" style={{ fontSize: 26, color: '#ffd980' }}>
          {titles[pileView]} <span style={{ fontSize: 16, color: '#a89070' }}>({cards.length})</span>
        </div>
        <div className="flex flex-wrap gap-3 justify-center overflow-y-auto sts-scroll" style={{ maxHeight: 620, padding: 4 }}>
          {cards.length === 0 && (
            <div className="sts-body" style={{ color: '#a89070', fontSize: 15 }}>空空如也</div>
          )}
          {cards.map((c, i) => (
            <div
              key={c.uid}
              className="transition-transform hover:-translate-y-2"
              style={{ cursor: 'pointer' }}
              title="点击放大检视"
              onClick={() => setInspectIdx(i)}
            >
              <CardView card={c} width={130} />
            </div>
          ))}
        </div>
        <button className="sts-btn sts-slide-btn-r" onClick={closeWithSfx}>关闭</button>
      </div>
      {/* 检视屏（原版 NInspectCardScreen：黑0.9背板覆盖全屏） */}
      {inspectIdx !== null && (
        <InspectView
          cards={cards}
          index={Math.min(inspectIdx, cards.length - 1)}
          onIndex={setInspectIdx}
          onClose={() => setInspectIdx(null)}
        />
      )}
    </div>
  )
}

// ============ 卡牌选择（升级/移除/置顶等） ============
// 可选卡牌带原版涟漪描边高亮（NCardHighlight 的 CSS 近似：金色光带沿边框循环扫过）
// 武装等战斗内升级选择：点击先显示升级预览（原卡 → 金箭头 → 升级后卡），确认后才生效
export function CardSelectOverlay() {
  const run = useGame(s => s.run)
  const select = useGame(s => s.select)
  const resolveSelect = useGame(s => s.resolveSelect)
  const cancelSelect = useGame(s => s.cancelSelect)
  const [previewUid, setPreviewUid] = useState<string | null>(null)
  if (!run || !select) return null

  const findCard = (uid: string): CardInstance | undefined => {
    if (select.source === 'offer') return select.offerCards?.find(c => c.uid === uid)
    if (select.source === 'deck') return run.deck.find(c => c.uid === uid)
    if (select.source === 'hand') return AP(run.combat!).hand.find(c => c.uid === uid)
    if (select.source === 'discard') return AP(run.combat!).discardPile.find(c => c.uid === uid)
    return undefined
  }
  // 保持牌堆顺序展示（offer：直接展示提供的卡）
  const ordered: CardInstance[] =
    select.source === 'offer' ? (select.offerCards ?? [])
      : select.source === 'deck' ? run.deck
        : select.source === 'hand' ? (run.combat ? AP(run.combat).hand : [])
          : (run.combat ? AP(run.combat).discardPile : [])
  const cards = ordered.filter(c => select.cardUids.includes(c.uid))

  const cancellable = select.kind === 'eventUpgrade' || select.kind === 'eventRemove' ||
    select.kind === 'sacrifice' || select.kind === 'restSmith' || select.kind === 'shopRemove'

  // ===== 战斗内升级预览（原版 NUpgradePreview：选卡 → 三箭头 → 升级后副本 + 确认按钮） =====
  const isUpgradePreview = select.kind === 'armaments'
  const previewCard = previewUid ? (findCard(previewUid) || cards.find(c => c.uid === previewUid)) : null

  if (isUpgradePreview && previewCard) {
    return (
      <div className="sts-overlay">
        <div className="flex flex-col items-center gap-6" onClick={e => e.stopPropagation()}>
          <div className="sts-title" style={{ fontSize: 28, color: '#ffd980', textShadow: '2px 2px 0 #000' }}>
            升级预览
          </div>
          <div className="flex items-center justify-center gap-8">
            <div className="sts-up-preview-card transition-transform hover:scale-110" style={{ cursor: 'pointer' }}
              onClick={() => setPreviewUid(null)} title="点击返回选择">
              <CardView card={previewCard} width={170} />
            </div>
            <div className="flex flex-col items-center" style={{ gap: 2 }}>
              {[0, 1, 2].map(k => (
                <span key={k} className="sts-title" style={{ fontSize: 34, color: '#ffd34d', textShadow: '0 0 10px rgba(255,200,80,.8)', animation: `sts-arrow-nudge 1.2s ease-in-out ${k * 0.15}s infinite` }}>➤</span>
              ))}
            </div>
            <div className="sts-up-preview-card">
              <CardView card={{ ...previewCard, upgraded: Math.max(1, previewCard.upgraded) }} width={170} />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="sts-btn sts-title" style={{ fontSize: 20, padding: '8px 40px' }}
              onClick={() => resolveSelect(previewCard.uid)}>
              确认升级
            </button>
            <button className="sts-btn" onClick={() => setPreviewUid(null)}>重选</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sts-overlay">
      <div className="flex flex-col items-center gap-5" style={{ maxWidth: 1480, maxHeight: 840 }}
        onClick={e => e.stopPropagation()}>
        <div className="sts-title" style={{ fontSize: 28, color: '#ffd980', textShadow: '2px 2px 0 #000' }}>
          {select.title}
        </div>
        <div className="flex flex-wrap gap-3 justify-center overflow-y-auto sts-scroll" style={{ maxHeight: 640, padding: 8 }}>
          {cards.map((c, i) => (
            <div key={c.uid} className="sts-card-in sts-card-selectable transition-transform hover:-translate-y-2" style={{ animationDelay: `${Math.min(i, 8) * 0.05}s`, cursor: 'pointer' }}
              onClick={() => (isUpgradePreview ? setPreviewUid(c.uid) : resolveSelect(c.uid))}>
              <CardView card={c} width={138} hoverPlay={!isUpgradePreview} />
            </div>
          ))}
          {cards.length === 0 && (
            <div className="sts-body" style={{ color: '#a89070', fontSize: 16 }}>没有可选择的卡牌</div>
          )}
        </div>
        {cancellable && (
          <button className="sts-btn" onClick={cancelSelect}>
            {select.kind === 'shopRemove' ? '取消购买' : '放弃'}
          </button>
        )}
      </div>
    </div>
  )
}

// ============ 预见（观者：查看抽牌堆顶 N 张，标记弃置） ============
export function ScryOverlay() {
  const run = useGame(s => s.run)
  const resolveScry = useGame(s => s.resolveScry)
  const [marked, setMarked] = useState<Set<string>>(new Set())
  const pending = run?.combat ? AP(run.combat).pendingScry : null
  if (!run || !run.combat || !pending) return null

  // 抽牌堆末尾 N 张是即将抽到的牌
  const topCards = AP(run.combat!).drawPile.slice(-pending)

  const toggle = (uid: string) => {
    setMarked(prev => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 select-none"
      style={{ zIndex: 88, background: 'rgba(4,2,8,0.55)' }}>
      <div className="sts-title" style={{ fontSize: 30, color: '#c8b8f0', textShadow: '2px 2px 0 #000' }}>
        预见
      </div>
      <div className="sts-body" style={{ color: '#a898c0', fontSize: 15 }}>
        点击卡牌将其弃置（下回合不会抽到），最多弃 {pending} 张
      </div>
      <div className="flex flex-wrap gap-4 justify-center items-end" style={{ maxWidth: 1200 }}>
        {topCards.map((c: CardInstance, i: number) => {
          const isMarked = marked.has(c.uid)
          return (
            <div
              key={c.uid}
              className="sts-card-in transition-all"
              style={{
                animationDelay: `${Math.min(i, 8) * 0.06}s`,
                cursor: 'pointer',
                transform: isMarked ? 'translateY(-26px) scale(1.04)' : undefined,
                filter: isMarked ? 'drop-shadow(0 0 14px rgba(220,80,80,0.9))' : undefined,
              }}
              onClick={() => toggle(c.uid)}
            >
              <CardView card={c} width={150} hoverPlay={!isMarked} />
            </div>
          )
        })}
        {topCards.length === 0 && (
          <div className="sts-body" style={{ color: '#a89070', fontSize: 15 }}>抽牌堆已空</div>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="sts-body" style={{ color: '#c8a860', fontSize: 14 }}>
          已弃置 {marked.size} 张
        </div>
        <button
          className="sts-btn sts-title"
          style={{ fontSize: 20, padding: '8px 36px' }}
          onClick={() => resolveScry([...marked])}
        >
          确认
        </button>
      </div>
    </div>
  )
}

// ============ Toast ============
export function ToastView() {
  const toast = useGame(s => s.toast)
  if (!toast) return null
  return (
    <div className="sts-toast">
      <div className="sts-panel px-6 py-3 sts-body" style={{ fontSize: 16, color: '#ffe9c0' }}>
        {toast}
      </div>
    </div>
  )
}

// ============ 锻造升级卡牌特效（原版 NCardUpgradeVfx） ============
// 卡牌以 scale 0→1（0.25s CubicOut）+ 星光出现在屏幕中央，停留 1.75s 后飞向牌组按钮（缩小+旋转+淡出）
export function UpgradeVfxOverlay() {
  const upgradeFx = useGame(s => s.upgradeFx)
  const clearUpgradeFx = useGame(s => s.clearUpgradeFx)
  const [shown, setShown] = useState<{ uid: string; id: string; ts: number } | null>(null)
  const [flying, setFlying] = useState(false)

  useEffect(() => {
    if (!upgradeFx) return
    setShown(upgradeFx)
    setFlying(false)
    const t1 = setTimeout(() => setFlying(true), 2000)
    const t2 = setTimeout(() => { setShown(null); clearUpgradeFx() }, 2900)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [upgradeFx?.ts])

  if (!shown) return null
  return (
    <div key={shown.ts} className="upgrade-vfx-overlay absolute inset-0 pointer-events-none" style={{ zIndex: 340 }}>
      <div
        className="up-card absolute"
        style={{
          left: '50%', top: '44%',
          animation: flying
            ? 'sts-upgrade-fly .9s cubic-bezier(.5,0,.8,.4) forwards'
            : 'sts-upgrade-in .25s cubic-bezier(.2,.9,.3,1) both',
          filter: 'drop-shadow(0 0 30px rgba(255, 210, 90, 0.55))',
        }}
      >
        <div className="relative">
          <CardView card={{ uid: shown.uid, id: shown.id, upgraded: 1 }} width={230} />
          {!flying && <div className="sts-upgrade-star" style={{ width: 320, height: 320 }} />}
        </div>
      </div>
    </div>
  )
}
