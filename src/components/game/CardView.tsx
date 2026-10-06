'use client'
// ============ 卡牌渲染组件（还原原版样式，四色角色卡面） ============
// 错位修复架构：所有 512 画布图层（背景/艺术图/边框/横幅/费用宝珠）渲染在
// 同一个「画布盒」内，全部 inset:0 完全同矩形 —— 浏览器只需对唯一盒子做
// 像素取整，任何缩放/旋转/合成下边框与内容永不错位（旧实现为每图独立
// 分数像素盒，合成时各自取整导致偶发 1-2px 偏移）。
// 文字层同样换算为 512 画布百分比，与图层共用同一坐标系。
import { memo } from 'react'
import { CardInstance } from '@/game/types'
import { CARDS, cardCost, cardDesc, cardColor } from '@/game/cards'

const A = '/assets'

// ---- 卡体区域（512 画布内 x:106-405, y:47-466，即 299×419）----
const CB = { x: 106, y: 47, w: 299, h: 419, size: 512, rightPad: 512 - 405, bottomPad: 512 - 466 }
// 卡体百分比 → 512 画布百分比
const px = (p: number) => `${((CB.x + p * CB.w) / CB.size) * 100}%`          // left
const py = (p: number) => `${((CB.y + p * CB.h) / CB.size) * 100}%`          // top
const pr = (p: number) => `${((CB.rightPad + p * CB.w) / CB.size) * 100}%`   // right 偏移
const pb = (p: number) => `${((CB.bottomPad + p * CB.h) / CB.size) * 100}%`  // bottom 偏移
const pw = (p: number) => `${(p * CB.w / CB.size) * 100}%`                   // width
const ph = (p: number) => `${(p * CB.h / CB.size) * 100}%`                   // height

// 稀有度 → 素材后缀
function raritySuffix(rarity: string): string {
  if (rarity === 'rare') return 'Rare'
  if (rarity === 'uncommon') return 'Uncommon'
  if (rarity === 'starter' || rarity === 'special') return 'Common'
  return 'Common'
}

// 卡面背景/费用宝珠/类型图标按角色色区分
const TYPE_BG: Record<string, Record<string, string>> = {
  red: {
    attack: `${A}/frames/bgAttackRed.png`,
    skill: `${A}/frames/bgSkillRed.png`,
    power: `${A}/frames/bgPowerRed.png`,
  },
  green: {
    attack: `${A}/frames/bgAttackGreen.png`,
    skill: `${A}/frames/bgSkillGreen.png`,
    power: `${A}/frames/bgPowerGreen.png`,
  },
  blue: {
    attack: `${A}/frames/bgAttackBlue.png`,
    skill: `${A}/frames/bgSkillBlue.png`,
    power: `${A}/frames/bgPowerBlue.png`,
  },
  purple: {
    attack: `${A}/frames/bgAttackPurple.png`,
    skill: `${A}/frames/bgSkillPurple.png`,
    power: `${A}/frames/bgPowerPurple.png`,
  },
  colorless: {
    attack: `${A}/frames/bgAttackRed.png`,
    skill: `${A}/frames/bgSkillRed.png`,
    power: `${A}/frames/bgPowerRed.png`,
  },
}

const COLOR_ORB: Record<string, string> = {
  red: 'cardRedOrb', green: 'cardGreenOrb', blue: 'cardBlueOrb', purple: 'cardPurpleOrb', colorless: 'cardRedOrb',
}

const COLOR_TYPEICON: Record<string, string> = {
  red: 'ironclad', green: 'silent', blue: 'defect', purple: 'watcher', colorless: 'ironclad',
}

// 类型小图标路径（原版：能力牌无普通稀有度，common 回退 uncommon）
function typeIconUrl(color: string, type: string, rarity: string): string {
  const base = COLOR_TYPEICON[color] || 'ironclad'
  let rar = raritySuffix(rarity)
  if (type === 'power' && rar === 'Common') rar = 'Uncommon'
  if (base === 'ironclad') return `${A}/typeicons/${type}${rar}.png`
  return `${A}/typeicons/${base}${type}${rar.toLowerCase()}.png`
}

export interface CardViewProps {
  card: CardInstance
  width?: number
  onClick?: () => void
  selected?: boolean
  dimmed?: boolean
  className?: string
  hoverPlay?: boolean   // 手牌中可打出的悬浮高亮
  ctx?: { strikesInDeck?: number; hpLost?: number; rampageBonus?: number; glassKnifePenalty?: number; clawBonus?: number; shivBonus?: number }
}

function CardViewInner({ card, width = 150, onClick, selected, dimmed, className = '', hoverPlay, ctx }: CardViewProps) {
  const def = CARDS[card.id]
  if (!def) return null
  // 整数化外框尺寸，减少分数像素
  const W = Math.round(width)
  const H = Math.round(width * 1.4003)  // 419/299
  // 唯一的 512 画布盒（正方形），所有图层在其中 inset:0
  const CW = (W * CB.size) / CB.w
  const CH = (H * CB.size) / CB.h
  const CX = (-W * CB.x) / CB.w
  const CY = (-H * CB.y) / CB.h

  const color = cardColor(card.id)
  const rar = raritySuffix(def.rarity)
  const frame = `${A}/frames/frame${def.type[0].toUpperCase()}${def.type.slice(1)}${rar}.png`
  const banner = `${A}/frames/banner${rar}.png`
  const typeIcon = typeIconUrl(color, def.type, def.rarity)
  const cost = cardCost(card, ctx?.hpLost ?? 0)
  const desc = cardDesc(card, ctx)
  const upgraded = card.upgraded > 0
  const bg = (TYPE_BG[color] || TYPE_BG.red)[def.type]
  const orbImg = COLOR_ORB[color] || 'cardRedOrb'

  return (
    <div
      className={`sts-card ${className} ${selected ? 'sts-upgraded-glow' : ''} ${dimmed ? 'opacity-50' : ''} ${hoverPlay ? 'sts-upgraded-glow' : ''}`}
      style={{ width: W, height: H }}
      onClick={onClick}
    >
      {/* ===== 唯一 512 画布盒：所有图层完全同矩形 ===== */}
      <div className="sts-canvas-box" style={{ width: CW, height: CH, left: CX, top: CY }}>
        {/* 卡面背景（按角色色） */}
        <img src={bg} alt="" className="sts-canvas-layer" draggable={false} />
        {/* 艺术图：已烘焙为 512 画布图（窗口 x:131 y:99 250×190，原版肖像位），
            与背景/边框/横幅/宝珠用完全相同的 inset:0 同盒渲染 —— 错位数学上不可能 */}
        <img
          src={`${A}/cardart/${card.id}.webp`}
          alt={def.name}
          className="sts-canvas-layer"
          draggable={false}
        />
        {/* 边框 / 名称横幅（与背景完全同盒） */}
        <img src={frame} alt="" className="sts-canvas-layer" draggable={false} />
        <img src={banner} alt="" className="sts-canvas-layer" draggable={false} />
        {/* 费用宝珠（按角色色） */}
        {cost !== -99 && (
          <img src={`${A}/frames/${orbImg}.png`} alt="" className="sts-canvas-layer" draggable={false} />
        )}

        {/* 名称（画布百分比） */}
        <div
          className="sts-title absolute text-center flex items-center justify-center"
          style={{
            left: px(0.10), width: pw(0.80), top: py(0.035), height: ph(0.135),
            fontSize: width * 0.088,
            color: rar === 'Rare' ? '#ffd98a' : '#ffe9c4',
            textShadow: '1px 1px 0 #000, 0 0 6px #000',
            lineHeight: 1.05, overflow: 'hidden',
          }}
        >
          {def.name}
        </div>
        {/* 费用数字 */}
        {cost !== -99 && (
          <div
            className="sts-title absolute flex items-center justify-center"
            style={{
              left: px(-0.01), top: py(-0.015), width: pw(0.19), height: ph(0.135),
              fontSize: width * 0.115, color: '#fff',
              textShadow: '1px 1px 0 #000, 0 0 8px #a02010',
            }}
          >
            {cost === -1 ? 'X' : cost}
          </div>
        )}
        {/* 描述 */}
        <div
          className="sts-body absolute text-center"
          style={{
            left: px(0.08), width: pw(0.84), top: py(0.495), height: ph(0.375),
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
        {/* 底部类型行：类型小图标 + 类型名（对齐原版） */}
        <div
          className="absolute flex items-center justify-center gap-1"
          style={{ left: px(0.18), width: pw(0.64), bottom: pb(0.025), height: ph(0.085) }}
        >
          <img
            src={typeIcon}
            alt=""
            draggable={false}
            style={{ height: '62%', width: 'auto', objectFit: 'contain' }}
          />
          <span
            className="sts-title"
            style={{
              fontSize: width * 0.062,
              color: '#ffe9c4',
              textShadow: '1px 1px 0 #000',
              letterSpacing: 1,
            }}
          >
            {def.type === 'attack' ? '攻击' : def.type === 'skill' ? '技能' : '能力'}
          </span>
        </div>
        {/* 升级标识 */}
        {upgraded && (
          <div
            className="sts-title absolute"
            style={{
              right: pr(0.02), top: py(0.01), fontSize: width * 0.09,
              color: '#7fe08a', textShadow: '1px 1px 0 #000',
            }}
          >
            ✦
          </div>
        )}
      </div>
    </div>
  )
}

export const CardView = memo(CardViewInner)
