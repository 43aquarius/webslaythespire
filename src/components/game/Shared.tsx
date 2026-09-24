'use client'
// ============ 战斗共享小组件 ============
import { ReactNode, useEffect, useRef, useState } from 'react'
import { StatusMap } from '@/game/types'
import { RELICS } from '@/game/relics'
import { POTIONS } from '@/game/potions'
import { useGame } from '@/store/gameStore'

const A = '/assets'

// ============ 状态图标映射（修复缺失素材） ============
const STATUS_IMG_FIX: Record<string, string> = {
  angry: 'anger',            // 素材库文件名为 anger.png
  metallicizeE: 'metallicize', // 敌人金属化复用 metallicize 图标
  asleep: '../intent/sleep',   // 沉睡复用意图 Zzz 图标
  wraithFormS: 'intangible',
  phantasmal: 'wrath',
  blasphemyD: 'divinity',
  vaultS: 'divinity',
  alphaS: 'divotion_placeholder',
  betaActive: 'divotion_placeholder',
  omegaActive: 'wrath',
  foresight: 'divotion_placeholder',
  creativeAI: 'divotion_placeholder',
  machineLearning: 'divotion_placeholder',
  capacitor: 'divotion_placeholder',
  echoForm: 'echo',
  amplifyS: 'amplify',
  loopS: 'loop',
  staticDischargeS: 'staticDischarge',
  stormS: 'storm',
  accuracy: 'accuracy',
  afterImage: 'afterImage',
  aThousandCuts: 'aThousandCuts',
  caltropsS: 'caltrops',
  envenomS: 'envenom',
  equilibriumS: 'equilibrium',
  mentalFortressS: 'mentalFortress',
  likeWaterS: 'likeWater',
  nirvanaS: 'nirvana',
  devotionS: 'devotion',
  brillianceS: 'brilliance',
  corpseExplosionS: 'poison',
  beatOfDeath: 'beatOfDeath',
  entangled: 'shackle_placeholder',
}
const STATUS_IMG_MISSING = new Set(['divotion_placeholder', 'shackle_placeholder'])
export function statusImg(id: string): string {
  const fix = STATUS_IMG_FIX[id]
  if (fix) {
    if (STATUS_IMG_MISSING.has(fix)) return ''
    return `${A}/${fix.startsWith('../') ? fix.slice(3) : 'status/' + fix}.png`
  }
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
  // ---- 新角色/新怪物状态 ----
  poison: { name: '中毒', desc: '回合开始时受到等同于层数的伤害，然后层数 -1。' },
  focus: { name: '集中', desc: '增强充能球的被动与唤起效果。', buff: true },
  intangible: { name: '虚无形体', desc: '受到的任何伤害变为 1 点。', buff: true },
  lockOn: { name: '锁定', desc: '受到的闪电伤害提高 50%。' },
  mark: { name: '印记', desc: '每当你施加印记，敌人失去等同其印记层数的生命值。' },
  mantra: { name: '真言', desc: '累积 10 点真言时进入神格姿态。', buff: true },
  constricted: { name: '束缚', desc: '回合结束时受到等同层数的伤害。' },
  hex: { name: '咒术', desc: '每当你打出一张非攻击牌，受到 3 点伤害，然后层数 -1。' },
  flying: { name: '飞行', desc: '受到的攻击伤害降低 40%。', buff: true },
  time: { name: '时间', desc: '时间吞噬者：你每打出一张牌层数 +1，达到 8 层时获得力量并重置。' },
  beatOfDeath: { name: '死亡节拍', desc: '腐朽之心：你每打出一张牌，受到 2 点伤害。' },
  accuracy: { name: '精准', desc: '小刀造成的伤害提高 N 点。', buff: true },
  afterImage: { name: '残像', desc: '每当你打出一张牌，获得 N 点格挡。', buff: true },
  aThousandCuts: { name: '千刀万剐', desc: '每当你打出一张牌，对所有敌人造成 N 点伤害。', buff: true },
  caltropsS: { name: '蒺藜', desc: '每当你被攻击时，对攻击者造成 N 点伤害。', buff: true },
  envenomS: { name: '淬毒', desc: '攻击造成的未被格挡伤害施加 N 层中毒。', buff: true },
  echoForm: { name: '回声形态', desc: '每回合你打出的第一张牌将被打出两次。', buff: true },
  amplifyS: { name: '扩增', desc: '本回合你打出的下 N 张能力牌将被打出两次。', buff: true },
  loopS: { name: '循环', desc: '回合开始时，触发最右侧充能球的被动效果 N 次。', buff: true },
  staticDischargeS: { name: '静电释放', desc: '每当你受到攻击伤害，引导 N 个闪电球。', buff: true },
  stormS: { name: '风暴', desc: '每当你打出一张能力牌，引导 N 个闪电球。', buff: true },
  equilibriumS: { name: '平衡', desc: '本回合保留手牌。', buff: true },
  mentalFortressS: { name: '心灵壁垒', desc: '每当你切换姿态，获得 N 点格挡。', buff: true },
  likeWaterS: { name: '静如水', desc: '回合结束时若处于静相，获得 N 点格挡。', buff: true },
  nirvanaS: { name: '涅槃', desc: '每当你预见一张牌，获得 N 点格挡。', buff: true },
  devotionS: { name: '奉献', desc: '回合开始时获得 N 点真言。', buff: true },
  brillianceS: { name: '光辉', desc: '每当你获得真言，对随机敌人造成 N 点伤害。', buff: true },
  alphaS: { name: '阿尔法', desc: '回合开始时将一张贝塔加入手牌。', buff: true },
  betaActive: { name: '贝塔', desc: '回合开始时将一张欧米茄加入手牌。', buff: true },
  omegaActive: { name: '欧米茄', desc: '回合结束时对所有敌人造成 50 点伤害。', buff: true },
  foresight: { name: '先见之明', desc: '回合结束时预见 N 张牌。', buff: true },
  creativeAI: { name: '创造AI', desc: '回合开始时将一张随机能力牌加入手牌。', buff: true },
  machineLearning: { name: '机器学习', desc: '回合开始时多抽 N 张牌。', buff: true },
  capacitor: { name: '电容器', desc: '充能球上限提高 N 点。', buff: true },
  burstS: { name: '连发', desc: '本回合你打出的下 N 张技能牌将被打出两次。', buff: true },
  phantasmal: { name: '幻影杀手', desc: '下一张攻击牌造成的伤害翻倍。', buff: true },
  blasphemyD: { name: '亵渎', desc: '下回合开始时，你将死亡。' },
  vaultS: { name: '穹顶', desc: '跳过敌人的回合。', buff: true },
  rebirth: { name: '重生', desc: '首次死亡时复活至半血并获得力量。', buff: true },
  entangled: { name: '纠缠', desc: '本回合无法打出攻击牌。' },
  corpseExplosionS: { name: '尸体爆炸', desc: '该敌人死亡时，对所有敌人造成其最大生命值的伤害。', buff: true },
  wraithFormS: { name: '幽魂形态', desc: '回合结束时失去 1 点敏捷。', buff: true },
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
  if (!run) return null

  const onPotionClick = (idx: number) => {
    const pid = run.potions[idx]
    if (!pid) return
    if (!combat) { usePotionMap(idx); return }
    useGame.setState(s => ({ selectedPotionIdx: s.selectedPotionIdx === idx ? null : idx }))
  }

  const block = combat ? (run.combat?.player.block ?? 0) : 0

  return (
    <div className="absolute top-0 inset-x-0 z-40 sts-screen-fade select-none"
      style={{
        background: 'linear-gradient(180deg, rgba(8,5,3,0.88) 0%, rgba(8,5,3,0.62) 60%, transparent 100%)',
        padding: '10px 18px 26px',
      }}>
      <div className="flex items-start justify-between">
        {/* 左上：牌组按钮 + 血条 */}
        <div className="flex items-center gap-3">
          <Tip tip={<b>查看牌组（{run.deck.length} 张）</b>}>
            <button
              className="sts-btn flex flex-col items-center justify-center"
              style={{ width: 62, height: 62, padding: 2, borderRadius: 10 }}
              onClick={() => openPile('deck')}
            >
              <img src={`${A}/frames/cardRedOrb.png`} alt="" width={26} height={20} draggable={false}
                style={{ objectFit: 'contain' }} />
              <span className="sts-num font-bold" style={{ fontSize: 15, lineHeight: 1.1 }}>{run.deck.length}</span>
            </button>
          </Tip>
          <div className="flex flex-col gap-1.5">
            <HpBar hp={run.hp} maxHp={run.maxHp} block={block} width={300} />
            {floor !== undefined && (
              <div className="sts-body font-bold" style={{ color: '#c8b090', fontSize: 13, textShadow: '1px 1px 0 #000' }}>
                第 1 幕 · 第 {floor} 层
              </div>
            )}
          </div>
        </div>

        {/* 右上：金币 + 药水 + 遗物（避开右上角控制按钮） */}
        <div className="flex flex-col items-end gap-1.5" style={{ marginRight: 108 }}>
          <div className="flex items-center gap-3">
            <div className="sts-body font-bold sts-num flex items-center gap-1"
              style={{ color: '#ffd980', textShadow: '1px 1px 0 #000', fontSize: 18 }}>
              <span>💰</span>{run.gold}
            </div>
            <div className="flex gap-1.5">
              {run.potions.map((pid, i) => (
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
            {run.relics.map(id => <RelicIcon key={id} id={id} size={34} />)}
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
