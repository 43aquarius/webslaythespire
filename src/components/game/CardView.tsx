'use client'
// ============ 卡牌渲染组件（还原原版样式，四色角色卡面） ============
// 错位修复架构：所有 512 画布图层（背景/艺术图/边框/横幅/费用宝珠）渲染在
// 同一个「画布盒」内，全部 inset:0 完全同矩形 —— 浏览器只需对唯一盒子做
// 像素取整，任何缩放/旋转/合成下边框与内容永不错位（旧实现为每图独立
// 分数像素盒，合成时各自取整导致偶发 1-2px 偏移）。
// 文字层同样换算为 512 画布百分比，与图层共用同一坐标系。
import { memo } from 'react'
import { CardInstance } from '@/game/types'
import { CARDS, cardCost, cardDesc, cardDescParts, cardValues, cardColor } from '@/game/cards'

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

// 原版类型文案（ZHS ui.json SingleCardViewPopup.TEXT[0..2]）
const TYPE_NAME: Record<string, string> = { attack: '攻击', skill: '技能', power: '能力' }

export interface CardViewProps {
  card: CardInstance
  width?: number
  onClick?: () => void
  selected?: boolean
  dimmed?: boolean
  className?: string
  hoverPlay?: boolean   // 手牌中可打出的悬浮高亮
  unaffordable?: boolean // 手牌中能量不够（原版费用数字变红 #FF5555）
  combatCtx?: { strength?: number; weak?: boolean }  // 手牌战斗上下文：攻击牌伤害随力量/虚弱实时变色
  ctx?: { strikesInDeck?: number; hpLost?: number; rampageBonus?: number; glassKnifePenalty?: number; clawBonus?: number; shivBonus?: number }
}

function CardViewInner({ card, width = 150, onClick, selected, dimmed, className = '', hoverPlay, unaffordable, combatCtx, ctx }: CardViewProps) {
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
  const cost = cardCost(card, ctx?.hpLost ?? 0)
  const upgraded = card.upgraded > 0
  const bg = (TYPE_BG[color] || TYPE_BG.red)[def.type]
  const orbImg = COLOR_ORB[color] || 'cardRedOrb'
  const typeName = TYPE_NAME[def.type] || def.type

  // ===== 费用配色（原版 GetCostTextColorInHand）=====
  // 付不起 → 红 #FF5555（描边 #501717）；本回合免费/减费 → 绿 #7FFF00（描边 #1F5923）
  const baseCost = (upgraded && def.upCost !== undefined) ? def.upCost : def.cost
  const costReduced = cost >= 0 && baseCost >= 0 && cost < baseCost
  const costFree = card.freeThisTurn || costReduced
  const costColor = unaffordable ? '#ff5555' : costFree ? '#7fff00' : '#fff'
  const costShadow = unaffordable ? '1px 1px 0 #501717, 0 0 8px #2a0808' : costFree ? '1px 1px 0 #1f5923, 0 0 8px #0d2a10' : '1px 1px 0 #000, 0 0 8px #a02010'

  // ===== 描述分段（攻击牌伤害随力量/虚弱实时变色：升绿降红，原版动态数值）=====
  const isAttack = def.type === 'attack'
  const strMult = card.id === 'heavyBlade' ? (cardValues(card, ctx)[1] ?? 2) : 1
  const descSegs = (isAttack && combatCtx)
    ? cardDescParts(card, ctx, (idx, base) => {
        if (idx !== 0) return null
        let eff = base + Math.floor((combatCtx.strength || 0) * strMult)
        if (combatCtx.weak) eff = Math.floor(eff * 0.75)
        eff = Math.max(0, eff)
        if (eff === base) return null
        return { v: eff, color: eff > base ? '#7fff00' : '#ff5555' }
      })
    : null
  const desc = cardDesc(card, ctx)

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

        {/* 名称（升级后名字变绿 —— 原版行为；描边深绿 #1B6131） */}
        <div
          className="card-name sts-title absolute text-center flex items-center justify-center"
          style={{
            left: px(0.10), width: pw(0.80), top: py(0.035), height: ph(0.135),
            fontSize: width * 0.088,
            color: upgraded ? '#7fff00' : rar === 'Rare' ? '#ffd98a' : '#ffe9c4',
            textShadow: upgraded
              ? '1px 1px 0 #1b6131, 0 0 6px rgba(10,50,20,0.9)'
              : '1px 1px 0 #000, 0 0 6px #000',
            lineHeight: 1.05, overflow: 'hidden',
          }}
        >
          {def.name}
        </div>
        {/* 费用数字（付不起红 / 免费减费绿 —— 原版 GetCostTextColorInHand） */}
        {cost !== -99 && (
          <div
            className="card-cost sts-title absolute flex items-center justify-center"
            style={{
              left: px(-0.01), top: py(-0.015), width: pw(0.19), height: ph(0.135),
              fontSize: width * 0.115, color: costColor,
              textShadow: costShadow,
            }}
          >
            {cost === -1 ? 'X' : cost}
          </div>
        )}
        {/* 类型行（原版 renderType：纯文字，插在插画窗底缘与描述文字之间；
            卡中心下方 22px → 55.5% from top；灰 #595959；ZHS 无动态框(typeWidth<1.1)无图标）*/}
        <div
          className="card-type-row absolute flex items-center justify-center"
          style={{ left: px(0.10), width: pw(0.80), top: py(0.530), height: ph(0.050) }}
        >
          <span
            className="sts-body"
            style={{
              fontSize: width * 0.057,
              color: '#595959',
              textShadow: '0 1px 1px rgba(0,0,0,0.35)',
              letterSpacing: 0.5,
            }}
          >
            {typeName}
          </span>
        </div>
        {/* 描述（原版 renderDescriptionCN：文本块底端锚定，行距收紧至原版 1.45×cap）*/}
        <div
          className="card-desc sts-body absolute text-center"
          style={{
            left: px(0.08), width: pw(0.84), top: py(0.495), height: ph(0.375),
            fontSize: width * 0.076,
            lineHeight: 1.15,
            color: '#f2e6d0',
            textShadow: '1px 1px 1px #000',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            paddingBottom: ph(0.06),
            overflow: 'hidden',
          }}
        >
          <div style={{ width: '100%' }}>
            {upgraded && <span style={{ color: '#7fe08a' }}>+ </span>}
            {descSegs
              ? descSegs.map((s, i) =>
                s.c
                  ? <span key={i} style={{ color: s.c, fontWeight: 700 }}>{s.t}</span>
                  : <span key={i}>{s.t}</span>)
              : desc}
          </div>
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
