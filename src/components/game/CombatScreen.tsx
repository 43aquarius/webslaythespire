'use client'
// ============ 战斗界面（参照原版布局 + 动画系统） ============
// 布局：左上 牌组+血条 / 右上 金币+药水+遗物（TopHud）
//       玩家左下、敌人中偏右、手牌底部扇形、能量球左下、结束回合右下
// 动画：出牌飞入（cardPlay fx）、斩击特效（slash fx）、敌人突进（lunge fx）、
//       抽牌飞入（新卡 keyframe）、受击闪白/震动（Web Animations API）
// 新系统：故障机器人宝球、观者姿态
import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { useGame, FxItem } from '@/store/gameStore'
import { EnemyInstance, CardInstance, RunPlayer, PlayerCombatState } from '@/game/types'
import { CARDS, cardCost } from '@/game/cards'
import { ENEMIES } from '@/game/enemies'
import { enemyDisplayDamage, AP } from '@/game/engine'
import { CardView } from './CardView'
import { StatusRow, HpBar, Tip, TopHud, STATUS_INFO, statusImg } from './Shared'
import { ScryOverlay } from './Overlays'
import { sfx } from '@/game/sfx'

const A = '/assets'

// ============ 屏幕震动引擎（移植 sts2-web NScreenShake punch 模型） ============
// punch：位移 = cos(t·60rad/s)·幅度·cubicOut(剩余/总时长)，沿随机方向；
// 强度分档对齐原版 STRENGTH 表（1920 设计像素 → 1600 舞台 ×0.833）：
// 极弱 1.7 / 弱 4.2 / 中 16.7 / 强 33.3 / 极强 66.7
// 震动只作用于 .sts-shake-layer（背景+角色+敌人），HUD/手牌/顶栏不动 —— 原版 data-shake 规则
const cubicOut = (p: number) => (p - 1) ** 3 + 1
let shakePunch: { a: number; t: number; r: number; dx: number; dy: number } | null = null
let shakeRunning = false
function shakeFrame(dt: number) {
  const p = shakePunch
  if (!p) return
  p.r -= dt
  const els = document.querySelectorAll<HTMLElement>('.sts-shake-layer')
  if (p.r <= 0) {
    shakePunch = null
    els.forEach(el => { el.style.translate = '' })
    return
  }
  const c = Math.cos(p.r * 60) * p.a * cubicOut(p.r / p.t)
  els.forEach(el => { el.style.translate = `${(c * p.dx).toFixed(2)}px ${(c * p.dy).toFixed(2)}px` })
}
function startShakeLoop() {
  if (shakeRunning) return
  shakeRunning = true
  let last = performance.now()
  const step = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    shakeFrame(dt)
    if (shakePunch) requestAnimationFrame(step)
    else {
      shakeRunning = false
      document.querySelectorAll<HTMLElement>('.sts-shake-layer').forEach(el => { el.style.translate = '' })
    }
  }
  requestAnimationFrame(step)
}
/** 原版 NGame.ScreenShake(strength, duration)：新 punch 取代进行中的一个；角度 <0 随机 */
export function screenPunch(px: number, duration = 0.3, deg = -1) {
  if (!px) return
  const rad = ((deg < 0 ? Math.random() * 360 : deg) * Math.PI) / 180
  shakePunch = { a: px, t: duration, r: duration, dx: Math.cos(rad), dy: Math.sin(rad) }
  startShakeLoop()
}
/** 受伤红晕（原版 PlayerHurtVignetteHelper.Play：重播即重置计时） */
function playHurtVignette() {
  const el = document.querySelector<HTMLElement>('.sts-hurt-vignette')
  if (!el) return
  el.classList.remove('sts-vignette-play')
  void el.offsetWidth
  el.classList.add('sts-vignette-play')
}

// ============ 意图图标 ============
function IntentView({ enemy, targetable }: { enemy: EnemyInstance; targetable: boolean }) {
  const combat = useGame(s => s.run?.combat)
  const net = useGame(s => s.net)
  if (!combat || !enemy.intent || enemy.dying) return null
  const it = enemy.intent
  // 联机：以意图目标玩家的状态计算伤害显示
  const tgtIdx = combat.players.length > 1 ? (it.targetIdx ?? 0) : 0
  const TP = combat.players[tgtIdx] || AP(combat)
  const { dmg, times } = enemyDisplayDamage(enemy, TP.statuses, TP.stance)
  const map: Record<string, string> = {
    attack: 'attack3', attackDebuff: 'attack5', attackDefend: 'attack4',
    defend: 'defend', buff: 'buff', debuff: 'debuff', strongDebuff: 'debuffStrong',
    sleep: 'sleep', unknown: 'unknown',
  }
  const icon = `${A}/intent/${map[it.type] || 'unknown'}.png`
  const isAttack = it.type.startsWith('attack')
  const mvName = ENEMIES[enemy.id]?.moves[enemy.nextMoveIdx]?.name || ''
  const tgtLabel = combat.players.length > 1 ? (tgtIdx === net.myIdx ? '▶你' : '▶队友') : ''

  return (
    <Tip tip={<b>{mvName}</b>}>
      <div className="sts-intent sts-intent-bob flex items-center gap-1"
        style={{ filter: 'drop-shadow(0 2px 4px #000)', animationDelay: `${((enemy.uid.charCodeAt(enemy.uid.length - 1) || 0) % 7) * 0.33}s` }}>
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
        {isAttack && tgtLabel && (
          <span className="sts-body font-bold" style={{ fontSize: 13, color: tgtIdx === net.myIdx ? '#ff6a50' : '#6ab0ff', textShadow: '1px 1px 0 #000' }}>
            {tgtLabel}
          </span>
        )}
        {targetable && <span className="sts-body text-xs font-bold" style={{ color: '#ff6a50' }}>点击目标</span>}
      </div>
    </Tip>
  )
}

// ============ 意图执行爆发（原版 NIntent.PlayPerform） ============
// 四份叠加意图图标副本（α 0.27），各延迟 0.25s，1s 内从 0.5 → 1.49 放大淡出
function IntentBurst({ items, removeFx }: { items: FxItem[]; removeFx: (id: number) => void }) {
  const timedRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = []
    for (const it of items) {
      if (timedRef.current.has(it.id)) continue
      timedRef.current.add(it.id)
      timers.push(setTimeout(() => removeFx(it.id), 1900))
    }
    return () => timers.forEach(clearTimeout)
  }, [items, removeFx])
  if (!items.length) return null
  const map: Record<string, string> = {
    attack: 'attack3', attackDebuff: 'attack5', attackDefend: 'attack4',
    defend: 'defend', buff: 'buff', debuff: 'debuff', strongDebuff: 'debuffStrong',
    sleep: 'sleep', unknown: 'unknown',
  }
  return (
    <>
      {items.map(it => (
        <div key={it.id} className="absolute inset-0 flex items-start justify-center pointer-events-none" style={{ zIndex: 56 }}>
          {[0, 1, 2, 3].map(k => (
            <div key={k} className="sts-intent-burst absolute" style={{ top: 4, left: '50%', animationDelay: `${k * 0.25}s` }}>
              <img src={`${A}/intent/${map[it.text || ''] || 'unknown'}.png`} alt="" width={44} height={44} draggable={false} />
            </div>
          ))}
        </div>
      ))}
    </>
  )
}

// ============ 洗牌黑色剪影（原版 NCardFlyShuffleVfx：弃牌堆洗回抽牌堆时黑色卡牌剪影飞散） ============
// 8 张黑色小卡剪影自抽牌堆按钮位置向外弧线飞散 + 随机旋转 + 淡出，0.75s，错峰 0.05s
function ShuffleFx({ items, removeFx }: { items: FxItem[]; removeFx: (id: number) => void }) {
  const timedRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = []
    for (const it of items) {
      if (timedRef.current.has(it.id)) continue
      timedRef.current.add(it.id)
      timers.push(setTimeout(() => removeFx(it.id), 1300))
    }
    return () => timers.forEach(clearTimeout)
  }, [items, removeFx])
  if (!items.length) return null
  return (
    <>
      {items.map(it => (
        <div key={it.id} className="absolute pointer-events-none" style={{ left: 59, bottom: 204, zIndex: 57 }}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map(k => (
            <div key={k} className="sts-shuffle-card absolute" style={{ animationDelay: `${k * 0.05}s` }} />
          ))}
        </div>
      ))}
    </>
  )
}

// ============ 浮动数字（原版 NDamageNumVfx / NHealNumVfx 物理还原） ============
// 伤害数字：红 #F72B14 → 奶油 #FFF6E2（0.5s）、2.5×→1× 缩放（1.2s QuadOut）、
//   重力 1000px/s² 抛物弧线、初速 vy=-(700±100) vx=±100、随机旋转 ±5°、透明度 1-(t/2)²、共 2s
// 治疗/格挡：绿色/蓝色，2000px/s² 减速上浮、2.5×→1×（0.5s）、1s 后快速淡出、共 1.3s
// 状态/文字：温和上浮 36px 渐隐 1.3s
type FloatRoll = { rot: number; sc: number; vx: number; vy: number }
const floatRolls = new Map<number, FloatRoll>()
function rollFor(it: FxItem): FloatRoll {
  let r = floatRolls.get(it.id)
  if (!r) {
    const kind0 = it.kind
    r = kind0 === 'dmg'
      ? { rot: (Math.random() * 2 - 1) * 5, sc: 1.2 + Math.random() * 0.1, vx: (Math.random() * 2 - 1) * 100, vy: -(700 + Math.random() * 100) }
      : kind0 === 'heal' || kind0 === 'block'
        ? { rot: (Math.random() * 2 - 1) * 3, sc: 1.15 + Math.random() * 0.08, vx: (Math.random() * 2 - 1) * 60, vy: -(300 + Math.random() * 300) }
        : { rot: (Math.random() * 2 - 1) * 2, sc: 1, vx: (Math.random() * 2 - 1) * 30, vy: -120 }
    floatRolls.set(it.id, r)
  }
  return r
}
function playFloatAnim(el: HTMLDivElement, it: FxItem) {
  const inner = el.firstElementChild as HTMLElement | null
  if (!inner) return
  if (it.kind === 'dmg') {
    const { vx, vy } = rollFor(it)
    const frames: Keyframe[] = []
    for (let i = 0; i <= 20; i++) {
      const t = (i / 20) * 2
      const x = vx * t, y = vy * t + 1000 * t * t
      const sc = t < 1.2 ? 2.5 - 1.5 * (1 - (1 - t / 1.2) ** 2) : 1
      const op = 1 - (t / 2) ** 2
      frames.push({ offset: i / 20, transform: `translate(calc(-50% + ${x}px), ${y}px) scale(${sc})`, opacity: Math.max(0, op) })
    }
    el.animate(frames, { duration: 2000, easing: 'linear', fill: 'forwards' })
    inner.animate([{ color: 'rgb(247,43,20)' }, { color: '#FFF6E2' }], { duration: 500, easing: 'cubic-bezier(.33,1,.68,1)', fill: 'forwards' })
  } else if (it.kind === 'heal' || it.kind === 'block') {
    const { vx, vy } = rollFor(it)
    const frames: Keyframe[] = []
    for (let i = 0; i <= 20; i++) {
      const t = (i / 20) * 1.3
      const sp = Math.hypot(vx, vy), stop = sp / 2000, tt = Math.min(t, stop)
      const d = sp * tt - 1000 * tt * tt
      const x = (vx / sp) * d, y = (vy / sp) * d
      const sc = t < 0.5 ? 2.2 - 1.2 * (1 - (1 - t / 0.5) ** 2) : 1
      const op = t < 1 ? 1 : Math.max(0, 1 - ((t - 1) / 0.3) ** 2)
      frames.push({ offset: i / 20, transform: `translate(calc(-50% + ${x}px), ${y}px) scale(${sc})`, opacity: Math.max(0, op) })
    }
    el.animate(frames, { duration: 1300, easing: 'linear', fill: 'forwards' })
  } else {
    el.animate(
      [
        { transform: 'translate(-50%, 6px) scale(.9)', opacity: 0 },
        { transform: 'translate(-50%, -14px) scale(1)', opacity: 1, offset: 0.25 },
        { transform: 'translate(-50%, -46px) scale(1)', opacity: 0 },
      ],
      { duration: 1300, easing: 'cubic-bezier(.25,.6,.4,1)', fill: 'forwards' }
    )
  }
}
function FloatFx({ items, removeFx }: { items: FxItem[]; removeFx: (id: number) => void }) {
  const timedRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = []
    for (const it of items) {
      if (timedRef.current.has(it.id)) continue
      timedRef.current.add(it.id)
      const ms = it.kind === 'dmg' ? 2000 : 1300
      timers.push(setTimeout(() => { floatRolls.delete(it.id); removeFx(it.id) }, ms))
    }
    return () => timers.forEach(clearTimeout)
  }, [items, removeFx])
  if (!items.length) return null
  return (
    <>
      {items.map((it, i) => {
        let content: React.ReactNode = null
        let color = '#fff'
        let fontSize = 24
        if (it.kind === 'dmg') { content = it.value; color = '#F72B14'; fontSize = 40 }
        else if (it.kind === 'heal') { content = `+${it.value}`; color = 'rgb(35,247,20)'; fontSize = 30 }
        else if (it.kind === 'block') { content = `+${it.value}`; color = '#9ac8f0'; fontSize = 26 }
        else if (it.kind === 'status') {
          const info = STATUS_INFO[it.text || '']
          content = (
            <span className="flex items-center gap-1">
              <img src={statusImg(it.text || '')} alt="" width={28} height={28} />
              <span style={{ color: (it.value || 0) > 0 ? '#7fe08a' : '#ff8a7a' }}>{(it.value || 0) > 0 ? '+' : ''}{it.value}</span>
            </span>
          )
        } else if (it.kind === 'text' || it.kind === 'buff') { content = it.text; color = '#ffe9a0'; fontSize = 20 }
        else return null
        const roll = rollFor(it)
        return (
          <div
            key={it.id}
            className="sts-float absolute sts-num font-black sts-body"
            ref={el => { if (el && !el.dataset.go) { el.dataset.go = '1'; playFloatAnim(el, it) } }}
            style={{
              left: '50%', top: -14 - i * 6,
              fontSize, color, whiteSpace: 'nowrap', zIndex: 60,
              textShadow: it.kind === 'dmg' ? '2px 2px 0 #4a0a04, 0 0 10px rgba(0,0,0,.6)' : '1px 1px 0 #000',
            }}
          >
            <div style={{ transform: `rotate(${roll.rot}deg) scale(${roll.sc})` }}>{content}</div>
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
function EnemyView({ enemy, idx }: { enemy: EnemyInstance; idx: number }) {
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

  // 格挡获得蓝色光环（原版动画还原）
  const lastBlockRef = useRef(enemy.block)
  // 格挡破碎：block 从 >0 变 0 时，盾牌左右两半分离飞散（原版 NBlockBrokenVfx：分离0.4s+淡出0.6s）
  const [blockBreaks, setBlockBreaks] = useState<number[]>([])
  useEffect(() => {
    if (enemy.block > lastBlockRef.current && spriteRef.current) {
      spriteRef.current.animate(
        [
          { filter: 'drop-shadow(0 0 0 rgba(120,190,255,0))' },
          { filter: 'drop-shadow(0 0 18px rgba(120,190,255,0.95))' },
          { filter: 'drop-shadow(0 0 0 rgba(120,190,255,0))' },
        ],
        { duration: 550, easing: 'ease-out' }
      )
    } else if (lastBlockRef.current > 0 && enemy.block === 0 && !enemy.dying) {
      const at = Date.now()
      setBlockBreaks(bs => [...bs, at])
      setTimeout(() => setBlockBreaks(bs => bs.filter(x => x !== at)), 1000)
    }
    lastBlockRef.current = enemy.block
  }, [enemy.block])

  if (!combat || !run) return null
  // 选牌/选药水时的红框提示只对存活敌人生效（死亡怪不再出现红框，避免视觉干扰）
  const alive = !enemy.dying && enemy.hp > 0
  const targetable = alive && (!!selectedCard || selectedPotion !== null)
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
      <div className="mb-1 relative" style={{ height: 50 }}>
        <IntentView enemy={enemy} targetable={targetable} />
        {/* 意图执行爆发（原版 NIntent.PlayPerform：四份叠加副本 α0.27，各 0.25s 间隔，1s 内 0.5→1.49） */}
        <IntentBurst items={fxList.filter(f => f.kind === 'intentBurst' && f.target === enemy.uid)} removeFx={removeFx} />
      </div>
      {/* 浮动特效 */}
      <div className="absolute" style={{ top: 100, left: '50%', marginLeft: -60, width: 120, height: 40, zIndex: 60 }}>
        <FloatFx items={myFx} removeFx={removeFx} />
      </div>
      {/* 斩击特效 */}
      <SlashFx items={mySlashes} removeFx={removeFx} big={def.boss} />
      {/* 精灵图（待机浮动 + 受击闪白） */}
      <div ref={spriteRef}>
        <img
          src={`${A}/enemies/${def.sprite}.png`}
          alt={def.name}
          draggable={false}
          className="sts-idle-bob"
          style={{
            width: spriteW, height: spriteW,
            objectFit: 'contain',
            filter: 'drop-shadow(0 10px 12px rgba(0,0,0,0.55))',
            animationDelay: `${(idx % 5) * 0.45}s`,
          }}
        />
      </div>
      {/* 名字 + 血条 + 状态（战斗开始自上方 20px 滑入，每敌随机延迟 1.3-1.7s，原版 NCreatureStateDisplay；中途召唤的敌人立即滑入） */}
      <div className="flex flex-col items-center gap-1 relative"
        ref={el => {
          if (el && !el.dataset.stated) {
            el.dataset.stated = '1'
            const fresh = combat.turn <= 1 && combat.phase === 'player'
            const delay = fresh ? 1.3 + ((idx * 37 + (enemy.uid.charCodeAt(enemy.uid.length - 1) || 0)) % 41) / 100 : 0
            el.style.animation = `sts-state-in .5s cubic-bezier(.2,.8,.3,1) ${delay}s backwards`
          }
        }}
        style={{ marginTop: -28 }}>
        <div className="sts-body font-bold" style={{ fontSize: 15, color: '#f5e5c8', textShadow: '1px 1px 0 #000' }}>
          {def.name}
        </div>
        <div className="relative">
          <HpBar hp={enemy.hp} maxHp={enemy.maxHp} block={enemy.block} width={def.boss ? 280 : def.small ? 120 : 170} poisonNext={(enemy.statuses as any)?.poison || 0} />
          {/* 格挡破碎：盾牌左右两半飞散（0.4s 分离 + 0.6s 淡出） */}
          {blockBreaks.map(at => (
            <div key={at} className="absolute pointer-events-none" style={{ left: -26, top: -2, width: 26, height: 26, zIndex: 52 }}>
              <img src={`${A}/status/block.png`} alt="" className="sts-bb-left" draggable={false}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
              <img src={`${A}/status/block.png`} alt="" className="sts-bb-right" draggable={false}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          ))}
        </div>
        <StatusRow statuses={enemy.statuses} size={28} />
      </div>
    </div>
  )
}

// ============ 药水投掷特效（飞向目标后碎裂） ============
function PotionThrowFx({ show }: { show: number }) {
  if (!show) return null
  return (
    <div key={show}>
      <div
        className="absolute sts-potion-throw"
        style={{ left: 420, top: 120, zIndex: 75, '--ptx': '480px', '--pty': '220px' } as React.CSSProperties}
      >
        <span style={{ fontSize: 34, filter: 'drop-shadow(0 0 8px rgba(140,255,160,0.85))' }}>🧪</span>
      </div>
      <div
        className="absolute"
        style={{ left: 905, top: 345, zIndex: 75, opacity: 0, animation: 'sts-potion-shatter .45s .5s ease-out forwards' }}
      >
        <span style={{ fontSize: 46, filter: 'drop-shadow(0 0 16px rgba(140,255,160,0.9))' }}>💫</span>
      </div>
    </div>
  )
}

// ============ 回合横幅（原版参数还原：player_turn_banner / enemy_turn_banner） ============
// 玩家回合：主文字自下方上浮 50px（1s ExpoOut）+「回合 N」天蓝 #87ceeb 自上方下落 50px（1.5s），
//           停留 0.4s 后整体 0.3s 淡出
// 敌方回合：2× 缩入至 1×（0.75s ExpoOut）+ 1.3s 淡入，随后金色 #efc851 → 红 #ff5555 渐变 1s 并淡出
function TurnBanner({ phase, turn }: { phase: string; turn: number }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const turnRef = useRef<HTMLDivElement>(null)
  const [kind, setKind] = useState<'' | 'player' | 'enemy'>('')
  const prev = useRef({ phase: '' })
  useEffect(() => {
    const pv = prev.current
    const toPlayer = phase === 'player' && pv.phase && pv.phase !== 'player'
    const toEnemy = phase === 'enemy' && pv.phase && pv.phase !== 'enemy'
    prev.current = { phase }
    if (!toPlayer && !toEnemy) return
    // 原版音效：敌方回合/玩家回合切换
    sfx.play(toEnemy ? 'enemyTurn' : 'turnEffect')
    setKind(toPlayer ? 'player' : 'enemy')
  }, [phase, turn])
  // kind 变化后 DOM 已挂载，此时再启动动画
  useEffect(() => {
    if (!kind) return
    const root = rootRef.current, label = labelRef.current, tn = turnRef.current
    if (!root || !label) return
    const EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)'
    // 取消残留动画（敌方横幅 fill:forwards 的金→红动画会在 DOM 复用后继续覆盖行内色）
    root.getAnimations().forEach(a => a.cancel())
    label.getAnimations().forEach(a => a.cancel())
    if (tn) tn.getAnimations().forEach(a => a.cancel())
    if (kind === 'player' && tn) {
      tn.animate(
        [{ transform: 'translateY(-50px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
        { duration: 1500, easing: EXPO, fill: 'forwards' }
      )
      label.animate(
        [{ transform: 'translateY(50px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
        { duration: 1000, easing: EXPO, fill: 'forwards' }
      )
      const fade = root.animate(
        [{ opacity: 0 }, { opacity: 1, offset: 0.45 }, { opacity: 1, offset: 0.87 }, { opacity: 0 }],
        { duration: 2200, easing: 'ease-out', fill: 'forwards' }
      )
      fade.finished.then(() => setKind('')).catch(() => {})
    } else if (kind === 'enemy') {
      label.animate(
        [{ transform: 'scale(2)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
        { duration: 1300, easing: EXPO, fill: 'forwards' }
      )
      // 金 → 红渐变（后半段）
      label.animate(
        [{ color: '#efc851', offset: 0 }, { color: '#efc851', offset: 0.565 }, { color: '#ff5555', offset: 1 }],
        { duration: 2300, easing: 'ease-out', fill: 'forwards' }
      )
      const fade = root.animate(
        [{ opacity: 0 }, { opacity: 1, offset: 0.45 }, { opacity: 1, offset: 0.57 }, { opacity: 0 }],
        { duration: 2300, easing: 'ease-out', fill: 'forwards' }
      )
      fade.finished.then(() => setKind('')).catch(() => {})
    }
  }, [kind])
  if (!kind) return null
  return (
    <div ref={rootRef} className="sts-turn-banner-root absolute inset-x-0 flex flex-col items-center gap-1" style={{ top: '34%', zIndex: 85, pointerEvents: 'none', opacity: 0 }}>
      {kind === 'player' ? (
        <>
          <div ref={turnRef} className="tb-turn sts-title" style={{ fontSize: 26, color: '#87ceeb', textShadow: '2px 2px 0 #000', letterSpacing: 4, opacity: 0 }}>
            回合 {Math.max(1, turn)}
          </div>
          <div ref={labelRef} className="tb-label sts-title" style={{ fontSize: 58, color: '#efc851', textShadow: '3px 3px 0 #000, 0 0 40px rgba(0,0,0,0.85)', letterSpacing: 8, opacity: 0 }}>
            你的回合
          </div>
        </>
      ) : (
        <div ref={labelRef} className="tb-label sts-title" style={{ fontSize: 58, color: '#efc851', textShadow: '3px 3px 0 #000, 0 0 40px rgba(0,0,0,0.85)', letterSpacing: 8, opacity: 0, transformOrigin: 'center' }}>
          敌方回合
        </div>
      )}
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

function OrbRow({ p }: { p?: PlayerCombatState }) {
  const combat = useGame(s => s.run?.combat)
  if (!combat) return null
  const P = p ?? AP(combat)
  if (!P.orbs) return null
  const orbs = P.orbs
  const slots = P.orbSlots ?? 3
  const count = Math.max(slots, orbs.length)
  if (count === 0) return null
  // 原版 ∩ 形拱弧排列（sts2-web TweenLayout 逆向）：前球在右（25°），末球在左（150°），
  // 半径随容量增长 lerp(78,104,(cap-3)/7)（1600 舞台缩放）
  const r = 78 + (104 - 78) * Math.min(Math.max((count - 3) / 7, 0), 1)
  const spread = 125
  const step = count > 1 ? spread / (count - 1) : 0
  const cx = 150, cy = 96
  const arcPos = (i: number) => {
    const a = ((25 + i * step) * Math.PI) / 180
    return { x: cx + Math.cos(a) * r, y: cy - Math.sin(a) * r }
  }
  return (
    <div className="orb-row relative" style={{ width: 240, height: 104, marginBottom: -8 }}>
      {Array.from({ length: count }).map((_, i) => {
        const orb = orbs[i]
        const { x, y } = arcPos(i)
        const wrapStyle: CSSProperties = {
          position: 'absolute', left: x - 17, top: y - 17, width: 34, height: 34,
        }
        if (!orb) {
          return <span key={i} style={{ ...wrapStyle, borderRadius: '50%', border: '2px dashed rgba(120,140,200,0.35)' }} />
        }
        const st = ORB_STYLE[orb.type]
        return (
          <div key={i} style={wrapStyle}>
            <Tip tip={<><b style={{ color: st.color }}>{ORB_NAME[orb.type]}</b><br />{ORB_DESC[orb.type]}</>}>
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
          </div>
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

function StanceBadge({ p }: { p?: PlayerCombatState }) {
  const combat = useGame(s => s.run?.combat)
  if (!combat) return null
  const P = p ?? AP(combat)
  const stance = P.stance || 'none'
  const mantra = P.mantra || 0
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

// 离手卡牌动画载体
interface GhostCard { key: number; card: CardInstance; x: number; ty: number; rot: number; kind: 'discard' | 'exhaust' }

// ============ 玩家英雄视图（联机双人并排） ============
function HeroView({ idx, player, pc, fxItems, mp }: {
  idx: number; player: RunPlayer; pc: PlayerCombatState
  fxItems: FxItem[]; mp: boolean
}) {
  const removeFx = useGame(s => s.removeFx)
  const net = useGame(s => s.net)
  const isMe = idx === net.myIdx
  const dead = player.hp <= 0 || player.dead
  return (
    <div className="relative flex flex-col items-center gap-1.5" style={{ width: mp ? 205 : 240 }}>
      <div className="relative" style={{ width: '100%', height: 56 }}>
        <FloatFx items={fxItems} removeFx={removeFx} />
      </div>
      {/* 宝球 / 姿态 */}
      {player.character === 'defect' && <OrbRow p={pc} />}
      {player.character === 'watcher' && <StanceBadge p={pc} />}
      <StatusRow statuses={pc.statuses} size={mp ? 26 : 30} />
      <div className="relative">
        <img
          src={`${A}/hero/${player.character}.png`}
          alt=""
          draggable={false}
          style={{
            width: mp ? 205 : 240, height: mp ? 146 : 171, objectFit: 'contain',
            filter: dead
              ? 'grayscale(1) brightness(0.5)'
              : player.hp <= player.maxHp * 0.3 ? 'brightness(0.85) drop-shadow(0 0 12px rgba(255,60,40,0.5))' : 'drop-shadow(0 8px 10px rgba(0,0,0,0.5))',
          }}
        />
        {dead && (
          <div className="absolute inset-0 flex items-center justify-center sts-title"
            style={{ color: '#ff5a4a', fontSize: 26, textShadow: '2px 2px 0 #000' }}>阵 亡</div>
        )}
      </div>
      {mp && (
        <div className="sts-body font-bold" style={{
          fontSize: 13, marginTop: -4, letterSpacing: 1,
          color: isMe ? '#8ee8ff' : '#c8a878', textShadow: '1px 1px 0 #000',
        }}>
          {player.name}{isMe ? '（你）' : ''}
        </div>
      )}
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
  const net = useGame(s => s.net)

  // 屏幕震动（punch 模型）+ 受伤红晕（联机：任一玩家掉血均触发）
  // 玩家受击按 hpLoss 分档（≥20强 33px / ≥10中 17px / ≥5弱 4px / 其他极弱 2px）；
  // 玩家命中敌人 = 极弱 2px（原版 NScratchVfx VeryWeak Short）
  const lastShakeRef = useRef(0)
  const shakeEvents = fxList.filter(f => f.kind === 'shake')
  const lastShake = shakeEvents.length > 0 ? shakeEvents[shakeEvents.length - 1] : null
  useEffect(() => {
    if (!lastShake || lastShake.id <= lastShakeRef.current) return
    lastShakeRef.current = lastShake.id
    const isPlayer = lastShake.target === 'player' || lastShake.target === 'p0' || lastShake.target === 'p1'
    const v = lastShake.value ?? 5
    const px = isPlayer
      ? (v >= 20 ? 33 : v >= 10 ? 17 : v >= 5 ? 8 : 4)
      : 2
    screenPunch(px, 0.3)
    if (isPlayer) playHurtVignette()
  }, [lastShake?.id])

  const playerFx = fxList.filter(f => (f.target === 'player' || f.target === 'p0' || f.target === 'p1') && f.kind !== 'cardPlay')
  const cardPlayFx = fxList.filter(f => f.kind === 'cardPlay')
  const hand = combat ? AP(combat).hand : []

  // 手牌 uid 集合（用于抽牌动画：新出现的卡播放飞入）
  const prevHandRef = useRef<Set<string>>(new Set())
  const handUids = useMemo(() => new Set(hand.map(c => c.uid)), [hand])
  const isNewCard = (uid: string) => !prevHandRef.current.has(uid)
  useEffect(() => {
    prevHandRef.current = handUids
  }, [handUids])

  // ===== 玩家攻击突进（打出攻击牌时冲向敌人，原版动画还原） =====
  const heroRef = useRef<HTMLDivElement>(null)
  const lastPlayIdRef = useRef(0)
  const lastPlayFx = cardPlayFx.length ? cardPlayFx[cardPlayFx.length - 1] : null
  useEffect(() => {
    if (!lastPlayFx || lastPlayFx.id <= lastPlayIdRef.current) return
    lastPlayIdRef.current = lastPlayFx.id
    const [cardId] = (lastPlayFx.text || '').split('|')
    if (CARDS[cardId]?.type === 'attack' && heroRef.current) {
      heroRef.current.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(150px) scale(1.05)' },
          { transform: 'translateX(0)' },
        ],
        { duration: 380, easing: 'cubic-bezier(.3,0,.4,1)' }
      )
    }
  }, [lastPlayFx?.id])

  // ===== 玩家格挡获得蓝色光环 =====
  const pBlock = combat ? (AP(combat).block ?? 0) : 0
  const lastPBlockRef = useRef(0)
  useEffect(() => {
    if (pBlock > lastPBlockRef.current && heroRef.current) {
      heroRef.current.animate(
        [
          { filter: 'drop-shadow(0 0 0 rgba(120,190,255,0))' },
          { filter: 'drop-shadow(0 0 20px rgba(120,190,255,0.95))' },
          { filter: 'drop-shadow(0 0 0 rgba(120,190,255,0))' },
        ],
        { duration: 550, easing: 'ease-out' }
      )
    }
    lastPBlockRef.current = pBlock
  }, [pBlock])

  // ===== 能量球：回能爆发闪光（原版 NEnergyCounter.OnEnergyChanged burst） =====
  const energyOrbRef = useRef<HTMLDivElement>(null)
  const pEnergy = combat ? AP(combat).energy : 0
  const prevEnergyRef = useRef(pEnergy)
  useEffect(() => {
    if (pEnergy > prevEnergyRef.current && energyOrbRef.current) {
      energyOrbRef.current.dataset.burst = String(Date.now())
      energyOrbRef.current.animate(
        [
          { transform: 'scale(1)', filter: 'brightness(1)' },
          { transform: 'scale(1.3)', filter: 'brightness(2.1)', offset: 0.3 },
          { transform: 'scale(1)', filter: 'brightness(1)' },
        ],
        { duration: 480, easing: 'ease-out' }
      )
    }
    prevEnergyRef.current = pEnergy
  }, [pEnergy])

  // ===== 药水投掷动画：战斗中使用药水时触发（监听药水栏变化） =====
  const potionSig = useGame(s => s.run && s.run.combat ? s.run.players.map(p => p.potions.join(',')).join('|') : '')
  const [potionThrow, setPotionThrow] = useState(0)
  const prevPotionSig = useRef(potionSig)
  useEffect(() => {
    if (combat && prevPotionSig.current && potionSig !== prevPotionSig.current) {
      setPotionThrow(Date.now())
    }
    prevPotionSig.current = potionSig
  }, [potionSig, combat])

  // 触屏设备提示文案
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => { setIsTouch(window.matchMedia('(hover: none)').matches) }, [])

  // 手牌扇形布局 —— 原版 HandPosHelper 查表数据（来自 sts2-web 逆向：
  // packages/app/src/cardnodes.ts POS/ANG 表，Mega Crit 官方数值）
  // 按 1600/1920 舞台比例缩放；y 换算为相对静止位置（卡底边=舞台底+40）的偏移
  const [hoverIdx, setHoverIdx] = useState(-1)
  const handLayout = (() => {
    const n = hand.length
    const POS: number[][] = [
      [0, -50],
      [-100, -50, 100, -50],
      [-180, -50, 0, -59, 180, -50],
      [-240, -25, -80, -50, 80, -50, 240, -25],
      [-340, 10, -170, -30, 0, -50, 170, -30, 340, 10],
      [-460, 13, -273, -25, -90, -50, 90, -50, 273, -25, 460, 13],
      [-534, 18, -365, -14, -189, -39, 0, -50, 189, -39, 365, -14, 534, 18],
      [-565, 28, -400, -14, -231, -39, -80, -50, 80, -50, 231, -39, 400, -14, 565, 28],
      [-600, 37, -445, -2, -300, -29, -150, -45, 0, -50, 150, -45, 300, -29, 445, -2, 600, 37],
      [-610, 38, -472, 5, -340, -21, -200, -41, -64, -50, 64, -50, 200, -41, 340, -21, 472, 5, 610, 38],
    ]
    const ANG: number[][] = [
      [0], [-2, 2], [-3, 0, 3], [-8, -4, 4, 8], [-8, -4, 0, 4, 8], [-9, -6, -3, 3, 6, 9], [-9, -6, -3, 0, 3, 6, 9],
      [-12, -9, -6, -3, 3, 6, 9, 12], [-12, -9, -6, -3, 0, 3, 6, 9, 12], [-15, -12, -9, -6, -3, 3, 6, 9, 12, 15],
    ]
    const row = Math.min(Math.max(n, 1), 10) - 1
    const K = 1600 / 1920   // 舞台比例
    const HALF_H = 117.5    // 手牌半高(235/2)
    const SINK = 40         // 静止位卡底边已在舞台底下方 40px
    return hand.map((_, i) => {
      const px = POS[row]
      let x = (px[i * 2] ?? 0) * K
      const yTab = (px[i * 2 + 1] ?? -50) * K
      // 卡中心高度(相对舞台底) → 卡底边高度 → 相对静止位的 ty
      const ty = yTab + HALF_H - SINK
      const rot = ANG[row][i] ?? 0
      // 悬停推开（原版：邻居卡向两侧让位，最多100px，4张距离衰减到0）
      if (hoverIdx >= 0 && hoverIdx !== i) {
        const dist = Math.abs(hoverIdx - i)
        if (dist <= 4) x -= Math.sign(hoverIdx - i) * (100 - 25 * (dist - 1)) * K
      }
      return { x, ty, rot }
    })
  })()

  // ===== 离手卡牌动画：弃牌飞向右下弃牌堆 / 消耗燃烧升腾 =====
  const [ghosts, setGhosts] = useState<GhostCard[]>([])
  const ghostPrevRef = useRef<{ uids: Map<string, { card: CardInstance; x: number; ty: number; rot: number }>; exhaust: number }>({ uids: new Map(), exhaust: 0 })
  useEffect(() => {
    const prev = ghostPrevRef.current
    const cur = new Map(hand.map((c, i) => [c.uid, { card: c, x: handLayout[i]?.x ?? 0, ty: handLayout[i]?.ty ?? 0, rot: handLayout[i]?.rot ?? 0 }]))
    const removed = [...prev.uids.entries()].filter(([uid]) => !cur.has(uid))
    // 刚打出的牌已有中央出牌特效，跳过
    const justPlayed = fxList.some(f => f.kind === 'cardPlay' && Date.now() - f.ts < 500)
    if (removed.length && !justPlayed) {
      const exhaustGrew = (combat ? AP(combat).exhaustPile.length : 0) > prev.exhaust
      const news: GhostCard[] = removed.map(([uid, info], i) => ({
        key: Date.now() + i, card: info.card, x: info.x, ty: info.ty, rot: info.rot,
        kind: exhaustGrew ? 'exhaust' : 'discard',
      }))
      setGhosts(gs => [...gs, ...news])
      const ids = new Set(news.map(g => g.key))
      setTimeout(() => setGhosts(gs => gs.filter(g => !ids.has(g.key))), 600)
    }
    ghostPrevRef.current = { uids: cur, exhaust: combat ? AP(combat).exhaustPile.length : 0 }
  }, [hand])

  if (!run || !combat) return null
  const p = AP(combat)
  const isDefect = run.character === 'defect'
  const isWatcher = run.character === 'watcher'
  const energyOrb = { ironclad: 'redEnergy', silent: 'greenEnergy', defect: 'blueEnergy', watcher: 'purpleEnergy' }[run.players[combat.activeIdx]?.character || run.character]
  const mp = run.players.length > 1
  const myTurn = !mp || (net.myIdx === combat.activeIdx)
  const waitingPeer = mp && combat.phase === 'player' && !myTurn && !combat.combatOver

  return (
    <div
      className="w-full h-full relative overflow-hidden select-none sts-screen-fade"
      onClick={(e) => {
        const t = e.target as HTMLElement
        if (!t.closest('button, .sts-card, .sts-slot, .sts-relic, .sts-targetable')) cancelSelection()
      }}
    >
      {/* ===== 震屏层：背景 + 角色 + 敌人（原版 data-shake 规则：HUD/手牌/顶栏不震） ===== */}
      <div className="sts-shake-layer absolute inset-0 overflow-hidden" style={{ pointerEvents: 'none' }}>
        {/* 背景（随震动一起移动） */}
        <div className="absolute inset-0" style={{
          backgroundImage: `url(${A}/bg/${combatBg(run.act)}.jpg)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 30%',
        }} />

      {/* ===== 玩家（左下；联机双人并排） ===== */}
      {mp ? (
        <div className="absolute flex items-end gap-2" style={{ left: 30, bottom: 92, zIndex: 40, pointerEvents: 'auto' }}>
          {run.players.map((rp, i) => {
            const pc = combat.players[i]
            const items = fxList.filter(f =>
              (f.target === `p${i}` || (i === 0 && f.target === 'player')) && f.kind !== 'cardPlay')
            const isActive = combat.activeIdx === i && !pc.dead
            return (
              <div key={i}
                style={{
                  filter: isActive ? 'none' : 'brightness(0.62)',
                  transition: 'filter .25s ease',
                  borderRadius: 14,
                  boxShadow: isActive ? '0 0 22px rgba(255,217,128,0.28)' : 'none',
                  padding: '4px 4px 0',
                }}
              >
                <HeroView idx={i} player={rp} pc={pc} fxItems={items} mp />
              </div>
            )
          })}
        </div>
      ) : (
        <div className="absolute flex flex-col items-center gap-1.5" style={{ left: 44, bottom: 96, zIndex: 40, pointerEvents: 'auto' }}>
          <div className="relative" style={{ width: 240, height: 60 }}>
            <FloatFx items={playerFx} removeFx={removeFx} />
          </div>
          {/* 宝球 / 姿态 */}
          {isDefect && <OrbRow />}
          {isWatcher && <StanceBadge />}
          <StatusRow statuses={p.statuses} size={30} />
          <div ref={heroRef}>
            <img
              src={`${A}/hero/${run.character}.png`}
              alt=""
              draggable={false}
              style={{ width: 240, height: 171, objectFit: 'contain', filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.5))' }}
            />
          </div>
        </div>
      )}

      {/* ===== 敌人区 ===== */}
      <div className="absolute flex items-start justify-center gap-10"
        style={{ left: '31%', right: 12, top: 118, bottom: 300, zIndex: 30, pointerEvents: 'auto' }}>
        {combat.enemies.map((e, i) => (
          <EnemyView key={e.uid} enemy={e} idx={i} />
        ))}
      </div>
      </div>{/* ===== 震屏层结束 ===== */}

      {/* ===== 顶部 HUD（不震） ===== */}
      <TopHud combat />

      {/* ===== 联机等待横幅（不震） ===== */}
      {waitingPeer && (
        <div className="absolute left-1/2 -translate-x-1/2 sts-title flex items-center gap-2"
          style={{ top: 66, zIndex: 70, fontSize: 20, color: '#ffe9a0', textShadow: '2px 2px 0 #000', letterSpacing: 3 }}>
          <span className="sts-wait-dot">●</span>
          等待 {run.players[combat.activeIdx]?.name || '队友'} 行动…
        </div>
      )}

      {/* ===== 受伤红晕（原版 PlayerHurtVignetteHelper，z 高于战斗层但不挡操作） ===== */}
      <div className="sts-hurt-vignette" />

      {/* ===== 选中提示（pointer-events:none —— 不挡下方敌人的点击） ===== */}
      {(selectedCardUid || selectedPotionIdx !== null) && (
        <div className="absolute left-1/2 -translate-x-1/2 sts-body font-bold"
          style={{ bottom: 350, color: '#ff9a80', fontSize: 16, textShadow: '1px 1px 0 #000', zIndex: 55, pointerEvents: 'none' }}>
          {selectedPotionIdx !== null
            ? '选择药水目标（点击敌人，点击空白处取消）'
            : isTouch
              ? '点击敌人打出 · 再点一次卡牌确认 · 点空白取消'
              : '选择目标（点击敌人，点击空白处取消）'}
        </div>
      )}

      {/* ===== 抽牌堆 ===== */}
      <PileButton label="抽牌堆" count={AP(combat).drawPile.length} style={{ left: 26, bottom: 158 }} onClick={() => openPile('draw')} shuffled />
      {/* 洗牌黑色剪影（原版 NCardFlyShuffleVfx） */}
      <ShuffleFx items={fxList.filter(f => f.kind === 'shuffle')} removeFx={removeFx} />
      {/* ===== 弃牌堆 ===== */}
      <PileButton label="弃牌堆" count={AP(combat).discardPile.length} style={{ right: 26, bottom: 158 }} onClick={() => openPile('discard')} />
      {/* ===== 消耗堆 ===== */}
      {AP(combat).exhaustPile.length > 0 && (
        <PileButton label="消耗堆" count={AP(combat).exhaustPile.length} style={{ right: 26, bottom: 88 }} onClick={() => openPile('exhaust')} small />
      )}

      {/* ===== 能量球（能量 0 时红字暗球 —— 原版 NEnergyCounter dark 态；回能爆发闪光） ===== */}
      <div ref={energyOrbRef} className="absolute sts-energy" style={{ left: 118, bottom: 116, width: 104, height: 104, zIndex: 44 }}>
        <img src={`${A}/frames/${energyOrb}.png`} alt="能量" className="w-full h-full object-contain" draggable={false}
          style={p.energy === 0 ? { filter: 'brightness(0.45) saturate(0.6)' } : undefined} />
        <div className="absolute inset-0 flex items-center justify-center sts-num font-black"
          style={{
            fontSize: 40,
            color: p.energy === 0 ? '#ff5555' : '#fff',
            textShadow: p.energy === 0
              ? '2px 2px 0 #501717, 0 0 10px rgba(80,23,23,0.9)'
              : '2px 2px 0 #403010, 0 0 12px #ff5000',
          }}>
          {p.energy}
        </div>
      </div>

      {/* ===== 结束回合按钮（轮到你时脉动提示） ===== */}
      <button
        className={`sts-btn absolute sts-title ${combat.phase === 'player' && !busy && myTurn ? 'sts-btn-ready' : ''}`}
        style={{
          right: 108, bottom: 116, fontSize: 24, padding: '13px 34px', zIndex: 46,
          opacity: combat.phase !== 'player' || busy || !myTurn ? 0.5 : 1,
        }}
        disabled={combat.phase !== 'player' || busy || combat.combatOver || !myTurn}
        onClick={endTurn}
      >
        {combat.phase === 'player' ? (waitingPeer ? '队友回合…' : '结束回合') : '敌方回合…'}
      </button>

      {/* ===== 键盘快捷键提示（桌面端，原版快捷键还原） ===== */}
      {!isTouch && !waitingPeer && combat.phase === 'player' && (
        <div className="absolute sts-body" style={{ right: 96, bottom: 88, color: '#8a7458', fontSize: 11, zIndex: 46, textShadow: '1px 1px 0 #000' }}>
          快捷键：1-9 出牌 · E / 空格 结束回合 · Esc 菜单
        </div>
      )}

      {/* ===== 手牌 ===== */}
      <div className="absolute inset-x-0 flex justify-center items-end" style={{ bottom: -40, height: 320, zIndex: 45, pointerEvents: 'none' }}>
        {/* 离手卡牌动画（弃牌/消耗） */}
        {ghosts.map(g => (
          <div
            key={g.key}
            style={{
              position: 'absolute',
              transform: `translateX(${g.x}px) translateY(${g.ty}px) rotate(${g.rot}deg)`,
              transformOrigin: 'bottom center',
              zIndex: 80,
              pointerEvents: 'none',
            }}
          >
            <div className={g.kind === 'discard' ? 'sts-discard-fly' : 'sts-exhaust-fly'}>
              <CardView card={g.card} width={168} />
            </div>
          </div>
        ))}
        {hand.map((card, i) => {
          const layout = handLayout[i]
          const isPlayable = combat.phase === 'player' && !busy && !combat.combatOver && myTurn
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
                pointerEvents: isPlayable ? 'auto' : 'none',
              }}
              onMouseEnter={() => !isTouch && setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(h => (h === i ? -1 : h))}
            >
              <div className="hand-inner"
                style={{ transform: isSelected ? 'translateY(-132px) scale(1.25)' : undefined }}>
                <CardView
                  card={card}
                  width={168}
                  ctx={{ hpLost: p.hpLostThisCombat, rampageBonus: AP(combat).rampage?.[card.uid] || 0, glassKnifePenalty: AP(combat).glassKnife?.[card.uid] || 0, clawBonus: AP(combat).clawBonus || 0, shivBonus: p.statuses.accuracy || 0 }}
                  combatCtx={{ strength: p.statuses.strength || 0, weak: !!p.statuses.weak }}
                  unaffordable={!enough && isPlayable}
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

      {/* ===== 药水投掷动画 ===== */}
      <PotionThrowFx show={potionThrow} />

      {/* ===== 回合横幅 ===== */}
      <TurnBanner phase={combat.phase} turn={combat.turn} />

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
  return 'combat1'
}

// ============ 牌堆按钮 ============
function PileButton({ label, count, style, onClick, small, shuffled }: {
  label: string; count: number; style: React.CSSProperties; onClick: () => void; small?: boolean; shuffled?: boolean
}) {
  const w = small ? 50 : 66
  return (
    <button className="pile-btn absolute flex flex-col items-center gap-0.5" style={{ ...style, zIndex: 40 }} onClick={onClick}>
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
