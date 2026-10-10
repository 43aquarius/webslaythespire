'use client'
// ============ 战斗共享小组件 ============
import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { StatusMap } from '@/game/types'
import { RELICS } from '@/game/relics'
import { POTIONS } from '@/game/potions'
import { POTION_LAYERS, POTION_PLACEHOLDER_COLOR, potionLayerKey, POTION_PLACEHOLDER_KEY } from '@/game/potionLayers'
import { useGame } from '@/store/gameStore'
import { AP } from '@/game/engine'
import { CHARACTER_INFO } from '@/game/run'

import { STATUS_INFO, statusImgPath } from '@/game/statusInfo'
import { STAGE_W, STAGE_H } from './Stage'
export { STATUS_INFO }
const A = '/assets'

export function statusImg(id: string): string {
  return statusImgPath(id, A)
}





// ============ 悬浮提示（支持触屏：轻点显示 2 秒；舞台逻辑坐标钳制，永不跑出屏幕） ============
export function Tip({ children, tip, className = '' }: { children: ReactNode; tip: ReactNode; className?: string }) {
  const [show, setShow] = useState(false)
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const [offset, setOffset] = useState<{ l: number; t: number } | null>(null)
  useEffect(() => () => { if (touchTimer.current) clearTimeout(touchTimer.current) }, [])
  const onTouchStart = () => {
    setShow(true)
    if (touchTimer.current) clearTimeout(touchTimer.current)
    touchTimer.current = setTimeout(() => setShow(false), 2000)
  }

  // 显示时计算钳制位置：以上方居中为基准，放不下改下方，水平/垂直均钳制在舞台内
  useLayoutEffect(() => {
    if (!show) { setOffset(null); return }
    const anchor = anchorRef.current
    const tipEl = tipRef.current
    if (!anchor || !tipEl) return
    const stage = anchor.closest('[data-stage]') as HTMLElement | null
    if (!stage) { setOffset(null); return }   // 不在舞台内：退化为默认样式（居中上方）
    const sr = stage.getBoundingClientRect()
    const ar = anchor.getBoundingClientRect()
    const tr = tipEl.getBoundingClientRect()
    const scale = sr.width / STAGE_W
    if (!(scale > 0)) return
    // 全部换算为舞台逻辑坐标（等比缩放前的 1600×900 坐标系）
    const tw = tr.width / scale, th = tr.height / scale
    const ax = (ar.left - sr.left) / scale + ar.width / scale / 2
    const aTop = (ar.top - sr.top) / scale
    const aBottom = (ar.bottom - sr.top) / scale
    const aLeft = (ar.left - sr.left) / scale
    const gap = 8, pad = 8
    let x = ax - tw / 2
    let y = aTop - th - gap
    if (y < pad) y = aBottom + gap                 // 上方放不下 → 移到下方
    if (x + tw > STAGE_W - pad) x = STAGE_W - pad - tw
    if (x < pad) x = pad
    if (y + th > STAGE_H - pad) y = Math.max(pad, STAGE_H - pad - th)
    setOffset({ l: x - aLeft, t: y - aTop })
  }, [show, tip])

  const placed = show && offset !== null
  return (
    <span
      ref={anchorRef}
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onTouchStart={onTouchStart}
    >
      {children}
      {show && (
        <span
          ref={tipRef}
          className={`sts-body absolute px-3 py-2 rounded-lg z-[300] block w-max max-w-[260px] text-left ${className}`}
          style={{
            left: placed ? offset.l : '50%',
            top: placed ? offset.t : undefined,
            bottom: placed ? undefined : '100%',
            transform: placed ? undefined : 'translateX(-50%)',
            marginTop: placed ? undefined : 8,
            visibility: placed ? undefined : 'hidden',
            background: 'linear-gradient(180deg, #2b1a12 0%, #1a0e08 100%)',
            border: '1.5px solid #7a5a3a',
            color: '#f5e8d2',
            boxShadow: '0 6px 20px rgba(0,0,0,0.8)',
            fontSize: 13, lineHeight: 1.45,
            pointerEvents: 'none',
          }}
        >
          {tip}
        </span>
      )}
    </span>
  )
}

// ============ HUD 浮动数字动画（金币/血量变化） ============
export function HudFloat({ items }: { items: { id: number; v: number; color: string }[] }) {
  if (!items.length) return null
  return (
    <>
      {items.map(f => (
        <span
          key={f.id}
          className="absolute sts-num font-black sts-float sts-body whitespace-nowrap"
          style={{ left: '50%', top: -8, transform: 'translateX(-50%)', fontSize: 19, color: f.color, textShadow: '1px 1px 0 #000, 0 0 6px #000', zIndex: 50 }}
        >
          {f.v > 0 ? `+${f.v}` : f.v}
        </span>
      ))}
    </>
  )
}

export function useValueFloat(value: number) {
  const prev = useRef(value)
  const [items, setItems] = useState<{ id: number; v: number }[]>([])
  useEffect(() => {
    const d = value - prev.current
    prev.current = value
    if (d === 0) return
    const id = Date.now() + Math.random()
    setItems(f => [...f, { id, v: d }])
    const t = setTimeout(() => setItems(f => f.filter(x => x.id !== id)), 1150)
    return () => clearTimeout(t)
  }, [value])
  return items
}

// ============ 金钱逐级计数（原版 NTopBarGold.UpdateGoldAnim：0.25+0.15s 延迟后按步长 75/10/1 递变，10-110ms 间隔，0.25s 后结算） ============
const goldWait = (ms: number) => new Promise(r => setTimeout(r, ms))
export function useGoldLabel(gold: number) {
  const [label, setLabel] = useState(gold)
  const st = useRef({ cur: gold, add: 0, running: false })
  useEffect(() => {
    const s = st.current
    s.add += gold - s.cur
    s.cur = gold
    if (s.running || s.add === 0) return
    s.running = true
    // 第二十三批修复：不再用 cleanup 杀循环——快速连续变化时 cleanup 会让旧循环早死
    // 且新 effect 因 running=true 提前 return，导致动画死锁停在中途（label 不再到达 cur）
    // 旧循环读取同一 st.current，会自动处理后续累计的 add
    ;(async () => {
      await goldWait(400)
      while (s.add !== 0) {
        const a = Math.abs(s.add), n = a > 100 ? 75 : a > 50 ? 10 : 1
        s.add = s.add > 0 ? s.add - n : s.add + n
        setLabel(s.cur - s.add)
        await goldWait(Math.trunc(10 + 10 * Math.max(0, 10 - Math.abs(s.add))))
      }
      await goldWait(250)
      setLabel(s.cur)
      s.running = false
    })()
  }, [gold])
  return label
}

// ============ 卡组数量新高弹跳（原版 NTopBarDeckButton：新高时 scale 1.5→1，0.5s Expo Out） ============
export function DeckCount({ n }: { n: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const max = useRef(0)
  useEffect(() => {
    if (n > max.current) {
      max.current = n
      ref.current?.animate?.(
        [{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }],
        { duration: 500, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      )
    }
  }, [n])
  return <span ref={ref} className="inline-block" style={{ transformOrigin: 'center' }}>{n}</span>
}

// ============ 玩家血量文字（原版：无血条，红色 78/80 样式） ============
export function HpText({ hp, maxHp, block, size = 21, showName }: { hp: number; maxHp: number; block?: number; size?: number; showName?: string }) {
  const low = hp > 0 && hp <= maxHp * 0.3
  return (
    <div className="flex items-center gap-1.5">
      {block !== undefined && block > 0 && (
        <span className="relative inline-flex" style={{ width: size * 1.15, height: size * 1.15 }}>
          <img src={`${A}/status/block.png`} alt="block" className="w-full h-full object-contain" draggable={false} />
          <span className="absolute inset-0 flex items-center justify-center sts-num font-bold"
            style={{ fontSize: size * 0.52, color: '#cfe8ff', textShadow: '1px 1px 0 #000', paddingTop: 1 }}>{block}</span>
        </span>
      )}
      <span className="sts-num font-bold"
        style={{
          fontSize: size, lineHeight: 1,
          color: low ? '#ff3b2e' : '#ff5a48',
          textShadow: '1px 1px 0 #000, 0 0 5px rgba(0,0,0,0.9)',
          animation: low ? 'sts-hp-low 1.1s ease-in-out infinite' : undefined,
        }}>
        {hp}/{maxHp}
      </span>
      {showName && (
        <span className="sts-body font-bold" style={{ fontSize: 12, color: '#c8a878', textShadow: '1px 1px 0 #000', marginLeft: 2 }}>
          {showName}
        </span>
      )}
    </div>
  )
}

// ============ 顶部 HUD（第二十三批：原版 TopPanel 全套复刻） ============
// 原版布局（1920×1080→1600×900 等比 5/6）：单行顶栏 bar.png(128→107)
//   名字白34px(→28) + 称号灰(b3b3b3) / 心64(hover1.2x)+HP文字 SALMON #fa8072 / 钱袋64(hover1.2x)+金币三态色 /
//   药水带(potionSelectBox 274x106→228x88 动态宽) / 层旗64+CREAM #fff6e2 数字 / 遗物带 / 右上 deck(数量)+settings(旋转齿轮)
// 金币三态（原版 renderGold）：displayGold==gold→GOLD #efc851 / >gold(花费中)→RED #ff6563 / <gold(获得中)→GREEN #7fff00
// 右上图标 hover：CYAN 染色 + 25% 白叠层（复刻 libGDX setColor×白纹理 + 白α.25 二次绘制）
const TP_ICO = 53    // 原版图标 64×5/6
const TP_TXT = 22    // 原版 topPanelInfoFont 26×5/6
const TP_H = 107     // 原版 TOPBAR_H 128×5/6
export function TopHud({ combat = false, floor }: { combat?: boolean; floor?: number }) {
  const run = useGame(s => s.run)
  const openPile = useGame(s => s.openPile)
  const discardPotion = useGame(s => s.discardPotion)
  const usePotionMap = useGame(s => s.usePotionMap)
  const selectedPotionIdx = useGame(s => s.selectedPotionIdx)
  const net = useGame(s => s.net)
  const potionBeltFail = useGame(s => s.potionBeltFail)
  const combatOn = useGame(s => !!s.run?.combat)
  const toggleMenu = useGame(s => s.toggleMenu)

  // 金币/血量变化浮动动画 + 新获遗物闪光（原版动画还原；hooks 须在早退前）
  const me0 = run ? (run.players[run.players.length > 1 ? net.myIdx : 0] || run.players[0]) : null
  const goldFloats = useValueFloat(me0?.gold ?? 0)
  const hpFloats = useValueFloat(me0?.hp ?? 0)
  const goldLabel = useGoldLabel(me0?.gold ?? 0)   // 原版 NTopBarGold：逐级计数
  const relicCount = me0?.relics.length ?? 0
  const [newRelic, setNewRelic] = useState(false)
  const prevRelics = useRef(relicCount)
  useEffect(() => {
    if (relicCount > prevRelics.current) {
      setNewRelic(true)
      const t = setTimeout(() => setNewRelic(false), 900)
      prevRelics.current = relicCount
      return () => clearTimeout(t)
    }
    prevRelics.current = relicCount
  }, [relicCount])

  // 药水退场 ghost（原版 NPotion：使用 scale→0 0.2s Back In / 丢弃上浮 100px 0.4s Back In）
  const potions0 = me0?.potions ?? []
  const prevPotions = useRef<(string | null)[]>(potions0)
  const [potGhosts, setPotGhosts] = useState<{ id: number; idx: number; pid: string; kind: 'use' | 'discard' }[]>([])
  const lastPotAct = useRef<'use' | 'discard'>('use')
  useEffect(() => {
    const prev = prevPotions.current, cur = potions0
    const gone: { id: number; idx: number; pid: string; kind: 'use' | 'discard' }[] = []
    for (let i = 0; i < prev.length; i++) {
      if (prev[i] && !cur[i]) gone.push({ id: Date.now() + Math.random(), idx: i, pid: prev[i]!, kind: lastPotAct.current })
    }
    if (gone.length) {
      setPotGhosts(g => [...g, ...gone])
      const ids = new Set(gone.map(x => x.id))
      setTimeout(() => setPotGhosts(g => g.filter(x => !ids.has(x.id))), 550)
    }
    prevPotions.current = cur
  }, [potions0])

  // 药水带满失败抖动（原版 NPotionContainer.PlayAddFailedAnim：3·sin(5t)·sin(t/2) px，0→2π，0.5s）
  const beltRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!potionBeltFail || !beltRef.current) return
    beltRef.current.animate(
      Array.from({ length: 25 }, (_, i) => {
        const t = (i / 24) * Math.PI * 2
        return { translate: `${3 * Math.sin(5 * t) * Math.sin(t / 2)}px 0` }
      }),
      { duration: 500 },
    )
  }, [potionBeltFail])

  // 战斗开始药水闪耀（原版 OnCombatSetUp→ShinePotions：1s 后有药的槽依次弹跳，0.25s 间隔）
  const [shineIdx, setShineIdx] = useState(-1)
  useEffect(() => {
    if (!combatOn) return
    let alive = true
    const timers: ReturnType<typeof setTimeout>[] = []
    const cur = me0?.potions ?? []
    setTimeout(() => {
      if (!alive) return
      let d = 0
      for (let i = 0; i < cur.length; i++) {
        if (!cur[i]) continue
        const k = i
        timers.push(setTimeout(() => { if (alive) setShineIdx(k) }, d))
        d += 250
      }
      timers.push(setTimeout(() => { if (alive) setShineIdx(-1) }, d + 300))
    }, 1000)
    return () => { alive = false; timers.forEach(clearTimeout) }
  }, [combatOn])
  // 闪耀弹跳（原版 NPotion.DoBounce：12px 上跳 0.125s Sine Out + 0.125s Sine In）
  useEffect(() => {
    if (shineIdx < 0 || !beltRef.current) return
    const el = beltRef.current.children[shineIdx]?.querySelector('.sts-slot') as HTMLElement | null
    el?.animate?.(
      [
        { transform: 'translateY(0)', easing: 'cubic-bezier(.61,1,.88,1)' },
        { transform: 'translateY(-12px)', easing: 'cubic-bezier(.12,0,.39,0)' },
        { transform: 'translateY(0)' },
      ],
      { duration: 250 },
    )
  }, [shineIdx])

  if (!run) return null

  const mp = run.players.length > 1
  const myIdx = mp ? net.myIdx : 0
  const me = run.players[myIdx] || run.players[0]
  const activeBlock = combat && run.combat ? (AP(run.combat).block ?? 0) : 0
  const myBlock = combat && run.combat && run.combat.activeIdx === myIdx ? activeBlock : 0
  const charDef = CHARACTER_INFO[me.character] ?? CHARACTER_INFO.ironclad
  // 原版金币三态色（renderGold：displayGold vs gold）
  const goldColor = goldLabel === me.gold ? '#efc851' : goldLabel > me.gold ? '#ff6563' : '#7fff00'

  const onPotionClick = (idx: number) => {
    const pid = me.potions[idx]
    if (!pid) return
    lastPotAct.current = 'use'
    if (!combat) { usePotionMap(idx); return }
    useGame.setState(s => ({ selectedPotionIdx: s.selectedPotionIdx === idx ? null : idx }))
  }

  const potSlots = me.potions.length || 3
  const potBoxW = Math.round(83 + potSlots * 63)   // 原版 draw 宽 100+slots×76×scale

  return (
    <div className="top-hud absolute top-0 inset-x-0 z-40 sts-screen-fade select-none"
      style={{ height: TP_H, pointerEvents: 'none' /* 空白区域点击穿透到下方敌人（修复Boss头部/意图点不到） */ }}>
      {/* 原版顶栏底板 bar.png（1920×128 等比拉伸） */}
      <img src={`${A}/topbar/bar.png`} alt="" draggable={false}
        className="absolute left-0 top-0" style={{ width: '100%', height: TP_H, objectFit: 'fill' }} />

      {/* ===== 主行区（原版 TopPanel 单行：名字/HP/金币/药水/层/遗物） ===== */}
      <div className="absolute flex items-start" style={{ left: 20, right: 220, top: 0, height: TP_H }}>
        {/* 名字（白 panelName 34→28）+ 称号（灰 #b3b3b3，原版 titleX 紧随名字右侧） */}
        <Tip tip={<b>{me.name}{mp ? '（你）' : ''}</b>}>
          <span className="tp-name" style={{ margin: '15px 0 0 0', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'baseline', gap: 12, lineHeight: 1 }}>
            <b style={{ fontSize: 28, color: '#fff', textShadow: '1px 1px 0 #000' }}>{charDef.name}</b>
            <i style={{ fontSize: 15, color: '#b3b3b3', fontStyle: 'normal', textShadow: '1px 1px 0 #000' }}>{charDef.nameEn}</i>
          </span>
        </Tip>

        {/* HP：心图标(hover 1.2x) + 78/80（SALMON #fa8072，原版 HP_NUM_OFFSET_X=60×5/6≈50） */}
        <span id="hud-hp" className="tp-stat pointer-events-auto" style={{ marginLeft: 17, display: 'inline-flex', alignItems: 'flex-start' }}>
          <span className="tp-ico" style={{ width: TP_ICO, height: TP_ICO, flex: '0 0 auto' }}>
            <img src={`${A}/topbar/hp.png`} alt="hp" draggable={false} />
          </span>
          <span className="relative" style={{ marginLeft: -3, paddingTop: 20, whiteSpace: 'nowrap', lineHeight: 1 }}>
            <HudFloat items={hpFloats.map(f => ({ ...f, color: f.v > 0 ? '#7fe08a' : '#ff5a4a' }))} />
            {myBlock > 0 && (
              <span className="relative" style={{ width: 26, height: 26, display: 'inline-flex', verticalAlign: '-7px', marginRight: 4 }}>
                <img src={`${A}/status/block.png`} alt="block" className="w-full h-full object-contain" draggable={false} />
                <span className="absolute inset-0 flex items-center justify-center sts-num font-bold"
                  style={{ fontSize: 13, color: '#cfe8ff', textShadow: '1px 1px 0 #000', paddingTop: 1 }}>{myBlock}</span>
              </span>
            )}
            <b className="sts-num hp-num-val" style={{ fontSize: TP_TXT, color: '#fa8072', textShadow: '1px 1px 0 #000, 0 0 5px rgba(0,0,0,.9)' }}>
              {me.hp}/{me.maxHp}
            </b>
          </span>
        </span>

        {/* 金币：钱袋(hover 1.2x) + 逐级计数数字（三态色，原版 GOLD_NUM_OFFSET_X=65×5/6≈54） */}
        <span id="hud-gold" className="tp-stat pointer-events-auto relative" style={{ marginLeft: 48, display: 'inline-flex', alignItems: 'flex-start' }}>
          <span className="tp-ico" style={{ width: TP_ICO, height: TP_ICO, flex: '0 0 auto' }}>
            <img src={`${A}/topbar/gold.png`} alt="gold" draggable={false} />
          </span>
          <span className="relative" style={{ marginLeft: 1, paddingTop: 20, whiteSpace: 'nowrap', lineHeight: 1 }}>
            <HudFloat items={goldFloats.map(f => ({ ...f, color: '#ffd980' }))} />
            <b className="sts-num gold-val" style={{ fontSize: TP_TXT, color: goldColor, textShadow: '1px 1px 0 #000, 0 0 5px rgba(0,0,0,.9)' }}>
              {goldLabel}
            </b>
            {mp && <span className="sts-num gold-mate" style={{ marginLeft: 8, fontSize: 13, color: '#a8b8c8' }}>（队友 {run.players[1 - myIdx]?.gold ?? '-'}）</span>}
          </span>
        </span>

        {/* 药水带（原版 potionSelectBox 274×106 → 动态宽 83+N×63；槽 46） */}
        <span id="hud-potions" ref={beltRef} className="pointer-events-auto relative"
          style={{ marginLeft: 52, marginTop: 8, width: potBoxW, height: 73, flex: '0 0 auto' }}>
          <img src={`${A}/topbar/potionbox.png`} alt="" draggable={false}
            className="tp-potbox absolute inset-0 w-full h-full" style={{ objectFit: 'fill' }} />
          <span className="absolute inset-0 flex items-center justify-center" style={{ gap: 17, padding: '0 14px' }}>
            {me.potions.map((pid, i) => (
              <PotionSlot
                key={pid ?? `empty-${i}`} potionId={pid} size={46}
                selected={combat && selectedPotionIdx === i}
                acquired={!!pid && !prevPotions.current[i]}
                onClick={() => onPotionClick(i)}
                onDiscard={combat ? () => { lastPotAct.current = 'discard'; discardPotion(i) } : undefined}
              />
            ))}
            {potGhosts.map(g => (
              <span key={g.id} className={`sts-pot-ghost sts-pot-ghost-${g.kind}`}
                style={{ left: 14 + g.idx * 63, top: 8, width: 46, height: 53, position: 'absolute', pointerEvents: 'none' }}>
                <PotionImg potionId={g.pid} />
              </span>
            ))}
          </span>
        </span>

        {/* 层数：旗图标 + CREAM 数字（原版 floorX 文字偏移 60×5/6=50；Tip 显示幕） */}
        {floor !== undefined && (
          <Tip tip={<b>第 {run.act} 幕 · 第 {floor} 层</b>}>
            <span id="hud-floor" className="tp-stat tp-floor pointer-events-auto" style={{ marginLeft: 48, display: 'inline-flex', alignItems: 'flex-start' }}>
              <img src={`${A}/topbar/floor.png`} alt="floor" draggable={false}
                style={{ width: TP_ICO, height: TP_ICO, objectFit: 'contain' }} />
              <b className="sts-num floor-val" style={{ marginLeft: -3, paddingTop: 20, fontSize: TP_TXT, lineHeight: 1, color: '#fff6e2', textShadow: '1px 1px 0 #000, 0 0 5px rgba(0,0,0,.9)' }}>
                {floor}
              </b>
            </span>
          </Tip>
        )}

        {/* 遗物带（原版 128×5/6≈107 视觉，取 56；顶栏垂直居中） */}
        <span id="hud-relics" className="hud-relics pointer-events-auto flex items-center flex-wrap content-center"
          style={{ marginLeft: 26, height: TP_H, maxWidth: 560, gap: 4, alignContent: 'center' }}>
          {me.relics.map((id, i) => <RelicIcon key={id} id={id} size={56} flash={newRelic && i === me.relics.length - 1} />)}
        </span>
      </div>

      {/* ===== 右上角图标区（原版 MAP/DECK/SETTINGS；本作：deck+settings，settings 齿轮常转，hover CYAN 染色） ===== */}
      <div className="absolute flex items-start" style={{ top: 0, right: 104, gap: 10, height: TP_H }}>
        <Tip tip={<b>查看牌组（{me.deck.length} 张）</b>}>
          <button className="tp-deck deck-btn pointer-events-auto relative" style={{ width: TP_ICO, height: TP_ICO, background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
            onClick={() => openPile('deck')}>
            <img src={`${A}/topbar/deck.png`} alt="deck" draggable={false} className="absolute inset-0 w-full h-full" style={{ objectFit: 'contain' }} />
            <span className="tint" /><span className="tint2" />
            <span id="hud-deck-count" className="sts-num absolute"
              style={{ right: -2, top: TP_ICO - 6, fontSize: 20, lineHeight: 1, color: '#fff', textShadow: '1px 1px 0 #000' }}>
              <DeckCount n={me.deck.length} />
            </span>
          </button>
        </Tip>
        <Tip tip={<b>设置</b>}>
          <button className="tp-tico settings pointer-events-auto relative" aria-label="设置"
            style={{ width: TP_ICO, height: TP_ICO, background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
            onClick={() => toggleMenu()}>
            <img src={`${A}/topbar/settings.png`} alt="settings" draggable={false} className="absolute inset-0 w-full h-full" style={{ objectFit: 'contain' }} />
            <span className="tint" /><span className="tint2" />
          </button>
        </Tip>
      </div>

      {/* 联机：队友血量（顶栏下缘贴挂） */}
      {mp && run.players.map((rp, i) => (
        i === myIdx ? null : (
          <div key={i} className="absolute flex items-center gap-1.5" style={{ top: TP_H + 4, right: 224 }}>
            <HpText hp={rp.hp} maxHp={rp.maxHp} size={17} showName={rp.name} />
          </div>
        )
      ))}
    </div>
  )
}

// ============ 状态图标行（获得新状态时图标闪光，原版 NPower PowerFlash：brightness≈2 闪现约 1s） ============
export function StatusRow({ statuses, size = 30 }: { statuses: StatusMap; size?: number }) {
  const entries = Object.entries(statuses).filter(([_, v]) => v !== 0)
  const prevRef = useRef<Record<string, number>>({})
  const [flashes, setFlashes] = useState<Record<string, number>>({})
  useEffect(() => {
    const nf: Record<string, number> = {}
    for (const [id, v] of Object.entries(statuses)) {
      if (v !== 0 && (!(id in prevRef.current) || v > (prevRef.current[id] ?? 0))) nf[id] = Date.now()
    }
    prevRef.current = statuses
    if (Object.keys(nf).length) {
      setFlashes(f => ({ ...f, ...nf }))
      setTimeout(() => setFlashes(f => { const c = { ...f }; for (const k in nf) delete c[k]; return c }), 950)
    }
  }, [statuses])
  if (!entries.length) return null
  return (
    <div className="flex flex-wrap gap-1 justify-center" style={{ maxWidth: 220 }}>
      {entries.map(([id, n]) => {
        const info = STATUS_INFO[id]
        const flashTs = flashes[id]
        return (
          <Tip
            key={`${id}-${flashTs || 0}`}
            tip={<><b style={{ color: info?.buff ? '#8fe89a' : '#ff9a8a' }}>{info?.name ?? id}</b><br />{info?.desc ?? ''}</>}
          >
            <span
              className={`relative inline-block rounded${flashTs ? ' sts-power-flash' : ''}`}
              style={{
                width: size, height: size,
                background: 'rgba(0,0,0,0.55)',
                border: '1px solid rgba(255,255,255,0.25)',
              }}
            >
              <img src={statusImg(id)} alt={id} className="w-full h-full object-contain" draggable={false}
                style={{ filter: id === 'vulnerable' || id === 'weak' || id === 'frail' || id === 'noDraw' ? 'drop-shadow(0 0 3px #c04030)' : 'drop-shadow(0 0 3px #30a0c0)', visibility: statusImg(id) ? 'visible' : 'hidden' }} />
              {n !== 1 || id === 'vulnerable' || id === 'weak' || id === 'frail' ? (
                <span
                  className="absolute sts-num font-bold"
                  style={{ right: -4, bottom: -4, fontSize: size * 0.42, color: '#ffe9a0', textShadow: '1px 1px 0 #000, 0 0 4px #000' }}
                >
                  {n}
                </span>
              ) : null}
            </span>
          </Tip>
        )
      })}
    </div>
  )
}

// ============ 血条 ============
// 有格挡时血条整体变蓝（原版行为：填充 rgb(59,111,163)、浅蓝外框、数字深蓝描边）
export function HpBar({ hp, maxHp, block, width = 200, label, poison = 0, poisonNext = 0 }: { hp: number; maxHp: number; block?: number; width?: number; label?: string; poison?: number; poisonNext?: number }) {
  const pct = Math.max(0, Math.min(100, hp / maxHp * 100))
  // 毒预览（原版：血条右端绿色段显示下回合毒伤；致死时数字变绿）
  const poisonPct = Math.max(0, Math.min(pct, poisonNext / maxHp * 100))
  const poisonLethal = poisonNext > 0 && poisonNext >= hp && hp > 0
  const blocked = (block ?? 0) > 0
  return (
    <div className="relative" style={{ width }}>
      <div className="sts-hpbar-outer relative" style={{ height: 22, boxShadow: blocked ? '0 0 0 2px rgba(178,224,255,0.85), 0 0 10px rgba(120,190,255,0.5)' : undefined }}>
        {/* 伤害滞后段（原版：受击时红条瞬间缩短，其后米白残条延迟~0.4s后经0.8s收缩） */}
        <div className="sts-hpbar-lag absolute" style={{ width: `${pct}%` }} />
        <div className="sts-hpbar-fill absolute" style={{
          width: `${pct}%`,
          background: blocked ? 'linear-gradient(to bottom, #7d9fd4 0%, #3b6fa3 55%, #2c5480 100%)' : undefined,
          transition: 'background .3s ease',
        }} />
        {poisonPct > 0 && !poisonLethal && (
          <div className="sts-hpbar-poison absolute" style={{ left: `${pct}%`, width: `${poisonPct}%` }} />
        )}
        <div className="absolute inset-0 flex items-center justify-center sts-num sts-body font-bold"
          style={{ fontSize: 13, color: poisonLethal ? '#7dff8a' : '#fff', textShadow: blocked ? '1px 1px 0 #1B3045' : '1px 1px 0 #000' }}>
          {hp} / {maxHp}
        </div>
        {block !== undefined && block > 0 && (
          <div className="absolute flex items-center justify-center"
            style={{ left: -26, top: -2, width: 26, height: 26 }}>
            <img src={`${A}/status/block.png`} alt="block" className="w-full h-full object-contain" draggable={false} />
            <span className="absolute sts-num font-bold" style={{ fontSize: 12, color: '#cfe8ff', textShadow: '1px 1px 0 #000' }}>{block}</span>
          </div>
        )}
      </div>
      {label && (
        <div className="text-center sts-body" style={{ fontSize: 11, color: '#c8b090', marginTop: 1 }}>{label}</div>
      )}
    </div>
  )
}

// ============ 遗物提示 ============
// flash：获得闪光（原版 NRelicFlashVfx：三份叠加副本 α0.627、间隔0.2s、0.75→1.25 放大1s CubicOut、1.5s 淡出）
export function RelicIcon({ id, size = 42, flash }: { id: string; size?: number; flash?: boolean }) {
  const def = RELICS[id]
  if (!def) return null
  return (
    <Tip tip={<><b>{def.name}</b><br /><span style={{ color: '#d8c8a8' }}>{def.desc}</span></>}>
      <span className="sts-relic" style={{ width: size, height: size, position: 'relative' }}>
        <img src={`${A}/relics/${id}.png`} alt={def.name} className="w-[82%] h-[82%] object-contain" draggable={false} />
        {flash === true && [0, 1, 2].map(k => (
          <img key={`${id}-${k}`} src={`${A}/relics/${id}.png`} alt="" draggable={false}
            className="sts-relic-burst" style={{ animationDelay: `${k * 0.2}s` }} />
        ))}
      </span>
    </Tip>
  )
}

// ============ 原版药水分层渲染（第二十一批：复刻 AbstractPotion.render 层序） ============
// liquid(纯色mask着色) → hybrid(可选) → spots(可选) → glass(白，原图)；空槽 = 占位剪影 @ 白75%
// mask 技术复刻 libGDX sb.setColor × 白色纹理 = CSS mask + background-color
function potMask(url: string, bg: string): React.CSSProperties {
  return {
    position: 'absolute', inset: 0, display: 'block', background: bg,
    WebkitMaskImage: `url("${url}")`, maskImage: `url("${url}")`,
    WebkitMaskSize: 'contain', maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center', maskPosition: 'center',
  }
}

export function PotionImg({ potionId, className, style }: { potionId: string | null; className?: string; style?: React.CSSProperties }) {
  const box: React.CSSProperties = { position: 'relative', display: 'inline-block', width: '100%', height: '100%', verticalAlign: 'middle', ...style }
  if (!potionId) {
    return (
      <span className={`pot-layers ${className ?? ''}`} data-pot="empty" style={box}>
        <span className="pot-layer" data-layer="placeholder" style={potMask(`${A}/${POTION_PLACEHOLDER_KEY}`, POTION_PLACEHOLDER_COLOR)} />
      </span>
    )
  }
  const spec = POTION_LAYERS[potionId]
  if (!spec) return <span className={`pot-layers ${className ?? ''}`} data-pot={potionId} style={box} />
  return (
    <span className={`pot-layers ${className ?? ''}`} data-pot={potionId} style={box}>
      {spec.liquid ? <span className="pot-layer" data-layer="liquid" style={potMask(`${A}/${potionLayerKey(spec.shape, 'liquid')}`, spec.liquid)} /> : null}
      {spec.hybrid ? <span className="pot-layer" data-layer="hybrid" style={potMask(`${A}/${potionLayerKey(spec.shape, 'hybrid')}`, spec.hybrid)} /> : null}
      {spec.spots ? <span className="pot-layer" data-layer="spots" style={potMask(`${A}/${potionLayerKey(spec.shape, 'spots')}`, spec.spots)} /> : null}
      <img data-layer="glass" src={`${A}/${potionLayerKey(spec.shape, 'glass')}`} alt="" draggable={false}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
    </span>
  )
}

// ============ 药水槽（hover 弹跳 / 获得入场 / 原版 NPotion 外观） ============
export function PotionSlot({ potionId, size = 40, onClick, onDiscard, selected, acquired }: { potionId: string | null; size?: number; onClick?: () => void; onDiscard?: () => void; selected?: boolean; acquired?: boolean }) {
  const def = potionId ? POTIONS[potionId] : null
  if (!def) {
    // 空槽：原版行为 = 灰色占位剪影（POTION_PLACEHOLDER @ PLACEHOLDER_COLOR）
    return (
      <span
        className="sts-slot"
        style={{ width: size, height: size * 1.15, display: 'inline-block', position: 'relative' }}
      >
        <PotionImg potionId={null} />
      </span>
    )
  }
  return (
    <Tip tip={<><b>{def.name}</b><br /><span style={{ color: '#d8c8a8' }}>{def.desc}</span></>}>
      <span
        className={`sts-slot sts-pot-hover relative inline-block cursor-pointer ${selected ? 'sts-targetable' : ''} ${acquired ? 'sts-pot-in' : ''}`}
        onClick={onClick} style={{ width: size, height: size * 1.15, borderRadius: selected ? 8 : undefined }}>
        <PotionImg potionId={potionId} />
        {onDiscard && (
          <span
            className="pdisc absolute sts-body font-bold"
            style={{ right: -8, top: -6, width: 16, height: 16, borderRadius: '50%', background: '#6a2016', border: '1px solid #a05040', color: '#ffd0c0', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={(e) => { e.stopPropagation(); onDiscard() }}
          >✕</span>
        )}
      </span>
    </Tip>
  )
}

// ============ 浮动数字层 ============
export interface FloatItem { id: number; kind: string; value?: number; text?: string }

export function useAutoHide(timeout = 1200) {
  const [, force] = useState(0)
  const ref = useRef<any>(null)
  useEffect(() => {
    ref.current = setTimeout(() => force(x => x + 1), timeout)
    return () => { if (ref.current) clearTimeout(ref.current) }
  }, [timeout])
}
