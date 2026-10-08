// 第十六批单文件版验证（topbar/shop/treasure/gameover 第六批落地）
// 与 Next.js 版同套用例（单文件版图片为 data URL、选择器一致）
import { execFileSync } from 'child_process'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
function ev(code: string): any {
  try {
    const out = execFileSync('agent-browser', ['eval', code, '--json'], { encoding: 'utf-8', timeout: 60000 })
    const j = JSON.parse(out)
    return j?.data?.result ?? j?.data ?? ''
  } catch (e: any) {
    return 'ERR:' + (e.stdout || e.message || '').slice(0, 300)
  }
}
function evJson(code: string): any {
  const r = ev(code)
  if (r !== null && typeof r === 'object') return r
  try { return JSON.parse(r) } catch { return { err: String(r).slice(0, 400) } }
}
let pass = 0, fail = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${detail}`) }
}
function mutateRun(patch: string): any {
  return evJson(`(() => {
    const st = window.__sts.getState()
    if (!st.run) return { err: 'no run' }
    const r = JSON.parse(JSON.stringify(st.run))
    const patch = ${patch}
    patch(r)
    window.__sts.setState({ run: r })
    return { ok: true, screen: r.screen }
  })()`)
}

async function main() {
  console.log('== 打开单文件版 ==')
  execFileSync('agent-browser', ['open', 'file:///home/z/my-project/download/slay-the-spire-standalone.html'], { encoding: 'utf-8', timeout: 60000 })
  await sleep(3500)
  for (let i = 0; i < 12; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(800)
  }
  check('store就绪', ev(`typeof window.__sts === 'function'`) === true)

  // ===== 开局 =====
  ev(`window.__sts.getState().startRun('ironclad')`)
  await sleep(600)
  for (let i = 0; i < 14; i++) {
    const sc = ev(`window.__sts.getState().run?.screen`)
    if (sc === 'neow' || sc === 'map') break
    await sleep(700)
  }
  for (let i = 0; i < 12; i++) {
    const j = evJson(`(() => { const g = window.__sts.getState(); return JSON.stringify({ screen: g.run?.screen, sel: g.select ? g.select.kind : null, uids: g.select?.cardUids?.slice(0,2) }) })()`)
    if (j.screen === 'map' && !j.sel) break
    if (j.screen === 'neow') ev(`window.__sts.getState().chooseNeow(1)`)
    if (j.sel && Array.isArray(j.uids) && j.uids.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(j.uids[0])})`)
    await sleep(700)
  }
  await sleep(2600)
  check('到达地图', ev(`window.__sts.getState().run?.screen`) === 'map')

  // ===== ① 金钱逐级计数 =====
  console.log('== ① 金钱逐级计数 ==')
  const gold0 = ev(`window.__sts.getState().run?.players[0]?.gold`)
  mutateRun(`r => { r.players[0].gold += 800 }`)
  await sleep(460)
  const goldMid = ev(`(() => { const el = document.querySelector('#hud-gold'); return el ? el.textContent : null })()`)
  await sleep(3000)
  const goldEnd = ev(`(() => { const el = document.querySelector('#hud-gold'); return el ? el.textContent : null })()`)
  check('①计数中显示中间值', typeof goldMid === 'string' && !String(goldMid).includes(String(gold0 + 800)), `mid=${goldMid} (start=${gold0} target=${gold0 + 800})`)
  check('①计数完成到达终值', typeof goldEnd === 'string' && String(goldEnd).includes(String(gold0 + 800)), `end=${goldEnd}`)

  // ===== ② 卡组数量弹跳 =====
  console.log('== ② 卡组数量弹跳 ==')
  mutateRun(`r => { r.players[0].deck.push({ uid: 'test_deck_1', id: 'strike', upgraded: 0 }) }`)
  await sleep(200)
  const deckAnim = evJson(`(() => {
    const el = document.querySelector('#hud-deck-count')
    if (!el) return { found: false }
    const anims = [el, ...el.querySelectorAll('*')].flatMap(e => e.getAnimations ? e.getAnimations() : [])
    return { found: true, n: anims.length, txt: el.textContent }
  })()`)
  const deckN = ev(`window.__sts.getState().run?.players[0]?.deck?.length`)
  check('②卡组数量弹跳动画触发', deckAnim.found === true && deckAnim.n > 0, JSON.stringify(deckAnim))
  check('②卡组数量更新', String(deckAnim.txt) === String(deckN), `txt=${deckAnim.txt} want=${deckN}`)

  // ===== ③ 药水入场 + 满带抖动 =====
  console.log('== ③ 药水动画 ==')
  // 先清空药水带：Neow 的 n2_potions（获得3瓶随机药水）随机命中时槽0非空，
  // 后续赋值将成「替换」而非「新增」，不触发入场动画 → 测试不稳定。清空后再新增。
  mutateRun(`r => { r.potions = [null, null, null]; r.players[0].potions = r.potions }`)
  await sleep(150)
  mutateRun(`r => { r.potions[0] = 'firePotion'; r.players[0].potions = r.potions }`)
  await sleep(300)
  const potIn = evJson(`(() => {
    const el = document.querySelector('#hud-potions .sts-pot-in')
    const cs = el ? getComputedStyle(el) : null
    return { found: !!el, anim: cs ? cs.animationName + ' ' + cs.animationDuration : null }
  })()`)
  check('③药水获得入场动画', potIn.found === true && /sts-pot-in/.test(potIn.anim || ''), JSON.stringify(potIn))

  mutateRun(`r => { r.potions = ['firePotion', 'blockPotion', 'strengthPotion']; r.players[0].potions = r.potions; r.reward = { gold: 10, potion: 'dexterityPotion', taken: [] }; r.combat = { isBoss: false, players: [{ drawPile: [] }], activeIdx: 0 }; r.screen = 'reward' }`)
  await sleep(2600)
  ev(`window.__sts.getState().takePotion()`)
  await sleep(300)
  const beltFail = evJson(`(() => {
    const st = window.__sts.getState()
    const row = document.querySelector('#hud-potions')
    const anims = row && row.getAnimations ? row.getAnimations() : []
    return { tick: st.potionBeltFail, animN: anims.length }
  })()`)
  check('③药水栏满失败信号', (beltFail.tick || 0) >= 1, JSON.stringify(beltFail))
  check('③药水带抖动动画播放', beltFail.animN > 0, JSON.stringify(beltFail))
  // 奖励界面顶栏常驻
  const rewardHud = ev(`!!document.querySelector('#hud-gold')`)
  check('⑨奖励界面顶栏HUD常驻', rewardHud === true)

  // ===== ④ 战斗开始药水闪耀 =====
  console.log('== ④ 战斗药水闪耀 ==')
  mutateRun(`r => {
    r.reward = null
    r.screen = 'combat'
    r.combat = { enemies: [{ uid: 'e1', id: 'jawWorm', hp: 40, maxHp: 40, block: 0, statuses: {}, intents: [] }], players: [{ hp: r.players[0].hp, maxHp: r.players[0].maxHp, block: 0, energy: 3, statuses: {}, hand: [], drawPile: [], discardPile: [], exhaustPile: [] }], activeIdx: 0, acted: [false], turn: 1, phase: 'player', encounterName: '测试', isElite: false, isBoss: false, goldReward: 10, potionDrop: false, fx: [], log: [], combatOver: false, playerWon: false, combatEndTriggered: false }
  }`)
  await sleep(2000)
  let shineN = 0, shineAnim: string | null = null
  for (let i = 0; i < 14; i++) {
    const j = evJson(`(() => {
      const row = document.querySelector('#hud-potions')
      if (!row) return { n: 0 }
      const anims = [row, ...row.querySelectorAll('*')].flatMap(e => e.getAnimations ? e.getAnimations() : [])
      return { n: anims.length, name: anims[0] ? (anims[0].animationName || 'waapi') : null }
    })()`)
    if ((j.n || 0) > shineN) { shineN = j.n; shineAnim = j.name }
    if (shineN > 0) break
    await sleep(100)
  }
  check('④战斗开始药水闪耀弹跳', shineN > 0, `n=${shineN} anim=${shineAnim}`)

  // ===== ⑤ 药水退场 ghost（丢弃路径） =====
  console.log('== ⑤ 药水退场 ghost ==')
  ev(`(() => { const btn = document.querySelector('#hud-potions .pdisc'); if (btn) btn.click(); return !!btn })()`)
  await sleep(200)
  const ghost = evJson(`(() => {
    const el = document.querySelector('#hud-potions [class*=sts-pot-ghost]')
    if (!el) return { found: false }
    const cs = getComputedStyle(el)
    return { found: true, cls: el.className, anim: cs.animationName + ' ' + cs.animationDuration }
  })()`)
  check('⑤药水丢弃退场ghost', ghost.found === true && /sts-pot-ghost-discard/.test(ghost.cls || '') && /sts-pot-discard-out/.test(ghost.anim || ''), JSON.stringify(ghost))

  // ===== ⑥ 商店 =====
  console.log('== ⑥ 商店 ==')
  mutateRun(`r => {
    r.combat = null
    r.screen = 'shop'
    r.shop = { cards: [{ cardId: 'strike', price: 999, sold: false, upgraded: false }, { cardId: 'bash', price: 45, sold: false, upgraded: false, discount: true }], relics: [{ relicId: 'anchor', price: 160, sold: false }], potions: [{ potionId: 'firePotion', price: 999, sold: false }], removalUsed: false, removalPrice: 75 }
    r.players[0].gold = 100
  }`)
  await sleep(2400)
  check('⑥商店顶栏HUD常驻', ev(`!!document.querySelector('#hud-gold')`) === true)
  const priceColors = evJson(`(() => {
    const tags = [...document.querySelectorAll('.shop-price, .price-tag, [class*=shop-price]')]
    const colors = tags.map(t => {
      const own = t.style && t.style.color ? t.style.color : ''
      const inner = [...t.querySelectorAll('span')].map(s => s.style && s.style.color).filter(Boolean)[0] || ''
      return (own || inner || '') + '|' + t.textContent.trim().slice(0, 14)
    })
    return { n: tags.length, colors }
  })()`)
  check('⑥商店价格标签渲染', priceColors.n >= 4, JSON.stringify(priceColors).slice(0, 200))
  check('⑥买不起红色(#FF5555)', JSON.stringify(priceColors).toLowerCase().includes('#ff5555') || JSON.stringify(priceColors).includes('255, 85, 85'), JSON.stringify(priceColors).slice(0, 300))
  check('⑥打折绿色(#7FFF00)', JSON.stringify(priceColors).toLowerCase().includes('#7fff00') || JSON.stringify(priceColors).includes('127, 255, 0'), JSON.stringify(priceColors).slice(0, 300))
  ev(`window.__sts.getState().buyCard(0)`)
  await sleep(250)
  const wiggle = evJson(`(() => {
    const st = window.__sts.getState()
    const el = document.querySelector('#shop-cards [data-sidx="0"]')
    const anims = el && el.getAnimations ? el.getAnimations() : []
    return { fail: st.shopFail ? st.shopFail.kind + ':' + st.shopFail.idx : null, animN: anims.length }
  })()`)
  check('⑥购买失败信号', wiggle.fail === 'card:0', JSON.stringify(wiggle))
  check('⑥槽位抖动动画播放', wiggle.animN > 0, JSON.stringify(wiggle))
  // hover 缩放（.sts-shop-slot transition 0.5s Expo Out）
  const hoverScale = evJson(`(() => {
    const el = document.querySelector('#shop-cards [data-sidx="1"]')
    if (!el) return { found: false }
    const cs = getComputedStyle(el)
    return { found: true, transition: cs.transitionDuration + ' ' + cs.transitionTimingFunction }
  })()`)
  check('⑥槽位hover缩放回落过渡', hoverScale.found === true && /0\.5s/.test(hoverScale.transition || ''), JSON.stringify(hoverScale))

  // ===== ⑦ 宝箱两步 =====
  console.log('== ⑦ 宝箱两步 ==')
  mutateRun(`r => { r.shop = null; r.screen = 'treasure'; r.pendingTreasureRelic = undefined }`)
  await sleep(1800)
  const chestBefore = evJson(`(() => {
    const openBtn = [...document.querySelectorAll('button')].find(b => /打开宝箱/.test(b.textContent || ''))
    return { hasOpenBtn: !!openBtn, hasTake: !![...document.querySelectorAll('button')].find(b => /拿走/.test(b.textContent || '')) }
  })()`)
  check('⑦宝箱初始为开箱按钮', chestBefore.hasOpenBtn === true && chestBefore.hasTake === false, JSON.stringify(chestBefore))
  ev(`window.__sts.getState().openTreasure()`)
  await sleep(900)
  const chestAfter = evJson(`(() => {
    const st = window.__sts.getState()
    const relic = document.querySelector('.sts-chest-relic')
    const glow = document.querySelector('[class*=sts-chest-glow]')
    const cs = relic ? getComputedStyle(relic) : null
    return {
      pending: st.run?.pendingTreasureRelic ?? null,
      screen: st.run?.screen,
      hasRelic: !!relic,
      hasGlow: !!glow,
      glowCls: glow ? glow.className : null,
      relicTransition: cs ? cs.transition : null,
      hasTake: !![...document.querySelectorAll('button')].find(b => /拿走/.test(b.textContent || '')),
    }
  })()`)
  check('⑦开箱后遗物2×展示', chestAfter.hasRelic === true && typeof chestAfter.pending === 'string', JSON.stringify(chestAfter))
  check('⑦稀有度光晕渲染', chestAfter.hasGlow === true && /sts-chest-glow/.test(chestAfter.glowCls || ''), `glow=${chestAfter.glowCls}`)
  check('⑦hover过渡0.4s Expo Out', /0\.4s/.test(chestAfter.relicTransition || '') && /cubic-bezier/.test(chestAfter.relicTransition || ''), `t=${chestAfter.relicTransition}`)
  check('⑦拾取按钮出现', chestAfter.hasTake === true)
  ev(`window.__sts.getState().confirmTreasure()`)
  await sleep(2000)
  const chestDone = evJson(`(() => {
    const st = window.__sts.getState()
    return { screen: st.run?.screen, pending: st.run?.pendingTreasureRelic, relics: st.run?.relics?.length, toast: st.toast }
  })()`)
  check('⑦拾取后回地图+遗物入包', chestDone.screen === 'map' && chestDone.pending === undefined && (chestDone.relics || 0) >= 1, JSON.stringify(chestDone))

  // ===== ⑧ 死亡界面 =====
  console.log('== ⑧ 死亡界面 ==')
  mutateRun(`r => {
    r.screen = 'gameover'
    r.gameOverInfo = { victory: false, floor: 15, monstersSlain: 23, elitesSlain: 3, goldEarned: 600 }
    r.players[0].deck = Array.from({ length: 10 }, (_, i) => ({ uid: 'd' + i, id: 'strike', upgraded: 0 }))
    r.players[0].gold = 1200
  }`)
  await sleep(1800)
  const go = evJson(`(() => {
    const title = document.querySelector('.sts-go-title')
    const quote = document.querySelector('.sts-go-quote')
    const stats = [...document.querySelectorAll('.sts-go-stat')]
    const badges = [...document.querySelectorAll('.sts-go-badge')].map(b => b.textContent).join(' / ')
    const btn = document.querySelector('.sts-go-btn')
    const csT = title ? getComputedStyle(title) : null
    const csQ = quote ? getComputedStyle(quote) : null
    const csB = btn ? getComputedStyle(btn) : null
    return {
      hasTitle: !!title, titleAnim: csT ? csT.animationName + ' ' + csT.animationDuration : null,
      hasQuote: !!quote, quoteAnim: csQ ? csQ.animationName + ' ' + csQ.animationDuration : null, quoteTxt: quote ? quote.textContent.slice(0, 12) : null,
      statN: stats.length, statDelays: stats.slice(0, 2).map(s => s.style.animationDelay),
      badgeTxt: badges,
      hasBtn: !!btn, btnAnim: csB ? csB.animationName + ' ' + csB.animationDuration : null,
    }
  })()`)
  check('⑧标题淡入', go.hasTitle === true && /sts-go-title-in/.test(go.titleAnim || ''), JSON.stringify(go.titleAnim))
  check('⑧死亡引言滑入', go.hasQuote === true && /sts-go-quote-in/.test(go.quoteAnim || '') && /2s/.test(go.quoteAnim || ''), `anim=${go.quoteAnim} txt=${go.quoteTxt}`)
  check('⑧统计行逐项滑入', go.statN >= 4, `statN=${go.statN}`)
  check('⑧统计行错峰延迟', go.statDelays.length >= 2 && go.statDelays[0] !== go.statDelays[1], JSON.stringify(go.statDelays))
  check('⑧小卡组+守财奴徽章', /小卡组/.test(go.badgeTxt || '') && /守财奴/.test(go.badgeTxt || ''), `badges=${go.badgeTxt}`)
  check('⑧按钮滑入', go.hasBtn === true && /sts-go-btn-in/.test(go.btnAnim || '') && /0\.5s/.test(go.btnAnim || ''), JSON.stringify(go.btnAnim))

  console.log(`\n== 结果: ${pass} 通过 / ${fail} 失败 ==`)
  process.exit(fail ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
