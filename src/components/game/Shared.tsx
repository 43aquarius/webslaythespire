'use client'
// ============ 战斗共享小组件 ============
import { ReactNode, useEffect, useRef, useState } from 'react'
import { StatusMap } from '@/game/types'
import { RELICS } from '@/game/relics'
import { POTIONS } from '@/game/potions'
import { useGame } from '@/store/gameStore'
import { AP } from '@/game/engine'

import { STATUS_INFO, statusImgPath } from '@/game/statusInfo'
export { STATUS_INFO }
const A = '/assets'

export function statusImg(id: string): string {
  return statusImgPath(id, A)
}





// ============ 悬浮提示（支持触屏：轻点显示 2 秒） ============
export function Tip({ children, tip, className = '' }: { children: ReactNode; tip: ReactNode; className?: string }) {
  const [show, setShow] = useState(false)
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (touchTimer.current) clearTimeout(touchTimer.current) }, [])
  const onTouchStart = () => {
    setShow(true)
    if (touchTimer.current) clearTimeout(touchTimer.current)
    touchTimer.current = setTimeout(() => setShow(false), 2000)
  }
  return (
    <span
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onTouchStart={onTouchStart}
    >
      {children}
      {show && (
        <span
          className={`sts-body absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 rounded-lg z-[300] block w-max max-w-[260px] text-left ${className}`}
          style={{
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

// ============ 顶部 HUD（参照原版：左上 牌组+血条 / 右上 金币+药水+遗物） ============
export function TopHud({ combat = false, floor }: { combat?: boolean; floor?: number }) {
  const run = useGame(s => s.run)
  const openPile = useGame(s => s.openPile)
  const discardPotion = useGame(s => s.discardPotion)
  const usePotionMap = useGame(s => s.usePotionMap)
  const selectedPotionIdx = useGame(s => s.selectedPotionIdx)
  const net = useGame(s => s.net)
  if (!run) return null

  const mp = run.players.length > 1
  const myIdx = mp ? net.myIdx : 0
  const me = run.players[myIdx] || run.players[0]
  const activeBlock = combat && run.combat ? (AP(run.combat).block ?? 0) : 0
  const myBlock = combat && run.combat && run.combat.activeIdx === myIdx ? activeBlock : 0

  const onPotionClick = (idx: number) => {
    const pid = me.potions[idx]
    if (!pid) return
    if (!combat) { usePotionMap(idx); return }
    useGame.setState(s => ({ selectedPotionIdx: s.selectedPotionIdx === idx ? null : idx }))
  }

  return (
    <div className="absolute top-0 inset-x-0 z-40 sts-screen-fade select-none"
      style={{
        background: 'linear-gradient(180deg, rgba(8,5,3,0.88) 0%, rgba(8,5,3,0.62) 60%, transparent 100%)',
        padding: '10px 18px 26px',
      }}>
      <div className="flex items-start justify-between">
        {/* 左上：牌组按钮 + 血条（联机显示双人） */}
        <div className="flex items-center gap-3">
          <Tip tip={<b>查看牌组（{me.deck.length} 张）</b>}>
            <button
              className="sts-btn flex flex-col items-center justify-center"
              style={{ width: 62, height: 62, padding: 2, borderRadius: 10 }}
              onClick={() => openPile('deck')}
            >
              <img src={`${A}/frames/cardRedOrb.png`} alt="" width={26} height={20} draggable={false}
                style={{ objectFit: 'contain' }} />
              <span className="sts-num font-bold" style={{ fontSize: 15, lineHeight: 1.1 }}>{me.deck.length}</span>
            </button>
          </Tip>
          <div className="flex flex-col gap-1.5">
            <HpBar hp={me.hp} maxHp={me.maxHp} block={myBlock} width={mp ? 250 : 300} label={mp ? me.name : undefined} />
            {mp && run.players.map((rp, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="sts-body font-bold" style={{ fontSize: 11, color: i === myIdx ? '#8ee8ff' : '#c8a878', textShadow: '1px 1px 0 #000', minWidth: 34 }}>
                  {i === myIdx ? '你' : rp.name}
                </span>
                <HpBar hp={rp.hp} maxHp={rp.maxHp} width={182} />
              </div>
            ))}
            {floor !== undefined && (
              <div className="sts-body font-bold" style={{ color: '#c8b090', fontSize: 13, textShadow: '1px 1px 0 #000' }}>
                第 {run.act} 幕 · 第 {floor} 层{mp ? ' · 联机合作' : ''}
              </div>
            )}
          </div>
        </div>

        {/* 右上：金币 + 药水 + 遗物（避开右上角控制按钮） */}
        <div className="flex flex-col items-end gap-1.5" style={{ marginRight: 108 }}>
          <div className="flex items-center gap-3">
            <div className="sts-body font-bold sts-num flex items-center gap-1"
              style={{ color: '#ffd980', textShadow: '1px 1px 0 #000', fontSize: 18 }}>
              <span>💰</span>{me.gold}
            </div>
            {mp && (
              <div className="sts-body sts-num flex items-center gap-1" style={{ color: '#a8b8c8', textShadow: '1px 1px 0 #000', fontSize: 13 }}>
                队友 {run.players[1 - myIdx]?.gold ?? '-'}
              </div>
            )}
            <div className="flex gap-1.5">
              {me.potions.map((pid, i) => (
                <PotionSlot
                  key={i} potionId={pid} size={38}
                  selected={combat && selectedPotionIdx === i}
                  onClick={() => onPotionClick(i)}
                  onDiscard={combat ? () => discardPotion(i) : undefined}
                />
              ))}
            </div>
          </div>
          {/* 遗物行 */}
          <div className="flex gap-1 items-center flex-wrap justify-end" style={{ maxWidth: 560 }}>
            {me.relics.map(id => <RelicIcon key={id} id={id} size={34} />)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ 状态图标行 ============
export function StatusRow({ statuses, size = 30 }: { statuses: StatusMap; size?: number }) {
  const entries = Object.entries(statuses).filter(([_, v]) => v !== 0)
  if (!entries.length) return null
  return (
    <div className="flex flex-wrap gap-1 justify-center" style={{ maxWidth: 220 }}>
      {entries.map(([id, n]) => {
        const info = STATUS_INFO[id]
        return (
          <Tip
            key={id}
            tip={<><b style={{ color: info?.buff ? '#8fe89a' : '#ff9a8a' }}>{info?.name ?? id}</b><br />{info?.desc ?? ''}</>}
          >
            <span
              className="relative inline-block rounded"
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
export function HpBar({ hp, maxHp, block, width = 200, label }: { hp: number; maxHp: number; block?: number; width?: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, hp / maxHp * 100))
  return (
    <div className="relative" style={{ width }}>
      <div className="sts-hpbar-outer relative" style={{ height: 22 }}>
        <div className="sts-hpbar-fill" style={{ width: `${pct}%` }} />
        <div className="absolute inset-0 flex items-center justify-center sts-num sts-body font-bold"
          style={{ fontSize: 13, color: '#fff', textShadow: '1px 1px 0 #000' }}>
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
export function RelicIcon({ id, size = 42 }: { id: string; size?: number }) {
  const def = RELICS[id]
  if (!def) return null
  return (
    <Tip tip={<><b>{def.name}</b><br /><span style={{ color: '#d8c8a8' }}>{def.desc}</span></>}>
      <span className="sts-relic" style={{ width: size, height: size }}>
        <img src={`${A}/relics/${id}.png`} alt={def.name} className="w-[82%] h-[82%] object-contain" draggable={false} />
      </span>
    </Tip>
  )
}

// ============ 药水槽 ============
export function PotionSlot({ potionId, size = 40, onClick, onDiscard, selected }: { potionId: string | null; size?: number; onClick?: () => void; onDiscard?: () => void; selected?: boolean }) {
  const def = potionId ? POTIONS[potionId] : null
  if (!def) {
    return (
      <span
        className="sts-slot"
        style={{
          width: size, height: size * 1.15, borderRadius: '50% 50% 46% 46%',
          border: '2px dashed rgba(160,130,90,0.5)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
      />
    )
  }
  return (
    <Tip tip={<><b>{def.name}</b><br /><span style={{ color: '#d8c8a8' }}>{def.desc}</span></>}>
      <span
        className={`sts-slot relative inline-block cursor-pointer ${selected ? 'sts-targetable' : ''}`}
        onClick={onClick} style={{ width: size, height: size * 1.15, borderRadius: selected ? 8 : undefined }}>
        <img src={`${A}/potions/${potionId}.png`} alt={def.name} className="w-full h-full object-contain" draggable={false} />
        {onDiscard && (
          <span
            className="absolute sts-body font-bold"
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
