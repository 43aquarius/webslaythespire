'use client'
// ============ 商店界面（第三十一批原版化：全屏地毯+商人手+特卖标签+移除服务+对话气泡）+ 事件界面 ============
// 原版考证（ShopScreen.java/OnSaleTag.java/ShopSpeechBubble.java/characters.json ZHS）：
//   rug 全屏（zhs 1920x1136，updateRug lerp 滑入）；商人手 hover 悬停位跟随、1s 无悬停退场（updateHand lerp*6）
//   价格=金币图标+数字 tipHeaderFont23px；色 WHITE 可买 / SALMON #FA8072 买不起 / SKY #87CEEB 特卖
//   特卖标签 128px + 加色混合闪烁 (cosDeg(ms/5%360)+1.25)/3∈[0.083,0.75] 周期1.8s
//   移除服务 purge512 + 售罄 sold_out512 + 1/4透明黑卡身剪影（offset +18/-14px）
//   气泡 speechBubble3 512 facingRight=scaleX(-1)，入场 swingIn 0.3s scale→1/2，浮动 sin(t*4)，
//   淡入 0.08s / 尾段 0.3s 淡出，时长 4s；位置随机 x(660~1260)s y=H-380s；文本 BUMP_IN 逐词
//   文案（ZHS Shop Screen）：欢迎/买不起[1-6]/成交[7-11]/闲聊[TEXT0-15]
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useGame } from '@/store/gameStore'
import { CardView } from './CardView'
import { RELICS } from '@/game/relics'
import { POTIONS } from '@/game/potions'
import { EVENTS } from '@/game/events'
import { Tip, TopHud, PotionImg } from './Shared'

const A = '/assets'

// ============ 原版 ZHS 商店文案（characters.json Shop Screen） ============
const SHOP_TEXT = {
  welcome: '~欢迎~\n~欢迎！~',
  cantBuy: [
    '哎呀呀，\n这点 #r金币# 可不够啊。',
    '嘿兄弟，你没 #r钱# 啊！',
    '没钱啦？',
    '你的 #r金币# 不够。',
    '这个你买不起。',
    '我这儿不是做慈善的。',
  ],
  buyMsg: [
    '~谢~  ~啦~',
    '又一笔买卖……\n嚯嚯嚯！\n有得 @赚！@',
    '@成交！@',
    '概不退换。',
    '祝你顺利啊。',
  ],
  idle: [
    '嗨！\n买点什么吧！\n买买买！',
    '你的发型很不错哦',
    '看起来你还挺闲？',
    '你是狗党还是猫党？',
    '你看起来很 ~危险~ 啊，\n嘿嘿……',
    '慢慢看……\n……\n……不慢也行',
    '你喜欢这张地毯吗？\n可惜这个不卖',
    '要支持我这样的小店啊！',
    '面具就是酷，我也是同党啊！',
    '你有没有看见我的送货员？',
    '多留会儿，听听音乐啊！',
    '一个人前进太危险了！把你的钱都给我吧！',
    '买点儿啥吧',
    '~哈~  ~欠~',
    '我喜欢金币。',
    '我最喜欢的颜色是蓝色。\n你呢？',
  ],
}

// ============ 商店槽位（原版 NMerchantSlot：hover 0.65→0.8 立即，离开 0.5s Expo Out；购买失败 sin 抖动 0.4s） ============
function ShopSlot({ kind, idx, sold, onBuy, small, tip, onHover, children }: {
  kind: 'card' | 'relic' | 'potion' | 'removal'; idx: number; sold: boolean; onBuy: () => void
  small?: boolean; tip?: ReactNode; onHover?: (el: HTMLElement | null) => void; children: ReactNode
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
      onPointerEnter={e => { setHot(true); if (!sold) onHover?.(e.currentTarget) }}
      onPointerLeave={() => { setHot(false); onHover?.(null) }}
      onClick={() => !sold && onBuy()}
    >
      {children}
    </div>
  )
  return tip ? <Tip tip={tip}>{inner}</Tip> : inner
}

// ============ 价格（原版：金币图标 + 数字 tipHeaderFont；#FFFFFF 可买 / #FA8072 SALMON 买不起 / #87CEEB SKY 特卖） ============
function ShopPrice({ price, sold, canAfford, sale }: { price: number; sold: boolean; canAfford: boolean; sale?: boolean }) {
  if (sold) return <div className="shop-price sts-body font-bold sts-num" style={{ height: 26 }} />
  const color = !canAfford ? '#FA8072' : sale ? '#87CEEB' : '#FFFFFF'
  return (
    <div className="shop-price sts-body font-bold sts-num flex items-center justify-center gap-1"
      data-afford={canAfford ? '1' : '0'} data-sale={sale ? '1' : '0'}
      style={{ minHeight: 26 }}>
      <img src={`${A}/topbar/gold.png`} alt="" width={20} height={20} draggable={false}
        style={{ filter: 'drop-shadow(0 1px 0 #000)' }} />
      <span className="sts-num" style={{ color, fontSize: 19, textShadow: '1px 1px 0 #000' }}>{price}</span>
    </div>
  )
}

// ============ 特卖标签（原版 OnSaleTag：128px @卡右上 + 加色混合闪烁 [0.083,0.75] 周期 1.8s） ============
function SaleTag() {
  return (
    <div className="sale-tag" aria-hidden>
      <img src={`${A}/shop/saletag.webp`} alt="" draggable={false} />
    </div>
  )
}

// ============ 对话气泡（原版 ShopSpeechBubble + SpeechTextEffect） ============
function SpeechBubbleFx({ msg, side, xPct }: { msg: string; side: 'L' | 'R'; xPct: number }) {
  // 文本逐词 BUMP_IN：按 0.26s/词（原版逐词弹出）；生命周期由父级统一 4.4s（SPEECH_DURATION=3s+0.3s 淡出尾，与文案长度无关）
  const words = msg.split(/(\s+)/).filter(w => w !== '')
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (shown >= words.length) return
    const t = setTimeout(() => setShown(s => s + 1), 260)
    return () => clearTimeout(t)
  }, [shown])
  return (
    <div className="sts-speech-bubble" data-bubble-side={side}
      style={{ left: `${xPct}%`, top: '33%' }}>
      <img src={`${A}/shop/bubble.webp`} alt="" draggable={false}
        style={side === 'R' ? undefined : { transform: 'scaleX(-1)' }} />
      <div className="sts-speech-text sts-body">
        {words.slice(0, shown).map((w, i) => (
          <span key={i} className="sts-speech-word" style={{ whiteSpace: 'pre-wrap' }}>
            {w.replace(/#r([^#]*)#/g, '$1').replace(/[#@~]/g, '')}
          </span>
        ))}
      </div>
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
  const shopFail = useGame(s => s.shopFail)

  if (!run?.shop) return null
  const shop = run.shop
  const mp = run.players.length > 1
  const myIdx = mp ? net.myIdx : 0
  const me = run.players[myIdx] || run.players[0]
  const gold = me.gold

  return (
    <ShopScene
      run={run} shop={shop} gold={gold} mp={mp} myIdx={myIdx}
      buyCard={buyCard} buyRelic={buyRelic} buyPotion={buyPotion}
      buyRemoval={buyRemoval} leave={leave} shopFail={shopFail}
    />
  )
}

function ShopScene({ run, shop, gold, mp, myIdx, buyCard, buyRelic, buyPotion, buyRemoval, leave, shopFail }: any) {
  const wrapRef = useRef<HTMLDivElement>(null)
  // —— 商人手：hover 槽位跟随，1s 无悬停退场（原版 updateHand/notHoveredTimer） ——
  const [handX, setHandX] = useState<number | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onHover = (el: HTMLElement | null) => {
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null }
    if (el && wrapRef.current) {
      const w = wrapRef.current.getBoundingClientRect()
      const b = el.getBoundingClientRect()
      // 手位置用布局像素：getBoundingClientRect 含舞台 scale，需除回（scale = 显示宽/布局宽）
      const k = w.width > 0 && wrapRef.current.offsetWidth > 0 ? w.width / wrapRef.current.offsetWidth : 1
      setHandX((b.left + b.width / 2 - w.left) / k)
    } else {
      hoverTimer.current = setTimeout(() => setHandX(null), 1000)
    }
  }
  // —— 对话气泡（欢迎 1.5s → 闲聊 40~60s；买不起/成交即时） ——
  // 原版语义：每次 open() 重置 saidWelcome + speechTimer=1.5s —— 对应跟踪 run.screen 翻转
  // （房间过渡期间组件不重挂载，须以 store 的 screen 变化为准）
  const [bubble, setBubble] = useState<{ msg: string; side: 'L' | 'R'; x: number; n: number } | null>(null)
  const bubbleN = useRef(0)
  const bubbleTtl = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saidWelcome = useRef(false)
  const speak = (msgs: string[]) => {
    bubbleN.current++
    const n = bubbleN.current
    setBubble({
      msg: msgs[Math.floor(Math.random() * msgs.length)],
      side: Math.random() < 0.5 ? 'L' : 'R',
      x: 34 + Math.random() * 32,
      n,
    })
    // 生命周期 4.4s（原版 SPEECH_DURATION 3s + 入退场；与文案长度无关）——后到的气泡覆盖前一个的定时器
    if (bubbleTtl.current) clearTimeout(bubbleTtl.current)
    bubbleTtl.current = setTimeout(() => setBubble(null), 4400)
  }
  const curScreen = run?.screen
  useEffect(() => {
    if (curScreen !== 'shop') { saidWelcome.current = false; return }
    if (saidWelcome.current) return
    const t = setTimeout(() => { speak([SHOP_TEXT.welcome]); saidWelcome.current = true }, 1500)
    return () => clearTimeout(t)
  }, [curScreen])
  // 闲聊：40~60s 随机（原版 MIN/MAX_IDLE_MSG_TIME）
  useEffect(() => {
    if (!saidWelcome.current) return
    let alive = true
    const loop = () => {
      const wait = 40000 + Math.random() * 20000
      setTimeout(() => { if (alive) { speak(SHOP_TEXT.idle); loop() } }, wait)
    }
    loop()
    return () => { alive = false }
  }, [])
  // 买不起 → cantBuy 气泡（shopFail 变化）
  const failTs = shopFail?.ts ?? 0
  useEffect(() => { if (failTs) speak(SHOP_TEXT.cantBuy) }, [failTs])
  // 成交 → buyMsg 气泡（sold 数量增加）
  const soldCount = shop.cards.filter((c: any) => c.sold).length + shop.relics.filter((c: any) => c.sold).length + shop.potions.filter((c: any) => c.sold).length + (shop.removalUsed ? 1 : 0)
  const prevSold = useRef(soldCount)
  useEffect(() => {
    if (soldCount > prevSold.current) speak(SHOP_TEXT.buyMsg)
    prevSold.current = soldCount
  }, [soldCount])

  const removalPrice = shop.removalPrice
  return (
    <div ref={wrapRef} className="w-full h-full relative sts-scroll select-none overflow-hidden" data-scr="shop">
      {/* 原版全屏地毯（updateRug 滑入） */}
      <div className="shop-rug sts-shop-rug">
        <img src="/assets/shop/rug.webp" alt="" draggable={false} />
      </div>
      <TopHud />
      {/* 卡牌行（原版 TOP_ROW：5 卡 + 底部价格；1 张特卖 + 标签） */}
      <div id="shop-cards" className="shop-row-cards" style={{ top: '21%' }}>
        {shop.cards.map((item: any, i: number) => {
          const canAfford = gold >= item.price
          return (
            <ShopSlot key={i} kind="card" idx={i} sold={item.sold} onBuy={() => buyCard(i)} onHover={onHover}>
              <div className="relative">
                <CardView card={{ uid: 'shop_' + i, id: item.cardId, upgraded: 0 }} width={148} dimmed={item.sold} />
                {item.discount && !item.sold && <SaleTag />}
              </div>
              <ShopPrice price={item.price} sold={item.sold} canAfford={canAfford} sale={item.discount} />
            </ShopSlot>
          )
        })}
      </div>
      {/* 遗物 + 药水（原版 StoreRelic/StorePotion：hover 1.5x，价格同款） */}
      <div className="shop-row-goods" style={{ top: '48%' }}>
        <div id="shop-relics" className="flex gap-4 flex-wrap justify-center items-start">
          {shop.relics.map((item: any, i: number) => {
            const def = RELICS[item.relicId]
            const canAfford = gold >= item.price
            return (
              <ShopSlot key={i} kind="relic" idx={i} sold={item.sold} small onBuy={() => buyRelic(i)} onHover={onHover}
                tip={<><b>{def.name}</b><br />{def.desc}</>}>
                <img src={`${A}/relics/${item.relicId}.png`} alt={def.name} width={62} height={62} draggable={false}
                  style={{ filter: item.sold ? 'grayscale(1) opacity(.35)' : 'drop-shadow(0 3px 6px rgba(0,0,0,.55))' }} />
                <ShopPrice price={item.price} sold={item.sold} canAfford={canAfford} />
              </ShopSlot>
            )
          })}
        </div>
        <div id="shop-potions" className="flex gap-4 flex-wrap justify-center items-start">
          {shop.potions.map((item: any, i: number) => {
            const def = POTIONS[item.potionId]
            const canAfford = gold >= item.price
            return (
              <ShopSlot key={i} kind="potion" idx={i} sold={item.sold} small onBuy={() => buyPotion(i)} onHover={onHover}
                tip={<><b>{def.name}</b><br />{def.desc}</>}>
                <PotionImg potionId={item.potionId} style={{ width: 46, height: 52, filter: item.sold ? 'grayscale(1) opacity(.35)' : undefined }} />
                <ShopPrice price={item.price} sold={item.sold} canAfford={canAfford} />
              </ShopSlot>
            )
          })}
        </div>
      </div>
      {/* 移除服务（原版 renderPurge：purge512 @W*0.73 + 1/4黑剪影；已用→sold_out512） */}
      <div className="shop-purge" style={{ top: '55%' }} data-purge={shop.removalUsed ? 'used' : 'ok'}>
        <ShopSlot kind="removal" idx={0} sold={shop.removalUsed} onBuy={buyRemoval} onHover={onHover}>
          <div className="relative" style={{ width: 190, height: 230 }}>
            {/* 剪影（1/4 透明黑 + 灰度化技能底） */}
            <div className="purge-silhouette" aria-hidden />
            <img src={`${A}/shop/${shop.removalUsed ? 'soldout' : 'purge'}.webp`} alt="" draggable={false}
              className="purge-img" style={{ width: 190, height: 190, objectFit: 'contain' }} />
          </div>
          <ShopPrice price={removalPrice} sold={shop.removalUsed} canAfford={gold >= removalPrice} />
        </ShopSlot>
      </div>
      {/* 商人手（原版 merchantHand 512x1024：hover 跟随 / 1s 后退场） */}
      <div className={`sts-shop-hand ${handX === null ? 'sts-shop-hand-idle' : ''}`}
        style={handX !== null ? { left: `${handX}px` } : undefined} aria-hidden>
        <img src="/assets/shop/hand.webp" alt="" draggable={false} />
      </div>
      {/* 对话气泡 */}
      {bubble && <SpeechBubbleFx key={bubble.n} msg={bubble.msg} side={bubble.side} xPct={bubble.x} />}
      {/* 离开（原版 cancelButton NAMES[12]"离开" 右下角） */}
      <button className="sts-btn sts-title shop-leave" style={{ fontSize: 22 }} onClick={leave}>
        离开
      </button>
      {mp && (
        <div className="sts-body sts-num" style={{ position: 'absolute', left: '50%', bottom: 24, transform: 'translateX(-50%)', color: '#c8d8e8', fontSize: 13 }}>
          联机模式：各自购买 · 队友 {run.players[1 - myIdx]?.gold ?? '-'} 金币
        </div>
      )}
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

// 原版事件插画映射（反编译 events 类的图引用）
const EVENT_IMG: Record<string, string> = {
  bonfireSpirits: 'bonfire.jpg',
  bigFish: 'fishing.jpg',
  goldenWing: 'goldenWing.jpg',
  deadAdventurer: 'deadAdventurer.png',
  cleric: 'cleric.jpg',
  livingWorkshop: 'livingWall.jpg',
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
  // 各幕原版事件房背景（图集 event 区域）
  const evBg = run.act >= 4 ? 'event4' : run.act === 3 ? 'event3' : run.act === 2 ? 'event2' : 'event1'
  const evImg = EVENT_IMG[run.currentEvent]

  return (
    <div className="w-full h-full relative flex items-center justify-center select-none"
      style={{ backgroundImage: `url(${A}/bg/${evBg}.jpg)`, backgroundSize: 'cover', backgroundPosition: 'center 30%' }}>
      <div className="absolute inset-0" style={{ background: 'rgba(6,3,2,0.42)' }} />
      <TopHud />
      <div className="relative sts-panel flex flex-col items-center gap-4 p-8" style={{ maxWidth: 760, marginTop: 40 }}>
        {/* 原版事件插画（反编译游戏 events 目录） */}
        {evImg && (
          <img key={`img-${run.currentEvent}`} src={`${A}/events/${evImg}`} alt="" draggable={false}
            className="sts-ev-title"
            style={{ width: 380, maxHeight: 214, objectFit: 'cover', borderRadius: 6, border: '2px solid #6b4a2e', boxShadow: '0 4px 18px rgba(0,0,0,.6)' }} />
        )}
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
