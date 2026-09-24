'use client'
// ============ 卡牌渲染组件（还原原版样式） ============
import { memo } from 'react'
import { CardInstance } from '@/game/types'
import { CARDS, cardCost, cardDesc } from '@/game/cards'

const A = '/assets'

// 稀有度 → 素材后缀
function raritySuffix(rarity: string): string {
  if (rarity === 'rare') return 'Rare'
  if (rarity === 'uncommon') return 'Uncommon'
  if (rarity === 'starter' || rarity === 'special') return 'Common'
  return 'Common'
}

const TYPE_BG: Record<string, string> = {
  attack: `${A}/frames/bgAttackRed.png`,
  skill: `${A}/frames/bgSkillRed.png`,
  power: `${A}/frames/bgPowerRed.png`,
}

export interface CardViewProps {
  card: CardInstance
  width?: number
  onClick?: () => void
  selected?: boolean
  dimmed?: boolean
  className?: string
  hoverPlay?: boolean   // 手牌中可打出的悬浮高亮
  ctx?: { strikesInDeck?: number; hpLost?: number; rampageBonus?: number }
}

function CardViewInner({ card, width = 150, onClick, selected, dimmed, className = '', hoverPlay, ctx }: CardViewProps) {
  const def = CARDS[card.id]
  if (!def) return null
  const H = width * 1.4003  // 419/299
  const rar = raritySuffix(def.rarity)
  const frame = `${A}/frames/frame${def.type[0].toUpperCase()}${def.type.slice(1)}${rar}.png`
  const banner = `${A}/frames/banner${rar}.png`
  const cost = cardCost(card, ctx?.hpLost ?? 0)
  const desc = cardDesc(card, ctx)
  const upgraded = card.upgraded > 0

  return (
    <div
      className={`sts-card ${className} ${selected ? 'sts-upgraded-glow' : ''} ${dimmed ? 'opacity-50' : ''} ${hoverPlay ? 'sts-upgraded-glow' : ''}`}
      style={{ width, height: H }}
      onClick={onClick}
    >
      {/* 卡面背景 */}
      <img src={TYPE_BG[def.type]} alt="" className="sts-canvas512" draggable={false} />
      {/* 艺术图 */}
      <img
        src={`${A}/cardart/${card.id}.png`}
        alt={def.name}
        draggable={false}
        style={{
          position: 'absolute', objectFit: 'cover',
          left: '4%', top: '11.5%', width: '87.6%', height: '49%',
          borderRadius: 3,
        }}
      />
      {/* 边框 */}
      <img src={frame} alt="" className="sts-canvas512" draggable={false} />
      {/* 名称横幅 */}
      <img src={banner} alt="" className="sts-canvas512" draggable={false} />
      {/* 名称 */}
      <div
        className="sts-title absolute text-center flex items-center justify-center"
        style={{
          left: '10%', right: '10%', top: '3.5%', height: '13.5%',
          fontSize: width * 0.088,
          color: rar === 'Rare' ? '#ffd98a' : '#ffe9c4',
          textShadow: '1px 1px 0 #000, 0 0 6px #000',
          lineHeight: 1.05, overflow: 'hidden',
        }}
      >
        {def.name}
      </div>
      {/* 费用宝珠 */}
      {cost !== -99 && (
        <>
          <img src={`${A}/frames/cardRedOrb.png`} alt="" className="sts-canvas512" draggable={false}
            style={{ transform: 'scale(0.98)' }} />
          <div
            className="sts-title absolute flex items-center justify-center"
            style={{
              left: '-1%', top: '-1.5%', width: '19%', height: '13.5%',
              fontSize: width * 0.115, color: '#fff',
              textShadow: '1px 1px 0 #000, 0 0 8px #a02010',
            }}
          >
            {cost === -1 ? 'X' : cost}
          </div>
        </>
      )}
      {/* 描述 */}
      <div
        className="sts-body absolute text-center"
        style={{
          left: '8%', right: '8%', top: '49.5%', bottom: '6%',
          fontSize: width * 0.076,
          lineHeight: 1.28,
          color: '#f2e6d0',
          textShadow: '1px 1px 1px #000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: '100%' }}>
          {upgraded && <span style={{ color: '#7fe08a' }}>+ </span>}
          {desc}
        </div>
      </div>
      {/* 升级标识 */}
      {upgraded && (
        <div
          className="sts-title absolute"
          style={{
            right: '2%', top: '1%', fontSize: width * 0.09,
            color: '#7fe08a', textShadow: '1px 1px 0 #000',
          }}
        >
          ✦
        </div>
      )}
    </div>
  )
}

export const CardView = memo(CardViewInner)
