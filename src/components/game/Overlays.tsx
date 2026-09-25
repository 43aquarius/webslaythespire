'use client'
// ============ 遮罩层：牌堆查看 / 卡牌选择 / 预见 ============
import { useState } from 'react'
import { useGame } from '@/store/gameStore'
import { CardInstance } from '@/game/types'
import { AP } from '@/game/engine'
import { CardView } from './CardView'

// ============ 牌堆查看 ============
export function PileViewOverlay() {
  const run = useGame(s => s.run)
  const pileView = useGame(s => s.pileView)
  const closePile = useGame(s => s.closePile)
  // deck 模式（查看牌组）在地图等非战斗场景也可用
  if (!run || !pileView) return null
  if (pileView !== 'deck' && !run.combat) return null

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
    <div className="sts-overlay" onClick={closePile}>
      <div className="sts-panel p-6 flex flex-col items-center gap-4" style={{ maxWidth: 1440, maxHeight: 800 }}
        onClick={e => e.stopPropagation()}>
        <div className="sts-title" style={{ fontSize: 26, color: '#ffd980' }}>
          {titles[pileView]} <span style={{ fontSize: 16, color: '#a89070' }}>({cards.length})</span>
        </div>
        <div className="flex flex-wrap gap-3 justify-center overflow-y-auto sts-scroll" style={{ maxHeight: 620, padding: 4 }}>
          {cards.length === 0 && (
            <div className="sts-body" style={{ color: '#a89070', fontSize: 15 }}>空空如也</div>
          )}
          {cards.map(c => (
            <CardView key={c.uid} card={c} width={130} />
          ))}
        </div>
        <button className="sts-btn" onClick={closePile}>关闭</button>
      </div>
    </div>
  )
}

// ============ 卡牌选择（升级/移除/置顶等） ============
export function CardSelectOverlay() {
  const run = useGame(s => s.run)
  const select = useGame(s => s.select)
  const resolveSelect = useGame(s => s.resolveSelect)
  const cancelSelect = useGame(s => s.cancelSelect)
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

  return (
    <div className="sts-overlay">
      <div className="flex flex-col items-center gap-5" style={{ maxWidth: 1480, maxHeight: 840 }}
        onClick={e => e.stopPropagation()}>
        <div className="sts-title" style={{ fontSize: 28, color: '#ffd980', textShadow: '2px 2px 0 #000' }}>
          {select.title}
        </div>
        <div className="flex flex-wrap gap-3 justify-center overflow-y-auto sts-scroll" style={{ maxHeight: 640, padding: 8 }}>
          {cards.map((c, i) => (
            <div key={c.uid} className="sts-card-in transition-transform hover:-translate-y-2" style={{ animationDelay: `${Math.min(i, 8) * 0.05}s`, cursor: 'pointer' }}
              onClick={() => resolveSelect(c.uid)}>
              <CardView card={c} width={138} hoverPlay />
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
