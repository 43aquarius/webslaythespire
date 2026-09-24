'use client'
// ============ 战斗界面 ============
import { useEffect, useRef, useState } from 'react'
import { useGame, FxItem } from '@/store/gameStore'
import { CardInstance, EnemyInstance } from '@/game/types'
import { CARDS, cardCost, cardDesc } from '@/game/cards'
import { ENEMIES } from '@/game/enemies'
import { enemyDisplayDamage } from '@/game/engine'
import { CardView } from './CardView'
import { StatusRow, HpBar, Tip, RelicIcon, PotionSlot, STATUS_INFO } from './Shared'

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
        {isAttack && <img src={icon} alt="" width={38} height={38} draggable={false} />}
        {isAttack && (
          <span className="sts-num sts-body font-black" style={{ fontSize: 24, color: '#ffdf9a', textShadow: '1px 1px 0 #000, 0 0 8px #300' }}>
            {dmg}
            {times > 1 && <span style={{ fontSize: 16 }}>x{times}</span>}
          </span>
        )}
        {!isAttack && <img src={icon} alt="" width={40} height={40} draggable={false} />}
        {(it.type === 'attackDebuff' || it.type === 'attackDefend') && (
          <img src={`${A}/intent/${it.type === 'attackDebuff' ? 'debuff' : 'defend'}.png`} alt="" width={26} height={26} draggable={false} />
        )}
        {targetable && <span className="sts-body text-xs font-bold" style={{ color: '#ff6a50' }}>点击目标</span>}
      </div>
    </Tip>
  )
}

// ============ 浮动数字 ============
function FloatFx({ items, removeFx }: { items: FxItem[]; removeFx: (id: number) => void }) {
  useEffect(() => {
    const timers = items.map(it => setTimeout(() => removeFx(it.id), 1150))
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
              <img src={`${A}/status/${it.text}.png`} alt="" width={26} height={26} />
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
              fontSize: it.kind === 'dmg' ? 34 : 22, color, whiteSpace: 'nowrap',
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
function EnemyView({ enemy, index, total }: { enemy: EnemyInstance; index: number; total: number }) {
  const run = useGame(s => s.run)
  const combat = useGame(s => s.run?.combat)
  const clickEnemy = useGame(s => s.clickEnemy)
  const selectedCard = useGame(s => s.selectedCardUid)
  const selectedPotion = useGame(s => s.selectedPotionIdx)
  const removeFx = useGame(s => s.removeFx)
  const fxList = useGame(s => s.fxList)
  const def = ENEMIES[enemy.id]

  // 受击闪烁：用最新伤害事件 id 作为 key，事件到来时重挂载重播动画
  const dmgEvents = fxList.filter(f => (f.kind === 'dmg' || f.kind === 'shake') && f.target === enemy.uid)
  const flashKey = dmgEvents.length > 0 ? dmgEvents[dmgEvents.length - 1].id : 0

  if (!combat || !run) return null
  const targetable = !!selectedCard || selectedPotion !== null
  const myFx = fxList.filter(f => f.target === enemy.uid)
  const spriteW = def.boss ? 300 : def.elite ? 240 : 190

  return (
    <div
      className={`relative flex flex-col items-center ${enemy.dying ? 'sts-dying' : ''} ${targetable ? 'sts-targetable' : ''}`}
      style={{ minWidth: spriteW * 0.8 }}
      onClick={() => targetable && clickEnemy(enemy.uid)}
    >
      {/* 意图 */}
      <div className="mb-1" style={{ height: 46 }}>
        <IntentView enemy={enemy} targetable={!!selectedCard || selectedPotion !== null} />
      </div>
      {/* 浮动特效 */}
      <div className="absolute" style={{ top: 90, left: '50%', marginLeft: -60, width: 120, height: 40, zIndex: 60 }}>
        <FloatFx items={myFx} removeFx={removeFx} />
      </div>
      {/* 精灵图 */}
      <div key={flashKey} className={flashKey > 0 ? 'sts-hit' : ''}>
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
      {/* 名字 + 血条 */}
      <div className="flex flex-col items-center gap-1" style={{ marginTop: -26 }}>
        <div className="sts-body font-bold" style={{ fontSize: 14, color: '#f5e5c8', textShadow: '1px 1px 0 #000' }}>
          {def.name}
        </div>
        <HpBar hp={enemy.hp} maxHp={enemy.maxHp} block={enemy.block} width={def.boss ? 260 : 160} />
        <StatusRow statuses={enemy.statuses} size={26} />
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
  const discardPotion = useGame(s => s.discardPotion)

  // 屏幕震动：用最新 shake 事件的 id 作为 key，事件到来时重挂载重播动画
  const shakeEvents = fxList.filter(f => f.kind === 'shake' && f.target === 'player')
  const shakeKey = shakeEvents.length > 0 ? shakeEvents[shakeEvents.length - 1].id : 0

  const playerFx = fxList.filter(f => f.target === 'player')
  const hand = combat?.hand ?? []

  // 手牌扇形布局（计算量小，直接计算）
  const handLayout = (() => {
    const n = hand.length
    return hand.map((_, i) => {
      const mid = (n - 1) / 2
      const offset = i - mid
      const spread = Math.min(62, 580 / Math.max(n, 1))
      const rot = n > 1 ? (offset / mid) * (n > 5 ? 13 : 8) : 0
      const ty = Math.abs(offset) * Math.min(7, 40 / Math.max(n, 1)) * 0.9
      return { x: offset * spread, rot, ty }
    })
  })()

  if (!run || !combat) return null
  const p = combat.player

  const onPotionClick = (idx: number) => {
    // 简化：需要目标的药水（单体敌人）在选择后点击敌人
    const pid = run.potions[idx]
    if (!pid) return
    useGame.setState(s => ({ selectedPotionIdx: s.selectedPotionIdx === idx ? null : idx }))
  }

  return (
    <div
      key={shakeKey}
      className={`${shakeKey > 0 ? 'sts-screen-shake' : ''} w-full h-full relative overflow-hidden select-none`}
      style={{
        backgroundImage: `url(${A}/bg/combat.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 30%',
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).dataset.bg === '1') cancelSelection()
      }}
      data-bg="1"
    >
      {/* ===== 左侧：玩家信息 ===== */}
      <div className="absolute left-3 bottom-32 flex flex-col items-center gap-1" style={{ zIndex: 40 }}>
        <div className="relative">
          <FloatFx items={playerFx} removeFx={removeFx} />
        </div>
        <img
          src={`${A}/hero/ironclad.png`}
          alt="铁甲战士"
          draggable={false}
          style={{ width: 200, height: 143, objectFit: 'contain', filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.5))' }}
        />
        <HpBar hp={run.hp} maxHp={run.maxHp} block={p.block} width={200} />
        <StatusRow statuses={p.statuses} size={28} />
        {/* 遗物 */}
        <div className="flex gap-1 mt-1 flex-wrap justify-center" style={{ maxWidth: 220 }}>
          {run.relics.map(id => <RelicIcon key={id} id={id} size={30} />)}
        </div>
      </div>

      {/* ===== 敌人区 ===== */}
      <div className="absolute inset-x-0 flex items-start justify-center gap-8" style={{ top: 70 }}>
        {combat.enemies.map((e, i) => (
          <EnemyView key={e.uid} enemy={e} index={i} total={combat.enemies.length} />
        ))}
      </div>

      {/* ===== 顶部遭遇名 ===== */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 sts-title"
        style={{ fontSize: 20, color: '#e8d5b0', textShadow: '2px 2px 0 #000' }}>
        {combat.encounterName}
      </div>

      {/* ===== 金币 ===== */}
      <div className="absolute top-2 right-3 sts-body font-bold sts-num flex items-center gap-1"
        style={{ color: '#ffd980', textShadow: '1px 1px 0 #000', fontSize: 16 }}>
        <span>💰</span>{run.gold}
      </div>

      {/* ===== 药水栏（右上） ===== */}
      <div className="absolute right-3 flex gap-1.5" style={{ top: 34 }}>
        {run.potions.map((pid, i) => (
          <PotionSlot
            key={i} potionId={pid}
            onClick={() => onPotionClick(i)}
            onDiscard={() => discardPotion(i)}
          />
        ))}
      </div>

      {/* ===== 选中提示 ===== */}
      {(selectedCardUid || selectedPotionIdx !== null) && (
        <div className="absolute left-1/2 -translate-x-1/2 sts-body font-bold"
          style={{ bottom: 320, color: '#ff9a80', fontSize: 15, textShadow: '1px 1px 0 #000', zIndex: 55 }}>
          {selectedPotionIdx !== null ? '选择药水目标（点击敌人）' : '选择目标（点击敌人，点击空白处取消）'}
        </div>
      )}

      {/* ===== 抽牌堆 ===== */}
      <PileButton
        label="抽牌堆" count={combat.drawPile.length} style={{ left: 14, bottom: 200 }}
        onClick={() => openPile('draw')} shuffled
      />
      {/* ===== 弃牌堆 ===== */}
      <PileButton
        label="弃牌堆" count={combat.discardPile.length} style={{ right: 14, bottom: 200 }}
        onClick={() => openPile('discard')}
      />
      {/* ===== 消耗堆 ===== */}
      {combat.exhaustPile.length > 0 && (
        <PileButton
          label="消耗堆" count={combat.exhaustPile.length} style={{ right: 14, bottom: 130 }}
          onClick={() => openPile('exhaust')} small
        />
      )}

      {/* ===== 能量球 ===== */}
      <div className="absolute sts-energy" style={{ left: 40, bottom: 118, width: 88, height: 88 }}>
        <img src={`${A}/frames/redEnergy.png`} alt="能量" className="w-full h-full object-contain" draggable={false} />
        <div className="absolute inset-0 flex items-center justify-center sts-num font-black"
          style={{ fontSize: 34, color: '#fff', textShadow: '2px 2px 0 #802000, 0 0 12px #ff5000' }}>
          {p.energy}
        </div>
      </div>

      {/* ===== 结束回合按钮 ===== */}
      <button
        className="sts-btn absolute sts-title"
        style={{
          right: 28, bottom: 118, fontSize: 22, padding: '12px 30px',
          opacity: combat.phase !== 'player' || busy ? 0.5 : 1,
        }}
        disabled={combat.phase !== 'player' || busy || combat.combatOver}
        onClick={endTurn}
      >
        {combat.phase === 'player' ? '结束回合' : '敌方回合…'}
      </button>

      {/* ===== 手牌 ===== */}
      <div className="absolute inset-x-0 flex justify-center items-end" style={{ bottom: -34, height: 300, zIndex: 45 }}>
        {hand.map((card, i) => {
          const layout = handLayout[i]
          const def = CARDS[card.id]
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
              }}
            >
              <div className="hand-inner transition-all duration-150"
                style={{ transform: isSelected ? 'translateY(-96px) scale(1.32)' : undefined }}>
                <CardView
                  card={card}
                  width={148}
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

      {/* 悬浮放大效果需要 CSS */}
      <style>{`
        .sts-hand-card .hand-inner { transition: transform .16s ease-out; }
        .sts-hand-card:hover .hand-inner { transform: translateY(-90px) scale(1.3) !important; }
      `}</style>

      {/* ===== 战斗结束横幅 ===== */}
      {endBanner && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 90, background: 'rgba(0,0,0,0.35)' }}>
          <div
            className="sts-title"
            style={{
              fontSize: 74,
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
  const w = small ? 46 : 62
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
        <span className="sts-num font-black" style={{ fontSize: 20, color: '#f5e5c8', textShadow: '1px 1px 0 #000' }}>{count}</span>
      </div>
      <span className="sts-body" style={{ fontSize: 12, color: '#c8b090', textShadow: '1px 1px 0 #000' }}>{label}</span>
    </button>
  )
}
