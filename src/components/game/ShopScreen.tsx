'use client'
// ============ 商店界面 + 事件界面（打字机/滑入选项为第五批原版还原） ============
import { useEffect, useState } from 'react'
import { useGame } from '@/store/gameStore'
import { CardView } from './CardView'
import { RELICS } from '@/game/relics'
import { POTIONS } from '@/game/potions'
import { EVENTS } from '@/game/events'
import { Tip } from './Shared'

const A = '/assets'

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
    <div className="w-full h-full relative overflow-y-auto sts-scroll select-none"
      style={{ background: 'radial-gradient(ellipse at 50% 20%, #3a2618 0%, #150c06 60%, #080402 100%)' }}>
      <div className="flex flex-col items-center gap-6 py-8 px-4">
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
        <div className="flex gap-5 flex-wrap justify-center">
          {shop.cards.map((item, i) => {
            const canAfford = gold >= item.price
            return (
              <div key={i} className={`flex flex-col items-center gap-1 transition-all ${item.sold ? 'opacity-30' : canAfford ? 'hover:-translate-y-1' : 'opacity-70'}`}
                style={{ cursor: item.sold ? 'default' : 'pointer' }}
                onClick={() => !item.sold && buyCard(i)}
              >
                <CardView card={{ uid: 'shop_' + i, id: item.cardId, upgraded: 0 }} width={150} dimmed={item.sold} />
                <div className="sts-body font-bold sts-num px-3 py-0.5 rounded"
                  style={{
                    background: canAfford && !item.sold ? '#6e5116' : '#3a2a1a',
                    color: canAfford && !item.sold ? '#ffe9a0' : '#a89070',
                    border: '1.5px solid #8a6a2e', fontSize: 15,
                  }}>
                  {item.sold ? '已售出' : item.discount ? (
                    <>💰 {item.price} <span style={{ color: '#8ee888', fontSize: 12 }}>5折</span></>
                  ) : `💰 ${item.price}`}
                </div>
              </div>
            )
          })}
        </div>

        {/* 遗物 + 药水 */}
        <div className="flex gap-10 flex-wrap justify-center items-start">
          <div className="flex gap-4 flex-wrap justify-center">
            {shop.relics.map((item, i) => {
              const def = RELICS[item.relicId]
              const canAfford = gold >= item.price
              return (
                <Tip key={i} tip={<><b>{def.name}</b><br />{def.desc}</>}>
                  <button
                    className={`sts-panel flex flex-col items-center gap-1 p-3 transition-all ${item.sold ? 'opacity-30' : canAfford ? 'hover:brightness-125 hover:-translate-y-1' : 'opacity-70'}`}
                    style={{ width: 130, cursor: item.sold ? 'default' : 'pointer' }}
                    onClick={() => !item.sold && buyRelic(i)}
                  >
                    <img src={`${A}/relics/${item.relicId}.png`} alt={def.name} width={56} height={56} draggable={false} />
                    <div className="sts-body" style={{ fontSize: 13, color: '#f5e5c8' }}>{def.name}</div>
                    <div className="sts-num font-bold" style={{ fontSize: 14, color: canAfford ? '#ffe9a0' : '#a89070' }}>
                      {item.sold ? '已售出' : `💰 ${item.price}`}
                    </div>
                  </button>
                </Tip>
              )
            })}
          </div>

          <div className="flex gap-4 flex-wrap justify-center">
            {shop.potions.map((item, i) => {
              const def = POTIONS[item.potionId]
              const canAfford = gold >= item.price
              return (
                <Tip key={i} tip={<><b>{def.name}</b><br />{def.desc}</>}>
                  <button
                    className={`sts-panel flex flex-col items-center gap-1 p-3 transition-all ${item.sold ? 'opacity-30' : canAfford ? 'hover:brightness-125 hover:-translate-y-1' : 'opacity-70'}`}
                    style={{ width: 120, cursor: item.sold ? 'default' : 'pointer' }}
                    onClick={() => !item.sold && buyPotion(i)}
                  >
                    <img src={`${A}/potions/${item.potionId}.png`} alt={def.name} width={44} height={50} draggable={false} />
                    <div className="sts-body" style={{ fontSize: 12, color: '#f5e5c8' }}>{def.name}</div>
                    <div className="sts-num font-bold" style={{ fontSize: 14, color: canAfford ? '#ffe9a0' : '#a89070' }}>
                      {item.sold ? '已售出' : `💰 ${item.price}`}
                    </div>
                  </button>
                </Tip>
              )
            })}
          </div>
        </div>

        {/* 移除服务 */}
        <button
          className="sts-btn sts-btn-gold sts-title"
          style={{ fontSize: 19, opacity: shop.removalUsed ? 0.4 : 1 }}
          disabled={shop.removalUsed}
          onClick={buyRemoval}
        >
          {shop.removalUsed ? '移除服务已使用' : `🧹 移除一张牌 —— 💰 ${shop.removalPrice}`}
        </button>

        <button className="sts-btn sts-title" style={{ fontSize: 22 }} onClick={leave}>
          离开商店
        </button>
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
      <div className="sts-panel flex flex-col items-center gap-5 p-10" style={{ maxWidth: 720 }}>
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
