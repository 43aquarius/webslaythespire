// 第三十一批测试：商店/宝箱屏原版化（双版本）
// 素材（shop 6 + chests 8）+ 宝箱模型（三档掷定/档位折叠/金币/act4）
// + 宝箱屏 DOM（三档图/开箱换图/原版位置/两步语义）
// + 商店 DOM（rug 全屏/原版价格/特卖标签/purge 售罄/商人手/离开按钮）
// + 对话气泡（欢迎 1.5s/买不起/成交/4.2s 生命周期）
// 用法: npx tsx scripts/test_batch31.ts [next|standalone]
import { execFileSync } from 'child_process'
import { mkdirSync } from 'fs'

const MODE = (process.argv[2] === 'standalone') ? 'standalone' : 'next'
const URL = MODE === 'next' ? 'http://localhost:3100/' : 'file:///home/z/my-project/download/slay-the-spire-standalone.html'
const SHOT = '/home/z/my-project/scripts/study/batch31'
mkdirSync(SHOT, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
function cli(args: string[]): string {
  try { return execFileSync('agent-browser', args, { encoding: 'utf-8', timeout: 60000 }) }
  catch (e: any) { return 'ERR:' + (e.stdout || e.message || '').slice(0, 200) }
}
function ev(code: string): any {
  try {
    const out = execFileSync('agent-browser', ['eval', code, '--json'], { encoding: 'utf-8', timeout: 60000 })
    const j = JSON.parse(out)
    return j?.data?.result ?? j?.data ?? ''
  } catch (e: any) { return 'ERR:' + (e.stdout || e.message || '').slice(0, 300) }
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
async function waitFor(expr: string, tries = 12, ms = 500): Promise<any> {
  for (let i = 0; i < tries; i++) {
    const v = ev(expr)
    if (v && v !== 'null' && v !== 'undefined' && v !== false) return v
    await sleep(ms)
  }
  return null
}

// 资产断言按模式分：next=HTTP 状态码；standalone=ASSETS 内联键 + img.src 全等
const ASSET_OK = (key: string) => MODE === 'next'
  ? `(async () => { const r = await fetch('/assets/${key}'); return r.status })()`
  : `(() => { const A = window.ASSETS || {}; return !!A['${key}'] })()`

async function main() {
  console.log(`== 第三十一批测试 [${MODE}] ==`)
  cli(['open', URL])
  await sleep(3500)
  for (let i = 0; i < 15; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(800)
  }
  check('store就绪', ev(`typeof window.__sts === 'function'`) === true)
  if (ev(`typeof window.__sts === 'function'`) !== true) {
    console.log(ev(`document.body ? document.body.innerText.slice(0,120) : ''`))
    process.exit(1)
  }

  // ===== 开局：进地图（B 段需要活跃 run） =====
  ev(`window.__sts.getState().startRun('ironclad')`)
  await sleep(500)
  for (let i = 0; i < 14; i++) {
    const sc = ev(`window.__sts.getState().run?.screen`)
    if (sc === 'neow' || sc === 'map') break
    await sleep(700)
  }
  for (let i = 0; i < 12; i++) {
    const j = evJson(`(() => { const g = window.__sts.getState(); return JSON.stringify({ screen: g.run?.screen, sel: g.select ? g.select.kind : null, uids: g.select?.cardUids?.slice(0,2) }) })()`)
    const jj = typeof j === 'string' ? JSON.parse(j || '{}') : j
    if (jj?.screen === 'map' && !jj?.sel) break
    if (jj?.screen === 'neow') ev(`window.__sts.getState().chooseNeow(1)`)
    if (jj?.sel && Array.isArray(jj?.uids) && jj?.uids.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(jj.uids[0])})`)
    await sleep(700)
  }
  await sleep(2600)
  check('到达地图', ev(`window.__sts.getState().run?.screen`) === 'map')

  // ===== A. 素材 =====
  console.log('-- A. 素材 --')
  const SHOP_FILES = ['shop/rug.webp', 'shop/purge.webp', 'shop/soldout.webp', 'shop/hand.webp', 'shop/saletag.webp', 'shop/bubble.webp']
  const CHEST_FILES = ['chests/small.webp', 'chests/smallOpened.webp', 'chests/medium.webp', 'chests/mediumOpened.webp', 'chests/large.webp', 'chests/largeOpened.webp', 'chests/boss.webp', 'chests/bossOpened.webp']
  if (MODE === 'next') {
    const res = await evJson(`(async () => { const out = {}; for (const k of ${JSON.stringify([...SHOP_FILES, ...CHEST_FILES])}) { const r = await fetch('/assets/' + k); out[k] = r.status } return out })()`)
    const bad = Object.entries(res).filter(([, s]) => s !== 200)
    check(`A1 shop6+chests8 HTTP 200`, bad.length === 0, JSON.stringify(bad))
    const head = await evJson(`(async () => { const r = await fetch('/assets/shop/rug.webp'); const b = new Uint8Array(await r.arrayBuffer()); return [b[0], b[1], b[2], b[3]] })()`)
    check('A2 webp 魔法头 RIFF', Array.isArray(head) && head[0] === 82 && head[1] === 73, JSON.stringify(head))
  } else {
    const res = evJson(`(() => { const A = window.ASSETS || {}; const out = {}; for (const k of ${JSON.stringify([...SHOP_FILES, ...CHEST_FILES])}) out[k] = !!A[k]; return out })()`)
    const bad = Object.entries(res).filter(([, v]) => v !== true)
    check(`A1 shop6+chests8 ASSETS 内联`, bad.length === 0, JSON.stringify(bad))
    const head = ev(`(() => { const A = window.ASSETS || {}; const s = A['shop/rug.webp'] || ''; return s.slice(5, 15) })()`)
    check('A2 data URI 前缀 data:image/webp', String(head).startsWith('image/webp'), String(head))
  }

  // ===== B. 宝箱模型（store 层） =====
  console.log('-- B. 宝箱模型 --')
  // 通用构造：完整克隆 g.run + 覆盖目标字段；map 复用原样只补 n1 与 startNodes；
  // screen 恒 'treasure' —— 绝不让部分态进 MapScreen 渲染（历史教训：最小化 map 导致渲染崩溃）
  const N1 = 240
  const dist = evJson(`(() => {
    const g = window.__sts.getState()
    const tally = { small: 0, medium: 0, large: 0 }
    for (let i = 0; i < ${N1}; i++) {
      const r = JSON.parse(JSON.stringify(g.run))
      Object.assign(r, { combat: null, screen: 'treasure', currentNodeId: null, visitedNodes: [], chestSize: undefined, pendingTreasureRelic: undefined, chestGold: null, act: 1 })
      r.map = JSON.parse(JSON.stringify(g.run.map))
      r.map.startNodes = ['n1']
      r.map.nodes.n1 = { id: 'n1', x: 0, y: 0, type: 'treasure', edges: [] }
      window.__sts.setState({ run: r })
      g.chooseNode('n1')
      const s = window.__sts.getState().run.chestSize
      if (s) tally[s]++
    }
    return { ...tally, n: ${N1} }
  })()`)
  const n1 = Number(dist?.n) || 0
  const sPct = n1 ? (dist.small / n1) * 100 : 0, mPct = n1 ? (dist.medium / n1) * 100 : 0, lPct = n1 ? (dist.large / n1) * 100 : 0
  check(`B1 入房掷档 50/33/17（实测 ${sPct.toFixed(0)}/${mPct.toFixed(0)}/${lPct.toFixed(0)}）`,
    n1 === 240 && Math.abs(sPct - 50) < 13 && Math.abs(mPct - 33) < 13 && Math.abs(lPct - 17) < 10,
    JSON.stringify(dist))
  // B2 act4 → 恒 medium（TheEnding 0/100/0）
  const act4 = evJson(`(() => {
    const g = window.__sts.getState()
    let ok = 0
    for (let i = 0; i < 8; i++) {
      const r = JSON.parse(JSON.stringify(g.run))
      Object.assign(r, { combat: null, screen: 'treasure', currentNodeId: null, visitedNodes: [], chestSize: undefined, pendingTreasureRelic: undefined, chestGold: null, act: 4 })
      r.map = JSON.parse(JSON.stringify(g.run.map))
      r.map.startNodes = ['n1']
      r.map.nodes.n1 = { id: 'n1', x: 0, y: 0, type: 'treasure', edges: [] }
      window.__sts.setState({ run: r })
      g.chooseNode('n1')
      if (window.__sts.getState().run.chestSize === 'medium') ok++
    }
    return { ok }
  })()`)
  check('B2 act4 恒中箱（TheEnding 0/100/0）', act4?.ok === 8, JSON.stringify(act4))
  // B3 档位掷点：金币概率/金额（large 50%75g · small 50%25g；均值 0.9-1.1 倍区间）
  const N2 = 200
  const tiers = evJson(`(() => {
    const g = window.__sts.getState()
    const out = { large: { gold0: 0, goldAmts: [] }, small: { gold0: 0, goldAmts: [] } }
    for (const size of ['large', 'small']) {
      for (let i = 0; i < ${N2}; i++) {
        const r = JSON.parse(JSON.stringify(g.run))
        Object.assign(r, { combat: null, screen: 'treasure', chestSize: size, pendingTreasureRelic: undefined, chestGold: null, act: 1, relics: [] })
        window.__sts.setState({ run: r })
        g.openTreasure()
        const rr = window.__sts.getState().run
        if (rr.chestGold) { out[size].gold0++; out[size].goldAmts.push(rr.chestGold) }
      }
    }
    return out
  })()`)
  const lg: any = tiers?.large || {}, sm: any = tiers?.small || {}
  check(`B3a large 箱金币 ~50% 次数 ${lg.gold0}/${N2}`, Number(lg.gold0) > N2 * 0.35 && Number(lg.gold0) < N2 * 0.65, JSON.stringify(lg))
  check('B3a large 金币均值 ~75（0.9-1.1 倍）', Number(lg.goldAmts?.length) > 0 && (() => {
    const a = lg.goldAmts as number[]
    const avg = a.reduce((x, y) => x + y, 0) / a.length
    return avg > 75 * 0.85 && avg < 75 * 1.15
  })(), JSON.stringify((lg.goldAmts || []).slice(0, 8)))
  check(`B3b small 箱金币 ~50% 次数 ${sm.gold0}/${N2}`, Number(sm.gold0) > N2 * 0.35 && Number(sm.gold0) < N2 * 0.65, JSON.stringify(sm))
  check('B3b small 金币均值 ~25', Number(sm.goldAmts?.length) > 0 && (() => {
    const a = sm.goldAmts as number[]
    const avg = a.reduce((x, y) => x + y, 0) / a.length
    return avg > 25 * 0.85 && avg < 25 * 1.15
  })(), JSON.stringify((sm.goldAmts || []).slice(0, 8)))
  // B4 档位折叠：large 不得出 common；small ~75% common
  // （经 __STS_RELICS 调试钩子直读 store，无 DOM 渲染滞后；第三十一批新增钩子）
  const N3 = 200
  const fold: Record<string, { blue: number; green: number }> = { large: { blue: 0, green: 0 }, small: { blue: 0, green: 0 } }
  const foldRes = evJson(`(() => {
    const g = window.__sts.getState()
    const RM = window.__STS_RELICS || {}
    const out = { large: { blue: 0, green: 0 }, small: { blue: 0, green: 0 } }
    for (const size of ['large', 'small']) {
      for (let i = 0; i < ${N3}; i++) {
        const r = JSON.parse(JSON.stringify(g.run))
        Object.assign(r, { combat: null, screen: 'treasure', chestSize: size, pendingTreasureRelic: undefined, chestGold: null, act: 1, relics: [] })
        window.__sts.setState({ run: r })
        g.openTreasure()
        const id = window.__sts.getState().run.pendingTreasureRelic
        if (id && RM[id]) { const rar = RM[id].rarity; if (rar === 'common') out[size].blue++; else if (rar === 'uncommon') out[size].green++ }
      }
    }
    return out
  })()`)
  if (foldRes) { fold.large = foldRes.large; fold.small = foldRes.small }
  const lf = fold.large, sf = fold.small
  const lTotal = lf.blue + lf.green
  const sTotal = sf.blue + sf.green
  check(`B4a large 0% common（${lf.blue}/${lTotal}）`, lTotal > 20 && lf.blue === 0, JSON.stringify(fold))
  check(`B4b small ~75% common（${sf.blue}/${sTotal}）`, sTotal > 20 && sf.blue > sTotal * 0.6 && sf.blue < sTotal * 0.9, JSON.stringify(fold))
  // B5 开箱 toast + 确认回图 + 遗物入包
  mutateRun(`r => { r.combat = null; r.screen = 'treasure'; r.chestSize = 'large'; r.pendingTreasureRelic = undefined; r.chestGold = null; r.relics = [] }`)
  await sleep(700)
  ev(`window.__sts.getState().openTreasure()`)
  await sleep(600)
  const openedState = evJson(`(() => { const st = window.__sts.getState(); const img = document.querySelector('[data-chest]'); return { toast: st.toast, pending: st.run ? st.run.pendingTreasureRelic : null, img: img ? img.getAttribute('data-chest') + '|' + img.getAttribute('data-chest-opened') : null } })()`)
  check('B5a 开箱 toast（金币/遗物）', typeof openedState?.toast === 'string' || typeof openedState?.pending === 'string', JSON.stringify(openedState).slice(0, 160))
  ev(`window.__sts.getState().confirmTreasure()`)
  await sleep(900)
  const doneState = evJson(`(() => { const st = window.__sts.getState(); return { screen: st.run ? st.run.screen : null, relics: st.run ? st.run.relics.length : 0 } })()`)
  check('B5b 确认回图+遗物入包', doneState?.screen === 'map' && Number(doneState?.relics) > 0, JSON.stringify(doneState))

  // ===== C. 宝箱屏 DOM =====
  console.log('-- C. 宝箱屏 DOM --')
  mutateRun(`r => { r.combat = null; r.screen = 'treasure'; r.chestSize = 'medium'; r.pendingTreasureRelic = undefined }`)
  await waitFor(`!!document.querySelector('[data-chest]')`, 12, 500)
  await sleep(400)
  const cDiag = evJson(`(() => { const st = window.__sts.getState(); return { screen: st.run ? st.run.screen : null, chestSize: st.run ? st.run.chestSize : null, pending: st.run ? st.run.pendingTreasureRelic : 'undef', body: document.body ? document.body.innerText.slice(0, 60) : null, imgN: document.querySelectorAll('img').length } })()`)
  console.log('  [C诊断]', JSON.stringify(cDiag))
  const chestDom = evJson(`(() => {
    const img = document.querySelector('[data-chest]')
    if (!img) return { found: false }
    const parent = img.parentElement
    // 用 rect 比率（transform 感知；left:68%+translate(-50%,-50%) 使 offsetLeft 不含位移）
    const pr = parent.getBoundingClientRect()
    const ir = img.getBoundingClientRect()
    const cx = (ir.left + ir.width / 2 - pr.left) / pr.width
    const cy = (ir.top + ir.height / 2 - pr.top) / pr.height
    const srcOk = ${MODE === 'next'
      ? `img.src.includes('/assets/chests/medium.webp')`
      : `(() => { const A = window.ASSETS || {}; return img.src === A['chests/medium.webp'] })()`}
    return { found: true, size: img.getAttribute('data-chest'), opened: img.getAttribute('data-chest-opened'), srcOk, cx: +cx.toFixed(3), cy: +cy.toFixed(3), w: img.offsetWidth }
  })()`)
  check('C1 中箱图 data-chest=medium + src 正确', chestDom?.found && chestDom?.size === 'medium' && chestDom?.srcOk === true, JSON.stringify(chestDom).slice(0, 200))
  check(`C2 原版位置 68%/51%（实测 ${chestDom?.cx}/${chestDom?.cy}）`,
    Math.abs(Number(chestDom?.cx) - 0.68) < 0.035 && Math.abs(Number(chestDom?.cy) - 0.51) < 0.05,
    JSON.stringify(chestDom).slice(0, 200))
  check('C3 未开箱 data-chest-opened=0', chestDom?.opened === '0', JSON.stringify(chestDom).slice(0, 120))
  // 开箱换图
  ev(`window.__sts.getState().openTreasure()`)
  await sleep(1200)
  const chestOpened = evJson(`(() => {
    const img = document.querySelector('[data-chest]')
    if (!img) return { found: false }
    const srcOk = ${MODE === 'next'
      ? `img.src.includes('/assets/chests/') && img.src.includes('Opened')`
      : `(() => { const A = window.ASSETS || {}; return img.src === A['chests/mediumOpened.webp'] })()`}
    return { found: true, opened: img.getAttribute('data-chest-opened'), srcOk, relic: !!document.querySelector('.sts-chest-relic'), glow: !!document.querySelector('[class*="sts-chest-glow"]'), takeBtn: !![...document.querySelectorAll('button')].find(b => /拿走/.test(b.textContent || '')) }
  })()`)
  check('C4 开箱换 opened 图 + 两步语义（relic/glow/拿走）', chestOpened?.found && chestOpened?.opened === '1' && chestOpened?.srcOk && chestOpened?.relic && chestOpened?.glow && chestOpened?.takeBtn, JSON.stringify(chestOpened).slice(0, 200))

  // ===== D. 商店 DOM =====
  console.log('-- D. 商店 DOM --')
  mutateRun(`r => {
    r.combat = null; r.screen = 'shop'
    r.shop = { cards: [{ cardId: 'strike', price: 999, sold: false, upgraded: false }, { cardId: 'bash', price: 45, sold: false, upgraded: false, discount: true }, { cardId: 'defend', price: 50, sold: false, upgraded: false }], relics: [{ relicId: 'anchor', price: 160, sold: false }], potions: [{ potionId: 'firePotion', price: 999, sold: false }], removalUsed: false, removalPrice: 75 }
    r.players[0].gold = 100
  }`)
  await sleep(2400) // 等 rug 滑入 + 欢迎气泡时窗
  const shopDom = evJson(`(() => {
    const rug = document.querySelector('.shop-rug > img')
    const rugOk = ${MODE === 'next'
      ? `(rug && rug.src.includes('/assets/shop/rug.webp'))`
      : `(() => { const A = window.ASSETS || {}; return rug && rug.src === A['shop/rug.webp'] })()`}
    const rugBox = rug ? { w: rug.offsetWidth, h: rug.offsetHeight, p: rug.parentElement.offsetWidth } : null
    // 价格三色 + data 属性
    const prices = [...document.querySelectorAll('.shop-price')].slice(0, 6).map(t => ({
      afford: t.getAttribute('data-afford'), sale: t.getAttribute('data-sale'),
      color: (t.querySelector('span') || {}).style ? (t.querySelector('span') || { style: {} }).style.color : '',
      hasGoldIcon: !!t.querySelector('img'),
    }))
    const saleTags = [...document.querySelectorAll('.sale-tag')]
    const saleOnDiscount = saleTags.length >= 1 && saleTags.every(t => { const host = t.closest('[data-sidx]'); return host ? Number(host.getAttribute('data-sidx')) === 1 : false })
    const hand = document.getElementById('shop-hand') || document.querySelector('.sts-shop-hand')
    const handIdle = hand ? hand.className.includes('idle') : false
    const purge = document.querySelector('.purge-img')
    const purgeOk = ${MODE === 'next'
      ? `(purge && purge.src.includes('/assets/shop/purge.webp'))`
      : `(() => { const A = window.ASSETS || {}; return purge && purge.src === A['shop/purge.webp'] })()`}
    const sil = document.querySelector('.purge-silhouette')
    const silFilter = sil ? getComputedStyle(sil).filter : ''
    const leave = [...document.querySelectorAll('button')].find(b => /^离开$/.test((b.textContent || '').trim()))
    const leaveBox = leave ? { r: Math.round(100 * (leave.getBoundingClientRect().right / innerWidth)), b: Math.round(100 * (leave.getBoundingClientRect().bottom / innerHeight)) } : null
    return { rugOk, rugBox, prices, saleTags: saleTags.length, saleOnDiscount, handIdle, purgeOk, silFilter, leaveBox, handPos: hand ? hand.style.left || hand.className : null }
  })()`)
  check('D1 rug 全屏原版地毯', shopDom?.rugOk === true && shopDom?.rugBox?.w >= shopDom?.rugBox?.p * 0.98, JSON.stringify(shopDom?.rugBox).slice(0, 120))
  const p0: any = shopDom?.prices?.[0], p1: any = shopDom?.prices?.[1], p2: any = shopDom?.prices?.[2]
  check('D2 价格三色 SALMON/SKY/WHITE + 金币图标',
    p0?.color === 'rgb(250, 128, 114)' && p1?.color === 'rgb(135, 206, 235)' && p2?.color === 'rgb(255, 255, 255)'
    && p0?.hasGoldIcon && p1?.hasGoldIcon && p2?.hasGoldIcon,
    JSON.stringify(shopDom?.prices?.slice(0, 3)).slice(0, 260))
  check('D3 特卖标签仅挂折扣卡（data-sidx=1）', shopDom?.saleTags === 1 && shopDom?.saleOnDiscount === true, `tags=${shopDom?.saleTags} onDiscount=${shopDom?.saleOnDiscount}`)
  const shimmer = evJson(`(() => {
    const tag = document.querySelector('.sale-tag')
    if (!tag) return { found: false }
    // next 版：::after 伪元素闪烁（挂在 .sale-tag 本体）；standalone：.sale-tag-glow img 动画
    let after = ''
    try { after = getComputedStyle(tag, '::after').animationName || '' } catch (e) { after = '' }
    const glowImg = tag.querySelector('.sale-tag-glow')
    const self = glowImg ? (getComputedStyle(glowImg).animationName || '') : ''
    return { found: true, after, self }
  })()`)
  check('D3b 特卖标签闪烁动画', shimmer?.found && (String(shimmer?.after || '').includes('saletag') || String(shimmer?.self || '').includes('saletag')), JSON.stringify(shimmer))
  check('D4 purge 服务图 + 剪影灰度', shopDom?.purgeOk === true && /grayscale/.test(String(shopDom?.silFilter)), `purge=${shopDom?.purgeOk} sil=${String(shopDom?.silFilter).slice(0, 60)}`)
  check('D5 商人手默认收起（idle）', shopDom?.handIdle === true, JSON.stringify(shopDom?.handPos).slice(0, 80))
  check('D6 离开按钮右下角', !!shopDom?.leaveBox && shopDom.leaveBox.r > 85 && shopDom.leaveBox.b > 88, JSON.stringify(shopDom?.leaveBox))

  // D7 hover 卡 → 手升起跟随
  const cardPos = evJson(`(() => { const el = document.querySelector('[data-sidx="2"]'); if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) } })()`)
  if (cardPos) {
    cli(['mouse', 'move', String(cardPos.x), String(cardPos.y)])
    await sleep(700)
    const handFollow = evJson(`(() => {
      const hand = document.getElementById('shop-hand') || document.querySelector('.sts-shop-hand')
      if (!hand) return { found: false }
      const card = document.querySelector('[data-sidx="2"]')
      const root = hand.closest('.shop-screen') || hand.parentElement
      if (!card || !root) return { found: false }
      const cardCx = (card.offsetLeft + card.offsetWidth / 2) / root.clientWidth
      const handL = parseFloat(hand.style.left || '0') / root.clientWidth
      return { found: true, idle: hand.className.includes('idle'), handL: +handL.toFixed(3), cardCx: +cardCx.toFixed(3) }
    })()`)
    check(`D7 hover 后手升起跟随（手 ${handFollow?.handL} vs 卡 ${handFollow?.cardCx}）`,
      handFollow?.found && handFollow?.idle === false && Math.abs(Number(handFollow?.handL) - Number(handFollow?.cardCx)) < 0.06,
      JSON.stringify(handFollow))
    cli(['mouse', 'move', '10', '10'])
    await sleep(1600)
    const handBack = ev(`(() => { const hand = document.getElementById('shop-hand') || document.querySelector('.sts-shop-hand'); return hand ? hand.className.includes('idle') : false })()`)
    check('D7b 1s 无悬停手退场', handBack === true)
  } else {
    check('D7 hover 后手升起跟随', false, 'card not found')
  }

  // D8 售罄换图（purge used）
  mutateRun(`r => { r.shop.removalUsed = true }`)
  await sleep(700)
  const soldDom = evJson(`(() => {
    const purge = document.querySelector('.purge-img')
    const ok = ${MODE === 'next'
      ? `(purge && purge.src.includes('/assets/shop/soldout.webp'))`
      : `(() => { const A = window.ASSETS || {}; return purge && purge.src === A['shop/soldout.webp'] })()`}
    const slot = document.querySelector('.shop-purge [data-used], .shop-purge .sts-shop-slot') || document.querySelector('[data-purge]')
    return { purgeOk: ok, purgeSrc: purge ? purge.src.slice(-30) : null }
  })()`)
  check('D8 移除已用 → soldout 图', soldDom?.purgeOk === true, JSON.stringify(soldDom).slice(0, 120))

  // ===== E. 对话气泡 =====
  console.log('-- E. 对话气泡 --')
  // 重进商店（欢迎语重播）
  mutateRun(`r => { r.shop.removalUsed = false; r.screen = 'map' }`)
  await sleep(1700) // 须超过 fade-out 1100ms：standalone 的欢迎重置挂在屏幕应用（applyScreenNow）上
  mutateRun(`r => { r.screen = 'shop' }`)
  await waitFor(`!!document.querySelector('.shop-rug > img')`, 12, 500)
  await sleep(2600) // 挂载后 1.5s 欢迎 + 打字过程
  const bubbleWelcome = evJson(`(() => {
    const b = document.querySelector('.sts-speech-bubble')
    if (!b) return { found: false }
    const txt = (b.textContent || '').trim()
    return { found: true, side: b.getAttribute('data-bubble-side'), txt: txt.slice(0, 24) }
  })()`)
  check('E1 开店 1.5s 欢迎气泡', bubbleWelcome?.found && /欢迎/.test(String(bubbleWelcome?.txt)), JSON.stringify(bubbleWelcome))
  // E2 买不起 → cantBuy 气泡
  ev(`window.__sts.getState().buyCard(0)`)
  if (process.env.B31_TRACE) {
    for (let k = 0; k < 18; k++) {
      const s = evJson(`(() => ({ b: !!document.querySelector('.sts-speech-bubble'), h: (document.getElementById('shop-bubble-host')||{innerHTML:''}).innerHTML.slice(0, 60) }))()`)
      console.log('  [trace e2]', k * 300, JSON.stringify(s))
      if (k === 0 || s?.b) { if (k > 3) break }
      await sleep(300)
    }
  }
  await waitFor(`!!document.querySelector('.sts-speech-bubble')`, 10, 400)
  await sleep(1400)
  const bubbleCant = evJson(`(() => {
    const b = document.querySelector('.sts-speech-bubble')
    if (!b) return { found: false }
    const txt = (b.textContent || '').trim().replace(/\\s+/g, '')
    const cantList = ['金币可不够', '你没', '没钱啦', '金币不够', '买不起', '不是做慈善']
    const buyList = ['谢', '买卖', '成交', '概不退换', '顺利']
    return { found: true, txt: txt.slice(0, 30), isCant: cantList.some(s => txt.includes(s.replace(/\\s+/g, ''))), isBuy: buyList.some(s => txt.includes(s)) }
  })()`)
  if (!(bubbleCant?.found && bubbleCant?.isCant === true)) {
    const dbg = ev(`(() => { const h = document.getElementById('shop-bubble-host'); return h ? h.innerHTML.slice(0, 120) : 'NO HOST' })()`)
    console.log('  [E2诊断 host]', String(dbg).slice(0, 130))
  }
  check('E2 买不起 → cantBuy 气泡', bubbleCant?.found && bubbleCant?.isCant === true, JSON.stringify(bubbleCant).slice(0, 140))
  // E3 成交 → buyMsg 气泡
  ev(`window.__sts.getState().buyCard(1)`) // bash 45 折扣可买（gold 100）
  await sleep(1800)
  const bubbleBuy = evJson(`(() => {
    const b = document.querySelector('.sts-speech-bubble')
    const st = window.__sts.getState()
    const gold = st.run ? st.run.players[0].gold : null
    const sold = st.run ? st.run.shop.cards[1].sold : null
    const host = !!document.getElementById('shop-bubble-host')
    if (!b) return { found: false, sold, gold, host, fail: st.shopFail ? st.shopFail.kind + ':' + st.shopFail.idx + ':' + st.shopFail.ts : null }
    const txt = (b.textContent || '').trim().replace(/\\s+/g, '')
    const buyList = ['谢', '买卖', '成交', '概不退换', '顺利']
    return { found: true, txt: txt.slice(0, 30), isBuy: buyList.some(s => txt.includes(s)), sold }
  })()`)
  check('E3 成交 → buyMsg 气泡 + 卡售出', bubbleBuy?.found && bubbleBuy?.isBuy === true && bubbleBuy?.sold === true, JSON.stringify(bubbleBuy).slice(0, 140))
  // E4 气泡生命周期（4.2s 后消失）
  await sleep(4200)
  const bubbleGone = ev(`(() => { const host = document.getElementById('shop-bubble-host'); const b = document.querySelector('.sts-speech-bubble'); return !(b && (getComputedStyle(b).display !== 'none')) && (!host || !host.firstElementChild || !b) })()`)
  check('E4 气泡 4.2s 生命周期结束', bubbleGone === true, ev(`(() => { const b = document.querySelector('.sts-speech-bubble'); return b ? (b.textContent || '').slice(0, 20) : 'GONE' })()`))

  cli(['screenshot', `${SHOT}/${MODE}_shop_final.png`])
  // 截图存档：宝箱屏
  mutateRun(`r => { r.shop = null; r.screen = 'treasure'; r.chestSize = 'large'; r.pendingTreasureRelic = undefined }`)
  await sleep(1500)
  cli(['screenshot', `${SHOT}/${MODE}_treasure.png`])
  ev(`window.__sts.getState().openTreasure()`)
  await sleep(1000)
  cli(['screenshot', `${SHOT}/${MODE}_treasure_opened.png`])

  console.log(`\n== 结果[${MODE}]: ${pass} 通过 / ${fail} 失败 ==`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
