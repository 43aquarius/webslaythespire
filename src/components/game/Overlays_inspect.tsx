'use client'
// ============ 遮罩层：牌堆查看 / 卡牌选择 / 预见 / 检视屏 ============
import { sfx } from '@/game/sfx'
import { useEffect, useState } from 'react'
import { useGame } from '@/store/gameStore'
import { CardInstance } from '@/game/types'
import { AP } from '@/game/engine'
import { CardView } from './CardView'
import { CARDS, cardColor, cardCost, cardDescParts, cardValues, isStatusCard } from '@/game/cards'
import { STATUS_INFO } from '@/game/statusInfo'

const A = '/assets'

// ============ 检视屏关键词表（原版 GameDictionary.keywords → renderTips） ============
const SCV_KEYWORDS: Record<string, string> = {
  '消耗': '打出后，这张牌将在本场战斗中移除。',
  '虚无': '回合结束时，消耗这张牌。',
  '固有': '在每场战斗开始时，这张牌就在你的手牌中。',
  '保留': '这张牌不会被弃置。回合结束时将其保留在手牌中。',
  '吸取': '消耗抽牌堆顶的 N 张牌并获得能量。',
  '下注': '若这是你本回合打出的第一张牌，获得 N 点能量。',
}
function scvTips(card: CardInstance): { name: string; desc: string }[] {
  const def = CARDS[card.id]
  if (!def) return []
  const text = `${def.desc} ${def.upDesc ?? ''}`
  const out: { name: string; desc: string }[] = []
  const seen = new Set<string>()
  for (const [kw, desc] of Object.entries(SCV_KEYWORDS)) {
    if (text.includes(kw) && !seen.has(kw)) { out.push({ name: kw, desc }); seen.add(kw) }
  }
  for (const info of Object.values(STATUS_INFO)) {
    if (info.name.length >= 2 && text.includes(info.name) && !seen.has(info.name)) {
      out.push({ name: info.name, desc: info.desc }); seen.add(info.name)
    }
  }
  return out.slice(0, 5)
}

// ============ 检视屏大卡（原版 SingleCardViewPopup，1024 画布盒架构） ============
// 所有图层（bg/大图插画/frame/banner）烘焙为 1024x1024 全画布图 → inset:0 同盒渲染（与 CardView 512 画布同构）
// 布局常量：原版 1920x1080 × 5/6 → 舞台 1600x900；字号 = 画布宽 × 原版字号/1024
const SCV = { size: 1024 }
const sx = (p: number) => `${p * 100}%`

function ScvCard({ card, viewingUpgrade, canvasW = 853 }: {
  card: CardInstance; viewingUpgrade: boolean; canvasW?: number
}) {
  const def = CARDS[card.id]
  if (!def) return null
  const cursed = !!def.curse
  const status = isStatusCard(card.id)
  const color = cursed || status ? 'Colorless' : (cardColor(card.id) || 'red').replace(/^./, c => c.toUpperCase())
  const rar = def.rarity === 'rare' ? 'Rare' : def.rarity === 'uncommon' ? 'Uncommon' : 'Common'
  const typeCap = def.type[0].toUpperCase() + def.type.slice(1)

  const bg = cursed ? `${A}/scv/bgSkillCurse.webp` : `${A}/scv/bg${typeCap}${color}.webp`
  const frame = `${A}/scv/frame${typeCap}${rar}.webp`
  const banner = `${A}/scv/banner${rar}.webp`
  const orb = `${A}/scv/orb${color}.webp`
  const cost = cardCost(card)

  const f = (n: number) => canvasW * n / SCV.size   // 原版字号 → 舞台像素

  // 描述：底端锚定（原版 renderDescriptionCN draw_y = current_y+100s + 行距 1.53×capHeight）
  const descSegs = cardDescParts(card, undefined, viewingUpgrade
    ? (idx, v) => ({ v, color: '#7fff00' })   // 查看升级版：动态值全绿（原版 upgradedD/B/M → GREEN_TEXT）
    : undefined)

  return (
    <div className="scv-card relative" style={{ width: canvasW, height: canvasW }}>
      <div className="absolute" style={{ inset: 0 }}>
        <img src={bg} alt="" className="scv-layer" data-scv="bg" draggable={false} />
        {/* 高清插画（原版 1024Portraits 500x380 → 窗 20.7%..79.3% / 17.3%..61.8% 画布） */}
        <img
          src={`${A}/scvart/${card.id}.webp`} alt={def.name}
          className="scv-art"
          data-scv="art"
          style={{ left: sx(0.207), top: sx(0.173), width: sx(0.586), height: sx(0.445) }}
          draggable={false}
        />
        <img src={frame} alt="" className="scv-layer" data-scv="frame" draggable={false} />
        <img src={banner} alt="" className="scv-layer" data-scv="banner" draggable={false} />
        {/* 能量宝珠（164 画布独立图，中心 23.6%/12.9%） */}
        {cost !== -99 && (
          <img src={orb} alt="" className="scv-art" data-scv="orb"
            style={{ left: sx(0.156), top: sx(0.049), width: sx(0.16), height: sx(0.16) }}
            draggable={false} />
        )}
        {/* 能量数字（原版 SCP_cardEnergyFont 76，白 CREAM；位置 21.5%/10.5% 顶） */}
        {cost !== -99 && (
          <div className="absolute sts-title flex items-center justify-center" data-scv="cost"
            style={{ left: sx(0.175), top: sx(0.049), width: sx(0.14), height: sx(0.16), fontSize: f(76), color: '#fff6e2', textShadow: '3px 3px 0 #000' }}>
            {cost === -1 ? 'X' : cost}
          </div>
        )}
        {/* 卡名（原版 SCP_cardTitleFont_small 46 @ 中心17%；查看升级 → 绿） */}
        <div className="absolute sts-title flex items-center justify-center text-center" data-scv="name"
          style={{ left: sx(0.10), width: sx(0.80), top: sx(0.146), height: sx(0.052), fontSize: f(46), lineHeight: 1.05, overflow: 'hidden',
            color: viewingUpgrade ? '#7fff00' : '#fff6e2',
            textShadow: '2px 2px 0 #000, 0 0 10px rgba(0,0,0,.8)' }}>
          {def.name}
        </div>
        {/* 类型行（原版 panelNameFont 34 @ 中心53.9%，#595959，ZHS 无动态框） */}
        <div className="absolute flex items-center justify-center" data-scv="type"
          style={{ left: sx(0.10), width: sx(0.80), top: sx(0.522), height: sx(0.034) }}>
          <span className="sts-body" style={{ fontSize: f(34), color: '#595959', letterSpacing: 1, textShadow: '0 1px 1px rgba(0,0,0,.35)' }}>
            {def.type === 'attack' ? '攻击' : def.type === 'power' ? '能力' : '技能'}
          </span>
        </div>
        {/* 描述（原版 SCP_cardDescFont 48，CREAM #fff6e2，底端锚定至 79.3%，行距 1.53×cap≈1.07） */}
        <div className="card-desc absolute text-center sts-body" data-scv="desc"
          style={{
            left: sx(0.10), width: sx(0.80), top: sx(0.558), height: sx(0.235),
            fontSize: f(48), lineHeight: 1.07, color: '#fff6e2',
            textShadow: '2px 2px 2px #000',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            overflow: 'hidden',
          }}>
          <div style={{ width: '100%' }}>
            {descSegs.map((s, i) => s.c
              ? <span key={i} style={{ color: s.c, fontWeight: 700 }}>{s.t}</span>
              : <span key={i}>{s.t}</span>)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ 检视屏（原版 PC SingleCardViewPopup 复刻） ============
// 黑0.9背板 pow2In 0.25s 渐入 + 1024 大卡 + POPUP_ARROW 翻页（端点隐藏）+
// CHECKBOX/TICK「看升级版」（诅咒/状态卡隐藏，原版 allowUpgradePreview）+
// 关键词 tips @ 卡右侧（原版 renderTips）+ 点击卡外/Esc 关闭
export function InspectView({ cards, index, onIndex, onClose }: {
  cards: CardInstance[]; index: number; onIndex: (i: number) => void; onClose: () => void
}) {
  const card = cards[index]
  // 原版 isViewingUpgrade：默认 false；翻页保留状态（openPrev/openNext: tmp 传递）
  const [ticked, setTicked] = useState(false)

  const def = CARDS[card.id]
  // 原版 allowUpgradePreview：非诅咒(color!=CURSE)且非状态(type!=STATUS)
  const allowUpgrade = !!def && !def.curse && !isStatusCard(card.id)
  const shown: CardInstance = ticked ? { ...card, upgraded: card.upgraded + 1 } : card
  const tips = scvTips(card)

  const step = (d: number) => {
    const i = index + d
    if (i < 0 || i >= cards.length) return
    onIndex(i)
    sfx.play('cardSelect')
  }

  // 检视层开启期间打标记：page.tsx 的 Esc 处理据此让行（由本组件自行处理 Esc）
  useEffect(() => {
    document.body.dataset.stsInspect = '1'
    return () => { delete document.body.dataset.stsInspect }
  }, [])

  // 键盘：←/→ 翻页（原版 InputActionSet.left/right）、Enter/Space 切升级、Esc 关闭
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (allowUpgrade) setTicked(t => !t) }
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [index, allowUpgrade])

  return (
    <div className="absolute inset-0" style={{ zIndex: 320 }} onClick={e => e.stopPropagation()}>
      {/* 背板：黑 0→0.9 pow2In 0.25s（原版 updateFade） */}
      <div className="scv-backdrop" onClick={onClose} />
      {/* 大卡（1024 画布 853px，原版 renderHelper ×Settings.scale） */}
      <div className="absolute" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
        <ScvCard card={shown} viewingUpgrade={ticked} canvasW={853} />
      </div>
      {/* 翻页箭头（原版 POPUP_ARROW 256 @ W/2±400s；hover 白50%加色叠层） */}
      {index > 0 && (
        <div className="scv-arrow" style={{ left: 800 - 333 - 106, top: 450 - 106 }} onClick={() => step(-1)} title="上一张 (←)">
          <img src={`${A}/scv/arrow.webp`} alt="" draggable={false} />
        </div>
      )}
      {index < cards.length - 1 && (
        <div className="scv-arrow scv-arrow-next" style={{ left: 800 + 333 - 106, top: 450 - 106 }} onClick={() => step(1)} title="下一张 (→)">
          <img src={`${A}/scv/arrow.webp`} alt="" draggable={false} />
        </div>
      )}
      {/* 升级查看（原版 CHECKBOX+TICK 64 @ (W/2, 70s)；文案 cardTitleFont 27；hover 蓝 #87ceeb / 平时金 #efc851） */}
      {allowUpgrade && (
        <div className="scv-upgrade-toggle" onClick={() => setTicked(t => !t)} title="查看升级后的数值 (空格)">
          <div className="scv-checkbox">
            <img src={`${A}/scv/checkbox.webp`} alt="" draggable={false} />
            {ticked && <img src={`${A}/scv/tick.webp`} alt="" className="scv-tick-img" draggable={false} />}
          </div>
          <span className="sts-title scv-upgrade-label">看升级版</span>
        </div>
      )}
      {/* 关键词 tips（原版 renderTips queuePowerTips @ W/2+340s, 420s） */}
      {tips.length > 0 && (
        <div className="scv-tips">
          {tips.map((t, i) => (
            <div key={i} className="scv-tip">
              <div className="sts-title" style={{ fontSize: 21, color: '#ffd76a', textShadow: '2px 2px 0 #000' }}>{t.name}</div>
              <div className="sts-body" style={{ fontSize: 16, color: '#e8dcc8', lineHeight: 1.4 }}>{t.desc}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
