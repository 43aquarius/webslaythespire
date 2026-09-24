'use client'
// ============ 战斗共享小组件 ============
import { ReactNode, useEffect, useRef, useState } from 'react'
import { StatusMap } from '@/game/types'
import { RELICS } from '@/game/relics'
import { POTIONS } from '@/game/potions'

const A = '/assets'

// ============ 状态图标映射（修复缺失素材） ============
const STATUS_IMG_FIX: Record<string, string> = {
  angry: 'anger',            // 素材库文件名为 anger.png
  metallicizeE: 'metallicize', // 敌人金属化复用 metallicize 图标
  asleep: '../intent/sleep',   // 沉睡复用意图 Zzz 图标
}
export function statusImg(id: string): string {
  const fix = STATUS_IMG_FIX[id]
  if (fix) return `${A}/${fix.startsWith('../') ? fix.slice(3) : 'status/' + fix}.png`
  return `${A}/status/${id}.png`
}

// ============ 状态名称映射 ============
export const STATUS_INFO: Record<string, { name: string; desc: string; buff?: boolean }> = {
  strength: { name: '力量', desc: '每点力量使攻击伤害 +1。', buff: true },
  dexterity: { name: '敏捷', desc: '每点敏捷使获得的格挡 +1。', buff: true },
  vulnerable: { name: '易伤', desc: '受到的攻击伤害 ×1.5。每回合结束 -1。' },
  weak: { name: '虚弱', desc: '造成的攻击伤害 ×0.75。每回合结束 -1。' },
  frail: { name: '脆弱', desc: '获得的格挡 ×0.75。每回合结束 -1。' },
  artifact: { name: '反制', desc: '下 N 次受到的负面效果被无效化。', buff: true },
  thorns: { name: '尖刺', desc: '被攻击时对攻击者造成 N 点伤害。', buff: true },
  metallicize: { name: '金属化', desc: '回合结束时获得 N 点格挡。', buff: true },
  regen: { name: '回复', desc: '回合开始时回复 N 点生命，然后 -1。', buff: true },
  ritual: { name: '仪式', desc: '回合开始时获得 N 点力量。', buff: true },
  demonForm: { name: '恶魔形态', desc: '回合开始时获得 N 点力量。', buff: true },
  barricade: { name: '壁垒', desc: '格挡不再在回合开始时消失。', buff: true },
  brutality: { name: '残暴', desc: '回合开始时失去 1 点生命并抽 1 张牌。', buff: true },
  corruption: { name: '堕落', desc: '技能牌费用为 0，打出后消耗。', buff: true },
  combust: { name: '燃烧', desc: '回合结束时失去 1 点生命，对所有敌人造成 N 点伤害。', buff: true },
  darkEmbrace: { name: '暗黑拥抱', desc: '每当有牌被消耗时抽 1 张牌。', buff: true },
  evolve: { name: '进化', desc: '抽到状态牌时额外抽 N 张牌。', buff: true },
  feelNoPain: { name: '无痛', desc: '每当有牌被消耗时获得 N 点格挡。', buff: true },
  fireBreathing: { name: '火焰吐息', desc: '抽到状态/诅咒牌时对所有敌人造成 N 点伤害。', buff: true },
  rupture: { name: '破裂', desc: '因打牌失去生命时获得 N 点力量。', buff: true },
  juggernaut: { name: '主宰', desc: '获得格挡时对随机敌人造成 N 点伤害。', buff: true },
  berserk: { name: '狂暴', desc: '回合开始时获得 1 点能量。', buff: true },
  rage: { name: '狂怒', desc: '本回合每打出一张攻击牌获得 N 点格挡。', buff: true },
  doubleTap: { name: '连击', desc: '接下来 N 张攻击牌被打出两次。', buff: true },
  noDraw: { name: '无法抽牌', desc: '本回合无法再抽牌。' },
  angry: { name: '激怒', desc: '你每打出一张技能牌，获得 N 点力量。' },
  asleep: { name: '沉睡', desc: '沉睡中，受到攻击会立即醒来。' },
  curlUp: { name: '蜷缩', desc: '首次受到攻击伤害时获得 N 点格挡。' },
  metallicizeE: { name: '金属化', desc: '回合结束时获得 N 点格挡。' },
  flameBarrier: { name: '火焰屏障', desc: '本回合被攻击时对攻击者造成 N 点伤害。', buff: true },
  modeShift: { name: '模式切换', desc: '守卫者的防御模式，格挡攒满后切换攻击模式。' },
}

// ============ 悬浮提示 ============
export function Tip({ children, tip, className = '' }: { children: ReactNode; tip: ReactNode; className?: string }) {
  const [show, setShow] = useState(false)
  return (
    <span
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
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
          }}
        >
          {tip}
        </span>
      )}
    </span>
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
                style={{ filter: id === 'vulnerable' || id === 'weak' || id === 'frail' || id === 'noDraw' ? 'drop-shadow(0 0 3px #c04030)' : 'drop-shadow(0 0 3px #30a0c0)' }} />
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
export function PotionSlot({ potionId, size = 40, onClick, onDiscard }: { potionId: string | null; size?: number; onClick?: () => void; onDiscard?: () => void }) {
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
      <span className="sts-slot relative inline-block cursor-pointer" onClick={onClick} style={{ width: size, height: size * 1.15 }}>
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
