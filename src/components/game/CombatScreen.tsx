'use client'
// ============ 战斗界面（参照原版布局） ============
// 布局：左上 牌组+血条 / 右上 金币+药水+遗物（TopHud）
//       玩家左下、敌人中偏右、手牌底部扇形、能量球左下、结束回合右下
// 闪动修复：震动/受击动画改用 Web Animations API，不再重挂载 DOM
import { useEffect, useRef, useState } from 'react'
import { useGame, FxItem } from '@/store/gameStore'
import { EnemyInstance } from '@/game/types'
import { CARDS, cardCost } from '@/game/cards'
import { ENEMIES } from '@/game/enemies'
import { enemyDisplayDamage } from '@/game/engine'
import { CardView } from './CardView'
import { StatusRow, HpBar, Tip, TopHud, STATUS_INFO, statusImg } from './Shared'

const A = '/assets'

// ============ 意图图标 ============
function IntentView({ enemy, targetable }: { enemy: EnemyInstance; targetable: boolean }) {
  const combat = useGame(s => s.run?.combat)
  if (!combat || !enemy.intent || enemy.dying) return null
  const it = enemy.intent
  const { dmg, times } = enemyDisplayDamage(enemy, combat.player.statuses)
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
  // 按 id 追踪：只为新出现的特效设置定时器，避免列表更新重置旧计时
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

  // 受击闪白：Web Animations API 播放，不重挂载（修复闪动）
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

  if (!combat || !run) return null
  const targetable = !!selectedCard || selectedPotion !== null
  const myFx = fxList.filter(f => f.target === enemy.uid)
  const spriteW = def.boss ? 340 : def.elite ? 260 : 210

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
        <HpBar hp={enemy.hp} maxHp={enemy.maxHp} block={enemy.block} width={def.boss ? 280 : 170} />
        <StatusRow statuses={enemy.statuses} size={28} />
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

  // 屏幕震动：Web Animations API 播放，不重挂载整个画面（修复闪动）
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

  const playerFx = fxList.filter(f => f.target === 'player')
  const hand = combat?.hand ?? []

  // 触屏设备提示文案（触屏为两段式打出）
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => { setIsTouch(window.matchMedia('(hover: none)').matches) }, [])

  // 手牌扇形布局（计算量小，直接计算）
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

  return (
    <div
      ref={rootRef}
      className="w-full h-full relative overflow-hidden select-none sts-screen-fade"
      style={{
        backgroundImage: `url(${A}/bg/combat.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 30%',
      }}
      onClick={(e) => {
        // 点击非交互元素（背景/敌人区空白）时取消选牌
        const t = e.target as HTMLElement
        if (!t.closest('button, .sts-card, .sts-slot, .sts-relic, .sts-targetable')) cancelSelection()
      }}
    >
      {/* ===== 顶部 HUD（原版：左上牌组+血条，右上金币+药水+遗物） ===== */}
      <TopHud combat />

      {/* ===== 玩家（左下，原版：状态在角色上方） ===== */}
      <div className="absolute flex flex-col items-center gap-1.5" style={{ left: 44, bottom: 96, zIndex: 40 }}>
        <div className="relative" style={{ width: 240, height: 60 }}>
          <FloatFx items={playerFx} removeFx={removeFx} />
        </div>
        <StatusRow statuses={p.statuses} size={30} />
        <img
          src={`${A}/hero/ironclad.png`}
          alt="铁甲战士"
          draggable={false}
          style={{ width: 240, height: 171, objectFit: 'contain', filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.5))' }}
        />
      </div>

      {/* ===== 敌人区（中偏右，参照原版站位） ===== */}
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

      {/* ===== 抽牌堆（左下角） ===== */}
      <PileButton
        label="抽牌堆" count={combat.drawPile.length} style={{ left: 26, bottom: 158 }}
        onClick={() => openPile('draw')} shuffled
      />
      {/* ===== 弃牌堆（右下角） ===== */}
      <PileButton
        label="弃牌堆" count={combat.discardPile.length} style={{ right: 26, bottom: 158 }}
        onClick={() => openPile('discard')}
      />
      {/* ===== 消耗堆 ===== */}
      {combat.exhaustPile.length > 0 && (
        <PileButton
          label="消耗堆" count={combat.exhaustPile.length} style={{ right: 26, bottom: 88 }}
          onClick={() => openPile('exhaust')} small
        />
      )}

      {/* ===== 能量球（左下，手牌左侧） ===== */}
      <div className="absolute sts-energy" style={{ left: 118, bottom: 116, width: 104, height: 104, zIndex: 44 }}>
        <img src={`${A}/frames/redEnergy.png`} alt="能量" className="w-full h-full object-contain" draggable={false} />
        <div className="absolute inset-0 flex items-center justify-center sts-num font-black"
          style={{ fontSize: 40, color: '#fff', textShadow: '2px 2px 0 #802000, 0 0 12px #ff5000' }}>
          {p.energy}
        </div>
      </div>

      {/* ===== 结束回合按钮（右下，弃牌堆上方） ===== */}
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

      {/* ===== 手牌（容器不拦截点击，只有卡牌本身可点） ===== */}
      <div className="absolute inset-x-0 flex justify-center items-end" style={{ bottom: -40, height: 320, zIndex: 45, pointerEvents: 'none' }}>
        {hand.map((card, i) => {
          const layout = handLayout[i]
          const isPlayable = combat.phase === 'player' && !busy && !combat.combatOver
          const isSelected = selectedCardUid === card.uid
          const cost = cardCost(card, p.hpLostThisCombat)
          const enough = cost === -1 ? true : p.energy >= Math.max(0, cost)
          return (
            <div
              key={card.uid}
              className="sts-hand-card"
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
                  ctx={{ hpLost: p.hpLostThisCombat, rampageBonus: combat.rampage?.[card.uid] || 0 }}
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
