'use client'
// ============ 战斗界面（参照原版布局 + 动画系统） ============
// 布局：左上 牌组+血条 / 右上 金币+药水+遗物（TopHud）
//       玩家左下、敌人中偏右、手牌底部扇形、能量球左下、结束回合右下
// 动画：出牌飞入（cardPlay fx）、斩击特效（slash fx）、敌人突进（lunge fx）、
//       抽牌飞入（新卡 keyframe）、受击闪白/震动（Web Animations API）
// 新系统：故障机器人宝球、观者姿态
import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame, FxItem } from '@/store/gameStore'
import { EnemyInstance, CardInstance } from '@/game/types'
import { CARDS, cardCost } from '@/game/cards'
import { ENEMIES } from '@/game/enemies'
import { enemyDisplayDamage } from '@/game/engine'
import { CardView } from './CardView'
import { StatusRow, HpBar, Tip, TopHud, STATUS_INFO, statusImg } from './Shared'
import { ScryOverlay } from './Overlays'

const A = '/assets'

// ============ 意图图标 ============
function IntentView({ enemy, targetable }: { enemy: EnemyInstance; targetable: boolean }) {
  const combat = useGame(s => s.run?.combat)
  if (!combat || !enemy.intent || enemy.dying) return null
  const it = enemy.intent
  const { dmg, times } = enemyDisplayDamage(enemy, combat.player.statuses, combat.player.stance)
  const map: Record<string, string> = {
    attack: 'attack3', attackDebuff: 'attack5', attackDefend: 'attack4',
    defend: 'defend', buff: 'buff', debuff: 'debuff', strongDebuff: 'debuffStrong',
    sleep: 'sleep', unknown: 'unknown',
  }
  const icon = `${A}/intent/${map[it.type] || 'unknown'}.png`
  const isAttack = it.type.startsWith('attack')
  const mvName = ENEMIES[enemy.id]?.moves[enemy.nextMoveIdx]?.name || ''

  return (
    <Tip tip={<b>{mvName}</b>}>
      <div className="sts-intent flex items-center gap-1" style={{ filter: 'drop-shadow(0 2px 4px #000)' }}>
        {isAttack && <img src={icon} alt="" width={40} height={40} draggable={false} />}
        {isAttack && (
          <span className="sts-num sts-body font-black" style={{ fontSize: 26, color: '#ffdf9a', textShadow: '1px 1px 0 #000, 0 0 8px #300' }}>
            {dmg}
            {times > 1 && <span style={{ fontSize: 17 }}>x{times}</span>}
          </span>
        )}
        {!isAttack && <img src={icon} alt="" width={42} height={42} draggable={false} />}
        {(it.type === 'attackDebuff' || it.type === 'attackDefend') && (
          <img src={`${A}/intent/${it.type === 'attackDebuff' ? 'debuff' : 'defend'}.png`} alt="" width={28} height={28} draggable={false} />
        )}
        {targetable && <span className="sts-body text-xs font-bold" style={{ color: '#ff6a50' }}>点击目标</span>}
      </div>
    </Tip>
  )
}

// ============ 浮动数字 ============
function FloatFx({ items, removeFx }: { items: FxItem[]; removeFx: (id: number) => void }) {
  const timedRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = []
    for (const it of items) {
      if (timedRef.current.has(it.id)) continue
      timedRef.current.add(it.id)
      timers.push(setTimeout(() => removeFx(it.id), 1150))
    }
    return () => timers.forEach(clearTimeout)
  }, [items, removeFx])
  if (!items.length) return null
  return (
    <>
      {items.map((it, i) => {
        let content: React.ReactNode = null
        let color = '#fff'
        if (it.kind === 'dmg') { content = it.value; color = '#ff5a4a' }
        else if (it.kind === 'heal') { content = `+${it.value}`; color = '#7fe08a' }
        else if (it.kind === 'block') { content = `+${it.value}`; color = '#9ac8f0' }
        else if (it.kind === 'status') {
          const info = STATUS_INFO[it.text || '']
          content = (
            <span className="flex items-center gap-1">
              <img src={statusImg(it.text || '')} alt="" width={28} height={28} />
              <span style={{ color: (it.value || 0) > 0 ? '#7fe08a' : '#ff8a7a' }}>{(it.value || 0) > 0 ? '+' : ''}{it.value}</span>
            </span>
          )
        } else if (it.kind === 'text') { content = it.text; color = '#ffe9a0' }
        else return null
        return (
          <div
            key={it.id}
            className="sts-float absolute sts-num font-black sts-body"
            style={{
              left: '50%', top: -14 - i * 10, transform: 'translateX(-50%)',
              fontSize: it.kind === 'dmg' ? 38 : 24, color, whiteSpace: 'nowrap',
            }}
          >
            {content}
          </div>
        )
      })}
    </>
  )
}

// ============ 斩击特效 ============
function SlashFx({ items, removeFx, big }: { items: FxItem[]; removeFx: (id: number) => void; big?: boolean }) {
  const timedRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = []
    for (const it of items) {
      if (timedRef.current.has(it.id)) continue
      timedRef.current.add(it.id)
      timers.push(setTimeout(() => removeFx(it.id), 420))
    }
    return () => timers.forEach(clearTimeout)
  }, [items, removeFx])
  if (!items.length) return null
  return (
    <>
      {items.map(it => (
        <div key={it.id} className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 55 }}>
          <div className="sts-slash" style={{ width: big ? 260 : 170, height: big ? 260 : 170, left: '50%', top: '38%', transform: 'translate(-50%,-50%)' }} />
        </div>
      ))}
    </>
  )
}

// ============ 敌人视图 ============
function EnemyView({ enemy }: { enemy: EnemyInstance }) {
  const run = useGame(s => s.run)
  const combat = useGame(s => s.run?.combat)
  const clickEnemy = useGame(s => s.clickEnemy)
  const selectedCard = useGame(s => s.selectedCardUid)
  const selectedPotion = useGame(s => s.selectedPotionIdx)
  const removeFx = useGame(s => s.removeFx)
  const fxList = useGame(s => s.fxList)
  const def = ENEMIES[enemy.id]

  const spriteRef = useRef<HTMLDivElement>(null)
  const lastFlashRef = useRef(0)
  const dmgEvents = fxList.filter(f => (f.kind === 'dmg' || f.kind === 'shake') && f.target === enemy.uid)
  const flashId = dmgEvents.length > 0 ? dmgEvents[dmgEvents.length - 1].id : 0
  useEffect(() => {
    if (flashId > lastFlashRef.current && spriteRef.current) {
      spriteRef.current.animate(
        [
          { filter: 'brightness(3) saturate(0)' },
          { filter: 'brightness(1) saturate(1)' },
        ],
        { duration: 350, easing: 'ease-out' }
      )
    }
    lastFlashRef.current = Math.max(lastFlashRef.current, flashId)
  }, [flashId])

  // 突进动画：敌人攻击时向玩家方向冲撞
  const lungeEvents = fxList.filter(f => f.kind === 'lunge' && f.target === enemy.uid)
  const lungeId = lungeEvents.length > 0 ? lungeEvents[lungeEvents.length - 1].id : 0
  const lastLungeRef = useRef(0)
  useEffect(() => {
    if (lungeId > lastLungeRef.current && spriteRef.current) {
      spriteRef.current.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-120px) scale(1.06)' },
          { transform: 'translateX(0)' },
        ],
        { duration: 420, easing: 'cubic-bezier(.3,0,.4,1)' }
      )
    }
    lastLungeRef.current = Math.max(lastLungeRef.current, lungeId)
  }, [lungeId])

  if (!combat || !run) return null
  const targetable = !!selectedCard || selectedPotion !== null
  const myFx = fxList.filter(f => f.target === enemy.uid && f.kind !== 'slash' && f.kind !== 'lunge')
  const mySlashes = fxList.filter(f => f.target === enemy.uid && f.kind === 'slash')
  const spriteW = def.boss ? 340 : def.elite ? 260 : def.small ? 150 : 210

  return (
    <div
      className={`relative flex flex-col items-center ${enemy.dying ? 'sts-dying' : ''} ${targetable ? 'sts-targetable' : ''}`}
      style={{ minWidth: spriteW * 0.8, borderRadius: 14, padding: '6px 10px' }}
      onClick={() => targetable && clickEnemy(enemy.uid)}
    >
      {/* 意图 */}
      <div className="mb-1" style={{ height: 50 }}>
        <IntentView enemy={enemy} targetable={targetable} />
      </div>
      {/* 浮动特效 */}
      <div className="absolute" style={{ top: 100, left: '50%', marginLeft: -60, width: 120, height: 40, zIndex: 60 }}>
        <FloatFx items={myFx} removeFx={removeFx} />
      </div>
      {/* 斩击特效 */}
      <SlashFx items={mySlashes} removeFx={removeFx} big={def.boss} />
      {/* 精灵图 */}
      <div ref={spriteRef}>
        <img
          src={`${A}/enemies/${def.sprite}.png`}
          alt={def.name}
          draggable={false}
          style={{
            width: spriteW, height: spriteW,
            objectFit: 'contain',
            filter: 'drop-shadow(0 10px 12px rgba(0,0,0,0.55))',
          }}
        />
      </div>
      {/* 名字 + 血条 + 状态 */}
      <div className="flex flex-col items-center gap-1" style={{ marginTop: -28 }}>
        <div className="sts-body font-bold" style={{ fontSize: 15, color: '#f5e5c8', textShadow: '1px 1px 0 #000' }}>
          {def.name}
        </div>
        <HpBar hp={enemy.hp} maxHp={enemy.maxHp} block={enemy.block} width={def.boss ? 280 : def.small ? 120 : 170} />
        <StatusRow statuses={enemy.statuses} size={28} />
      </div>
    </div>
  )
}

// ============ 宝球显示（故障机器人） ============
const ORB_STYLE: Record<string, { color: string; glow: string; symbol: string }> = {
  lightning: { color: '#f0d040', glow: 'rgba(240,208,64,0.55)', symbol: '⚡' },
  frost: { color: '#7ac0e8', glow: 'rgba(122,192,232,0.55)', symbol: '❄' },
  dark: { color: '#9a6ad8', glow: 'rgba(154,106,216,0.55)', symbol: '●' },
  plasma: { color: '#e87ab0', glow: 'rgba(232,122,176,0.55)', symbol: '✦' },
}

function OrbRow() {
  const combat = useGame(s => s.run?.combat)
  if (!combat?.player.orbs) return null
  const orbs = combat.player.orbs
  const slots = combat.player.orbSlots ?? 3
  if (combat.player.orbs.length === 0 && slots === 0) return null
  return (
    <div className="flex items-center gap-1.5" style={{ marginBottom: 4 }}>
      {Array.from({ length: Math.max(slots, orbs.length) }).map((_, i) => {
        const orb = orbs[i]
        if (!orb) {
          return <span key={i} style={{ width: 34, height: 34, borderRadius: '50%', border: '2px dashed rgba(120,140,200,0.35)', display: 'inline-block' }} />
        }
        const st = ORB_STYLE[orb.type]
        return (
          <Tip key={i} tip={<><b style={{ color: st.color }}>{ORB_NAME[orb.type]}</b><br />{ORB_DESC[orb.type]}</>}>
            <span
              className="sts-orb"
              style={{
                width: 34, height: 34, borderRadius: '50%',
                background: `radial-gradient(circle at 35% 30%, ${st.color} 0%, rgba(20,20,40,0.95) 80%)`,
                border: `2px solid ${st.color}`,
                boxShadow: `0 0 12px ${st.glow}`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 16, textShadow: '0 0 6px #000',
              }}
            >
              {st.symbol}
            </span>
          </Tip>
        )
      })}
    </div>
  )
}
const ORB_NAME: Record<string, string> = { lightning: '闪电球', frost: '霜球', dark: '暗球', plasma: '等离子球' }
const ORB_DESC: Record<string, string> = {
  lightning: '被动：回合结束对随机敌人造成 3 点伤害（受集中加成）。唤起：造成 9 点伤害。',
  frost: '被动：回合结束获得 2 点格挡。唤起：获得 5 点格挡。',
  dark: '被动：回合结束蓄伤 +6。唤起：造成等同蓄伤的伤害。',
  plasma: '被动：回合结束获得 1 点能量。唤起：获得 2 点能量。',
}

// ============ 姿态显示（观者） ============
const STANCE_STYLE: Record<string, { name: string; color: string; desc: string }> = {
  wrath: { name: '怒相', color: '#ff5a4a', desc: '造成与受到的攻击伤害翻倍。回合结束自动退出。' },
  calm: { name: '静相', color: '#7ac0e8', desc: '退出静相时获得 2 点能量。' },
  divinity: { name: '神格', color: '#ffd980', desc: '造成的攻击伤害三倍。回合结束自动退出。' },
}

function StanceBadge() {
  const combat = useGame(s => s.run?.combat)
  const stance = combat?.player.stance || 'none'
  const mantra = combat?.player.mantra || 0
  if (stance === 'none' && mantra === 0) return null
  const st = STANCE_STYLE[stance]
  return (
    <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
      {st && (
        <Tip tip={<><b style={{ color: st.color }}>{st.name}</b><br />{st.desc}</>}>
          <span
            className="sts-stance sts-title"
            style={{
              padding: '3px 14px', borderRadius: 20,
              background: `linear-gradient(180deg, ${st.color}33, rgba(10,8,6,0.9))`,
              border: `2px solid ${st.color}`,
              color: st.color, fontSize: 16, letterSpacing: 3,
              textShadow: '1px 1px 0 #000',
              boxShadow: `0 0 14px ${st.color}44`,
            }}
          >
            {st.name}
          </span>
        </Tip>
      )}
      {mantra > 0 && (
        <Tip tip={<><b style={{ color: '#c8b0e8' }}>真言 {mantra}/10</b><br />累积 10 点真言进入神格。</>}>
          <span className="sts-body" style={{ color: '#c8b0e8', fontSize: 13, textShadow: '1px 1px 0 #000' }}>
            真言 {mantra}/10
          </span>
        </Tip>
      )}
    </div>
  )
}

// ============ 出牌动画（卡牌飞入屏幕中央后消散） ============
function PlayedCardFx({ items, removeFx }: { items: FxItem[]; removeFx: (id: number) => void }) {
  const timedRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = []
    for (const it of items) {
      if (timedRef.current.has(it.id)) continue
      timedRef.current.add(it.id)
      timers.push(setTimeout(() => removeFx(it.id), 620))
    }
    return () => timers.forEach(clearTimeout)
  }, [items, removeFx])
  if (!items.length) return null
  const last = items[items.length - 1]
  const [cardId, upgraded] = (last.text || '').split('|')
  if (!CARDS[cardId]) return null
  const inst: CardInstance = { uid: 'played_fx', id: cardId, upgraded: Number(upgraded) || 0 }
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 70 }}>
      <div className="sts-card-play">
        <CardView card={inst} width={190} />
      </div>
    </div>
  )
}

// ============ 主战斗界面 ============
export function CombatScreen() {
  const run = useGame(s => s.run)
  const combat = useGame(s => s.run?.combat)
  const busy = useGame(s => s.busy)
  const endBanner = useGame(s => s.endBanner)
  const selectedCardUid = useGame(s => s.selectedCardUid)
  const selectedPotionIdx = useGame(s => s.selectedPotionIdx)
  const clickCard = useGame(s => s.clickCard)
  const cancelSelection = useGame(s => s.cancelSelection)
  const endTurn = useGame(s => s.endTurn)
  const openPile = useGame(s => s.openPile)
  const removeFx = useGame(s => s.removeFx)
  const fxList = useGame(s => s.fxList)

  // 屏幕震动
  const rootRef = useRef<HTMLDivElement>(null)
  const lastShakeRef = useRef(0)
  const shakeEvents = fxList.filter(f => f.kind === 'shake' && f.target === 'player')
  const shakeId = shakeEvents.length > 0 ? shakeEvents[shakeEvents.length - 1].id : 0
  useEffect(() => {
    if (shakeId > lastShakeRef.current && rootRef.current) {
      rootRef.current.animate(
        [
          { transform: 'translate(0, 0)' },
          { transform: 'translate(-7px, 4px)' },
          { transform: 'translate(6px, -5px)' },
          { transform: 'translate(-4px, -2px)' },
          { transform: 'translate(0, 0)' },
        ],
        { duration: 350, easing: 'ease-out' }
      )
    }
    lastShakeRef.current = Math.max(lastShakeRef.current, shakeId)
  }, [shakeId])

  const playerFx = fxList.filter(f => f.target === 'player' && f.kind !== 'cardPlay')
  const cardPlayFx = fxList.filter(f => f.kind === 'cardPlay')
  const hand = combat?.hand ?? []

  // 手牌 uid 集合（用于抽牌动画：新出现的卡播放飞入）
  const prevHandRef = useRef<Set<string>>(new Set())
  const handUids = useMemo(() => new Set(hand.map(c => c.uid)), [hand])
  const isNewCard = (uid: string) => !prevHandRef.current.has(uid)
  useEffect(() => {
    prevHandRef.current = handUids
  }, [handUids])

  // 触屏设备提示文案
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => { setIsTouch(window.matchMedia('(hover: none)').matches) }, [])

  // 手牌扇形布局
  const handLayout = (() => {
    const n = hand.length
    return hand.map((_, i) => {
      const mid = (n - 1) / 2
      const offset = i - mid
      const spread = Math.min(78, 700 / Math.max(n, 1))
      const rot = n > 1 ? (offset / mid) * (n > 5 ? 14 : 8) : 0
      const ty = Math.abs(offset) * Math.min(8, 44 / Math.max(n, 1)) * 0.9
      return { x: offset * spread, rot, ty }
    })
  })()

  if (!run || !combat) return null
  const p = combat.player
  const isDefect = run.character === 'defect'
  const isWatcher = run.character === 'watcher'
  const energyOrb = { ironclad: 'redEnergy', silent: 'greenEnergy', defect: 'blueEnergy', watcher: 'purpleEnergy' }[run.character]
  const heroSprite = run.character

  return (
    <div
      ref={rootRef}
      className="w-full h-full relative overflow-hidden select-none sts-screen-fade"
      style={{
        backgroundImage: `url(${A}/bg/${combatBg(run.act)}.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 30%',
      }}
      onClick={(e) => {
        const t = e.target as HTMLElement
        if (!t.closest('button, .sts-card, .sts-slot, .sts-relic, .sts-targetable')) cancelSelection()
      }}
    >
      {/* ===== 顶部 HUD ===== */}
      <TopHud combat />

      {/* ===== 玩家（左下） ===== */}
      <div className="absolute flex flex-col items-center gap-1.5" style={{ left: 44, bottom: 96, zIndex: 40 }}>
        <div className="relative" style={{ width: 240, height: 60 }}>
          <FloatFx items={playerFx} removeFx={removeFx} />
        </div>
        {/* 宝球 / 姿态 */}
        {isDefect && <OrbRow />}
        {isWatcher && <StanceBadge />}
        <StatusRow statuses={p.statuses} size={30} />
        <img
          src={`${A}/hero/${heroSprite}.png`}
          alt=""
          draggable={false}
          style={{ width: 240, height: 171, objectFit: 'contain', filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.5))' }}
        />
      </div>

      {/* ===== 敌人区 ===== */}
      <div className="absolute flex items-start justify-center gap-10"
        style={{ left: '31%', right: 12, top: 118, bottom: 300, zIndex: 30 }}>
        {combat.enemies.map(e => (
          <EnemyView key={e.uid} enemy={e} />
        ))}
      </div>

      {/* ===== 选中提示 ===== */}
      {(selectedCardUid || selectedPotionIdx !== null) && (
        <div className="absolute left-1/2 -translate-x-1/2 sts-body font-bold"
          style={{ bottom: 350, color: '#ff9a80', fontSize: 16, textShadow: '1px 1px 0 #000', zIndex: 55 }}>
          {selectedPotionIdx !== null
            ? '选择药水目标（点击敌人，点击空白处取消）'
            : isTouch
              ? '点击敌人打出 · 再点一次卡牌确认 · 点空白取消'
              : '选择目标（点击敌人，点击空白处取消）'}
        </div>
      )}

      {/* ===== 抽牌堆 ===== */}
      <PileButton label="抽牌堆" count={combat.drawPile.length} style={{ left: 26, bottom: 158 }} onClick={() => openPile('draw')} shuffled />
      {/* ===== 弃牌堆 ===== */}
      <PileButton label="弃牌堆" count={combat.discardPile.length} style={{ right: 26, bottom: 158 }} onClick={() => openPile('discard')} />
      {/* ===== 消耗堆 ===== */}
      {combat.exhaustPile.length > 0 && (
        <PileButton label="消耗堆" count={combat.exhaustPile.length} style={{ right: 26, bottom: 88 }} onClick={() => openPile('exhaust')} small />
      )}

      {/* ===== 能量球 ===== */}
      <div className="absolute sts-energy" style={{ left: 118, bottom: 116, width: 104, height: 104, zIndex: 44 }}>
        <img src={`${A}/frames/${energyOrb}.png`} alt="能量" className="w-full h-full object-contain" draggable={false} />
        <div className="absolute inset-0 flex items-center justify-center sts-num font-black"
          style={{ fontSize: 40, color: '#fff', textShadow: '2px 2px 0 #403010, 0 0 12px #ff5000' }}>
          {p.energy}
        </div>
      </div>

      {/* ===== 结束回合按钮 ===== */}
      <button
        className="sts-btn absolute sts-title"
        style={{
          right: 108, bottom: 116, fontSize: 24, padding: '13px 34px', zIndex: 46,
          opacity: combat.phase !== 'player' || busy ? 0.5 : 1,
        }}
        disabled={combat.phase !== 'player' || busy || combat.combatOver}
        onClick={endTurn}
      >
        {combat.phase === 'player' ? '结束回合' : '敌方回合…'}
      </button>

      {/* ===== 手牌 ===== */}
      <div className="absolute inset-x-0 flex justify-center items-end" style={{ bottom: -40, height: 320, zIndex: 45, pointerEvents: 'none' }}>
        {hand.map((card, i) => {
          const layout = handLayout[i]
          const isPlayable = combat.phase === 'player' && !busy && !combat.combatOver
          const isSelected = selectedCardUid === card.uid
          const cost = cardCost(card, p.hpLostThisCombat, p.cardsDiscardedThisTurn || 0)
          const enough = cost === -1 ? true : p.energy >= Math.max(0, cost)
          return (
            <div
              key={card.uid}
              className={`sts-hand-card ${isNewCard(card.uid) ? 'sts-draw-in' : ''}`}
              style={{
                position: 'absolute',
                transform: `translateX(${layout.x}px) translateY(${layout.ty}px) rotate(${layout.rot}deg)`,
                transformOrigin: 'bottom center',
                zIndex: 10 + i,
                pointerEvents: 'auto',
              }}
            >
              <div className="hand-inner"
                style={{ transform: isSelected ? 'translateY(-110px) scale(1.3)' : undefined }}>
                <CardView
                  card={card}
                  width={168}
                  ctx={{ hpLost: p.hpLostThisCombat, rampageBonus: combat.rampage?.[card.uid] || 0, glassKnifePenalty: combat.glassKnife?.[card.uid] || 0, clawBonus: combat.clawBonus || 0, shivBonus: p.statuses.accuracy || 0 }}
                  dimmed={!isPlayable || !enough}
                  selected={isSelected}
                  hoverPlay={isPlayable && enough}
                  onClick={() => clickCard(card.uid)}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* ===== 出牌动画 ===== */}
      <PlayedCardFx items={cardPlayFx} removeFx={removeFx} />

      {/* ===== 预见界面 ===== */}
      <ScryOverlay />

      {/* ===== 战斗结束横幅 ===== */}
      {endBanner && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 90, background: 'rgba(0,0,0,0.35)' }}>
          <div
            className="sts-title"
            style={{
              fontSize: 84,
              color: endBanner === 'win' ? '#ffd980' : '#ff6a50',
              textShadow: '3px 3px 0 #000, 0 0 40px rgba(0,0,0,0.9)',
              animation: 'sts-card-in .5s cubic-bezier(.2,.9,.3,1.2)',
            }}
          >
            {endBanner === 'win' ? '战斗胜利！' : '你倒下了…'}
          </div>
        </div>
      )}
    </div>
  )
}

// 各幕战斗背景
function combatBg(act: number): string {
  if (act >= 4) return 'combat4'
  if (act === 3) return 'combat3'
  if (act === 2) return 'combat2'
  return 'combat'
}

// ============ 牌堆按钮 ============
function PileButton({ label, count, style, onClick, small, shuffled }: {
  label: string; count: number; style: React.CSSProperties; onClick: () => void; small?: boolean; shuffled?: boolean
}) {
  const w = small ? 50 : 66
  return (
    <button className="absolute flex flex-col items-center gap-0.5" style={{ ...style, zIndex: 40 }} onClick={onClick}>
      <div
        className="rounded-lg"
        style={{
          width: w, height: w * 1.4,
          background: 'linear-gradient(160deg, #5a2820 0%, #2e120c 100%)',
          border: '2px solid #7a5030',
          boxShadow: '0 4px 10px rgba(0,0,0,0.6), inset 0 0 12px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span className="sts-num font-black" style={{ fontSize: 22, color: '#f5e5c8', textShadow: '1px 1px 0 #000' }}>{count}</span>
      </div>
      <span className="sts-body" style={{ fontSize: 13, color: '#c8b090', textShadow: '1px 1px 0 #000' }}>{label}</span>
    </button>
  )
}
