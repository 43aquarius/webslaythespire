'use client'
// ============ 商店界面 + 事件界面（打字机/滑入选项为第五批原版还原；商店槽位动画为第六批） ============
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useGame } from '@/store/gameStore'
import { CardView } from './CardView'
import { RELICS } from '@/game/relics'
import { POTIONS } from '@/game/potions'
import { EVENTS } from '@/game/events'
import { Tip, TopHud } from './Shared'

const A = '/assets'

// ============ 商店槽位（原版 NMerchantSlot：hover 0.65→0.8 立即，离开 0.5s Expo Out；购买失败 sin 抖动 0.4s） ============
function ShopSlot({ kind, idx, sold, onBuy, small, tip, children }: {
  kind: 'card' | 'relic' | 'potion' | 'removal'; idx: number; sold: boolean; onBuy: () => void
  small?: boolean; tip?: ReactNode; children: ReactNode
}) {
  const shopFail = useGame(s => s.shopFail)
  const [hot, setHot] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const wig = shopFail && shopFail.kind === kind && shopFail.idx === idx ? shopFail.ts : 0
  useEffect(() => {
    if (!wig || !ref.current?.animate) return
    // 原版：x = sin(p·2π)·10，p = (1-(1-t)²)·2（Quad Out 缓动后采样 25 帧）
    ref.current.animate(
      Array.from({ length: 25 }, (_, i) => {
        const t = i / 24, p = (1 - (1 - t) * (1 - t)) * 2
        return { translate: `${Math.sin(p * 2 * Math.PI) * 10}px 0` }
      }),
      { duration: 400 },
    )
  }, [wig])
  const inner = (
    <div
      ref={ref}
      data-sidx={kind === 'card' ? idx : undefined}
      data-ridx={kind === 'relic' ? idx : undefined}
      data-pidx={kind === 'potion' ? idx : undefined}
      className={`sts-shop-slot ${small ? 'sts-shop-slot-sm' : ''} ${hot && !sold ? 'sts-shop-hot' : ''} ${sold ? 'sts-shop-sold' : ''} flex flex-col items-center gap-1`}
      style={{ cursor: sold ? 'default' : 'pointer' }}
      onPointerEnter={() => setHot(true)}
      onPointerLeave={() => setHot(false)}
      onClick={() => !sold && onBuy()}
    >
      {children}
    </div>
  )
  return tip ? <Tip tip={tip}>{inner}</Tip> : inner
}

// ============ 价格标签（原版 NMerchantSlot 价格：金币图标 + 数字；#FF5555 买不起 / #7FFF00 打折 / #FFF6E2 正常） ============
function ShopPrice({ price, sold, canAfford, sale }: { price: number; sold: boolean; canAfford: boolean; sale?: boolean }) {
  const color = !canAfford ? '#FF5555' : sale ? '#7FFF00' : '#FFF6E2'
  return (
    <div className="shop-price sts-body font-bold sts-num px-3 py-0.5 rounded flex items-center gap-1"
      style={{
        background: sold || !canAfford ? '#3a2a1a' : '#6e5116',
        border: '1.5px solid #8a6a2e', fontSize: 15,
      }}>
      {sold ? '已售出' : (
        <><span style={{ fontSize: 13 }}>💰</span><span style={{ color }}>{price}</span>
          {sale && <span style={{ color: '#7FFF00', fontSize: 12 }}>5折</span>}</>
      )}
    </div>
  )
}

export function ShopScreen() {
  const run = useGame(s => s.run)
  const buyCard = useGame(s => s.buyCard)
  const buyRelic = useGame(s => s.buyRelic)
  const buyPotion = useGame(s => s.buyPotion)
  const buyRemoval = useGame(s => s.buyRemoval)
  const leave = useGame(s => s.leaveShop)
  const net = useGame(s => s.net)

  if (!run?.shop) return null
  const shop = run.shop
  const mp = run.players.length > 1
  const myIdx = mp ? net.myIdx : 0
  const me = run.players[myIdx] || run.players[0]
  const myGold = me.gold
  const gold = myGold  // 以下所有价格判断基于自己的金币

  return (
    <div className="w-full h-full relative sts-scroll select-none">
      <TopHud />
      <div className="w-full h-full relative overflow-y-auto sts-scroll"
        style={{ background: 'radial-gradient(ellipse at 50% 20%, #3a2618 0%, #150c06 60%, #080402 100%)' }}>
        <div className="flex flex-col items-center gap-6 py-8 px-4" style={{ paddingTop: 128 }}>
        {/* 商店老板 */}
        <div className="flex items-center gap-6">
          <img src={`${A}/mapicons/shop.png`} alt="" width={100} height={100} draggable={false}
            style={{ filter: 'drop-shadow(0 0 20px rgba(255,180,80,0.4))' }} />
          <div>
            <div className="sts-title" style={{ fontSize: 40, color: '#ffd980', textShadow: '3px 3px 0 #000' }}>商店</div>
            <div className="sts-body" style={{ color: '#c8b090', fontSize: 14 }}>「看看有没有中意的？」</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="sts-body font-bold sts-num" style={{ color: '#ffd980', fontSize: 20, textShadow: '1px 1px 0 #000' }}>
              💰 {myGold}
            </div>
            {mp && (
              <div className="sts-body sts-num" style={{ color: '#a8b8c8', fontSize: 13 }}>
                队友 {run.players[1 - myIdx]?.gold ?? '-'}
              </div>
            )}
          </div>
        </div>

        {/* 卡牌 */}
        <div id="shop-cards" className="flex gap-5 flex-wrap justify-center">
          {shop.cards.map((item, i) => {
            const canAfford = gold >= item.price
            return (
              <ShopSlot key={i} kind="card" idx={i} sold={item.sold} onBuy={() => buyCard(i)}>
                <CardView card={{ uid: 'shop_' + i, id: item.cardId, upgraded: 0 }} width={150} dimmed={item.sold} />
                <ShopPrice price={item.price} sold={item.sold} canAfford={canAfford} sale={item.discount} />
              </ShopSlot>
            )
          })}
        </div>

        {/* 遗物 + 药水 */}
        <div className="flex gap-10 flex-wrap justify-center items-start">
          <div id="shop-relics" className="flex gap-4 flex-wrap justify-center">
            {shop.relics.map((item, i) => {
              const def = RELICS[item.relicId]
              const canAfford = gold >= item.price
              return (
                <ShopSlot key={i} kind="relic" idx={i} sold={item.sold} small
                  onBuy={() => buyRelic(i)}
                  tip={<><b>{def.name}</b><br />{def.desc}</>}
                >
                  <div className="sts-panel flex flex-col items-center gap-1 p-3" style={{ width: 130 }}>
                    <img src={`${A}/relics/${item.relicId}.png`} alt={def.name} width={56} height={56} draggable={false} />
                    <div className="sts-body" style={{ fontSize: 13, color: '#f5e5c8' }}>{def.name}</div>
                    <ShopPrice price={item.price} sold={item.sold} canAfford={canAfford} />
                  </div>
                </ShopSlot>
              )
            })}
          </div>

          <div id="shop-potions" className="flex gap-4 flex-wrap justify-center">
            {shop.potions.map((item, i) => {
              const def = POTIONS[item.potionId]
              const canAfford = gold >= item.price
              return (
                <ShopSlot key={i} kind="potion" idx={i} sold={item.sold} small
                  onBuy={() => buyPotion(i)}
                  tip={<><b>{def.name}</b><br />{def.desc}</>}
                >
                  <div className="sts-panel flex flex-col items-center gap-1 p-3" style={{ width: 120 }}>
                    <img src={`${A}/potions/${item.potionId}.png`} alt={def.name} width={44} height={50} draggable={false} />
                    <div className="sts-body" style={{ fontSize: 12, color: '#f5e5c8' }}>{def.name}</div>
                    <ShopPrice price={item.price} sold={item.sold} canAfford={canAfford} />
                  </div>
                </ShopSlot>
              )
            })}
          </div>
        </div>

        {/* 移除服务（原版 NMerchantCardRemoval：使用后帧动画划掉、价格隐藏、槽位保留） */}
        <ShopSlot kind="removal" idx={0} sold={shop.removalUsed} onBuy={buyRemoval}>
          <button
            className="sts-btn sts-btn-gold sts-title"
            style={{ fontSize: 19, opacity: shop.removalUsed ? 0.4 : 1, pointerEvents: 'none' }}
          >
            {shop.removalUsed ? '✂ 移除服务已使用' : `🧹 移除一张牌 —— 💰 ${shop.removalPrice}`}
          </button>
        </ShopSlot>

        <button className="sts-btn sts-title" style={{ fontSize: 22 }} onClick={leave}>
          离开商店
        </button>
        </div>
      </div>
    </div>
  )
}

// ============ 事件界面 ============
// ============ 事件描述打字机（原版 NEventLayout Typewriter） ============
// 0.75s 后 1s 内按 Sine Out 分布逐字揭示（前快后慢），容器同步淡入
function Typewriter({ text }: { text: string }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const delay = 750, dur = 1000
    const tick = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0 - delay) / dur))
      setShown(Math.round(Math.sin((k * Math.PI) / 2) * text.length))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [text])
  return (
    <span className="sts-ev-desc" style={{ display: 'inline-block' }}>
      {text.slice(0, shown)}<span style={{ opacity: 0 }}>{text.slice(shown)}</span>
    </span>
  )
}

export function EventScreen() {
  const run = useGame(s => s.run)
  const chooseEvent = useGame(s => s.chooseEvent)
  const eventMsg = useGame(s => s.eventMsg)
  const net = useGame(s => s.net)
  if (!run?.currentEvent) return null
  const ev = EVENTS[run.currentEvent]
  const mp = run.players.length > 1
  const me = run.players[mp ? net.myIdx : 0] || run.players[0]

  return (
    <div className="w-full h-full relative flex items-center justify-center select-none"
      style={{ background: 'radial-gradient(ellipse at 50% 25%, #2e2038 0%, #120a18 60%, #060306 100%)' }}>
      <TopHud />
      <div className="sts-panel flex flex-col items-center gap-5 p-10" style={{ maxWidth: 720, marginTop: 60 }}>
        {/* 标题：0.5s 后 0.5s 淡入（原版 useTitleFade） */}
        <div key={`evt-${run.currentEvent}`} className="sts-title sts-ev-title" style={{ fontSize: 36, color: '#ffd980', textShadow: '2px 2px 0 #000' }}>
          {ev.name}
        </div>
        <div className="sts-body" style={{ fontSize: 16, color: '#e8d8c0', lineHeight: 1.8, textAlign: 'justify', minHeight: 84 }}>
          <Typewriter key={`tw-${run.currentEvent}`} text={ev.desc} />
        </div>
        {mp && (
          <div className="sts-body" style={{ fontSize: 13, color: '#a8b8c8' }}>
            联机模式：任一玩家点击即生效（效果作用于点击者，你的金币 {me.gold}）
          </div>
        )}
        {eventMsg && (
          <div className="sts-body sts-ev-msg" style={{ fontSize: 15, color: '#8fe89a' }}>{eventMsg}</div>
        )}
        <div className="flex flex-col gap-3 w-full mt-2">
          {ev.choices.map((c: any, i: number) => {
            const disabled = c.effect === 'cleric_heal' && me.gold < 35 || c.effect === 'cleric_purify' && me.gold < 50
            return (
              <button
                key={`${run.currentEvent}-${i}`}
                className={`sts-btn sts-ev-opt text-left ${disabled ? 'sts-ev-locked' : ''}`}
                style={{ fontSize: 16, opacity: 1, width: '100%', animationDelay: `${0.5 + i * 0.2}s` }}
                disabled={disabled}
                onClick={() => chooseEvent(i)}
              >
                {c.text}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
