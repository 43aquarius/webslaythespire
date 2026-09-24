'use client'
// ============ 遮罩层：牌堆查看 / 卡牌选择 ============
import { useGame } from '@/store/gameStore'
import { CardInstance } from '@/game/types'
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
  if (pileView === 'draw') cards = [...(run.combat?.drawPile ?? [])].reverse()
  else if (pileView === 'discard') cards = [...(run.combat?.discardPile ?? [])].reverse()
  else if (pileView === 'exhaust') cards = [...(run.combat?.exhaustPile ?? [])].reverse()
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
    if (select.source === 'deck') return run.deck.find(c => c.uid === uid)
    if (select.source === 'hand') return run.combat?.hand.find(c => c.uid === uid)
    if (select.source === 'discard') return run.combat?.discardPile.find(c => c.uid === uid)
    return undefined
  }
  // 保持牌堆顺序展示
  const ordered: CardInstance[] =
    select.source === 'deck' ? run.deck
      : select.source === 'hand' ? (run.combat?.hand ?? [])
        : (run.combat?.discardPile ?? [])
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
