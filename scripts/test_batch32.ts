// 第三十二批测试：奖励屏/商店卡右键检视（双版本）
// 原版语义：CardRewardScreen.cardSelectUpdate / ShopScreen.update：
//   justClickedRight → cardPopup.open(hoveredCard) 单卡版（无翻页箭头），左键仍为选卡/购买，售出卡可检视
// A 锚点结构 / B 奖励屏右键 / C 商店右键 / D 事件语义 / E 截图存档
// 用法: npx tsx scripts/test_batch32.ts [next|standalone]
import { execFileSync } from 'child_process'
import { mkdirSync } from 'fs'

const MODE = (process.argv[2] === 'standalone') ? 'standalone' : 'next'
const URL = MODE === 'next' ? 'http://localhost:3100/' : 'file:///home/z/my-project/download/slay-the-spire-standalone.html'
const SHOT = '/home/z/my-project/scripts/study/batch32'
mkdirSync(SHOT, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
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
// 在指定选择器元素上派发右键（MouseEvent contextmenu bubbles cancelable）；返回 dispatchEvent 结果
// （false = 被 preventDefault——即游戏接管了右键，浏览器默认菜单被屏蔽）
function rightClick(sel: string): boolean {
  return evJson(`(() => {
    const el = document.querySelector('${sel}')
    if (!el) return { err: 'no el' }
    const ret = el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: 400, clientY: 300 }))
    return { ok: true, defaultPrevented: !ret }
  })()`)
}

async function main() {
  console.log(`== 第三十二批测试（${MODE}）==`)
  cli(['open', URL]); await sleep(3000)
  for (let i = 0; i < 15; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(800)
  }
  if (ev(`typeof window.__sts === 'function'`) !== true) {
    console.log('  store 未就绪：', ev(`document.body ? document.body.innerText.slice(0,120) : ''`))
    process.exit(1)
  }

  // ===== 开局（batch31 同构：store API 直驱，绕开 DOM 文案全角空格陷阱） =====
  ev(`window.__sts.getState().startRun('ironclad')`)
  await sleep(600)
  for (let i = 0; i < 14; i++) {
    const sc = ev(`window.__sts.getState().run?.screen`)
    if (sc === 'neow' || sc === 'map') break
    await sleep(700)
  }
  for (let i = 0; i < 12; i++) {
    const j = evJson(`(() => { const g = window.__sts.getState(); return JSON.stringify({ screen: g.run ? g.run.screen : null, sel: g.select ? g.select.kind : null, uids: g.select ? (g.select.cardUids || []).slice(0, 2) : [] }) })()`)
    const jj = typeof j === 'string' ? JSON.parse(j || '{}') : j
    if (jj?.screen === 'map' && !jj?.sel) break
    if (jj?.screen === 'neow') ev(`window.__sts.getState().chooseNeow(1)`)
    if (jj?.sel && Array.isArray(jj?.uids) && jj?.uids.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(jj?.uids?.[0])})`)
    await sleep(700)
  }
  await sleep(2400)
  console.log('-- 预检：当前状态 --')
  const pre = evJson(`(() => { const g = window.__sts.getState(); return { has: !!g.run, screen: g.run ? g.run.screen : null } })()`)
  console.log('  ', JSON.stringify(pre))
  check('预检：run 就绪', pre?.has === true, JSON.stringify(pre).slice(0, 120))

  // ===== A. 锚点结构 =====
  console.log('-- A. 锚点结构 --')
  mutateRun(`r => {
    r.combat = { isBoss: false, players: [{ drawPile: [] }], activeIdx: 0 }
    r.reward = { gold: 10, cards: ['strike', 'bash', 'defend'], taken: [] }
    r.screen = 'reward'
  }`)
  await sleep(2300) // 房间过渡 1.1s + 挂载
  const anchors = evJson(`(() => {
    const ins = [...document.querySelectorAll('[data-inspect]')].map(el => el.getAttribute('data-inspect'))
    const names = ins.map(id => { try { return (window.__STS_CARDS || {})[id] } catch { return null } })
    return { ins, n: ins.length, body: document.body.innerText.slice(0, 80) }
  })()`)
  check('A1 奖励屏 3 张卡均有 data-inspect 锚点', anchors?.n === 3 && JSON.stringify(anchors?.ins) === JSON.stringify(['strike', 'bash', 'defend']), JSON.stringify(anchors).slice(0, 160))

  // ===== B. 奖励屏右键检视 =====
  console.log('-- B. 奖励屏右键 --')
  const r1 = rightClick('[data-inspect="strike"]')
  await sleep(500)
  const b1 = evJson(`(() => {
    const bd = document.querySelector('.scv-backdrop')
    const name = document.querySelector('[data-scv="name"]')
    const desc = document.querySelector('[data-scv="desc"]')
    const arrows = document.querySelectorAll('.scv-arrow').length
    return { open: !!bd, name: name ? name.textContent.trim() : null, desc: desc ? desc.textContent : null, arrows }
  })()`)
  check('B1 右键→检视层打开 + preventDefault（浏览器菜单屏蔽）', b1?.open === true && r1?.defaultPrevented === true, JSON.stringify({ r1, b1: b1?.name }).slice(0, 160))
  check('B2 大卡卡名正确（打击）+ 描述渲染', b1?.name === '打击' && /造成/.test(String(b1?.desc)), JSON.stringify(b1).slice(0, 160))
  check('B3 单卡无翻页箭头（open(card) 单卡版语义）', b1?.arrows === 0, `arrows=${b1?.arrows}`)
  const bLeft = evJson(`(() => { const g = window.__sts.getState(); return { screen: g.run ? g.run.screen : null, taken: g.run ? (g.run.reward ? g.run.reward.taken : null) : null } })()`)
  check('B4 右键不触发选卡（左键语义独立）', bLeft?.screen === 'reward' && (bLeft?.taken || []).length === 0, JSON.stringify(bLeft).slice(0, 120))

  // 升级预览
  ev(`(() => { const t = document.querySelector('.scv-upgrade-toggle'); if (t) t.click(); return !!t })()`)
  await sleep(400)
  const bUp = evJson(`(() => {
    const name = document.querySelector('[data-scv="name"]')
    const desc = document.querySelector('[data-scv="desc"]')
    return { green: name ? getComputedStyle(name).color : '', name: name ? name.textContent.trim() : null, desc: desc ? desc.textContent : null, tick: !!document.querySelector('.scv-tick-img') }
  })()`)
  check('B5 升级预览：勾选后名字绿 + 数值升级（6→9）', bUp?.green === 'rgb(127, 255, 0)' && /9/.test(String(bUp?.desc)) && !/造成 6/.test(String(bUp?.desc)), JSON.stringify(bUp).slice(0, 200))

  // 检视开着时右键另一张卡：不切换（isPopupOpen 屏蔽）
  const r2 = rightClick('[data-inspect="bash"]')
  await sleep(350)
  const bHold = evJson(`(() => { const name = document.querySelector('[data-scv="name"]'); return { name: name ? name.textContent.trim() : null, stillOpen: !!document.querySelector('.scv-backdrop') } })()`)
  check('B6 检视开着时右键不切换（原版 isPopupOpen 屏蔽输入）', bHold?.stillOpen === true && bHold?.name === '打击', JSON.stringify(bHold).slice(0, 120))

  // Esc 关闭
  ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
  await sleep(400)
  const bEsc = evJson(`(() => { const g = window.__sts.getState(); return { closed: !document.querySelector('.scv-backdrop'), screen: g.run ? g.run.screen : null } })()`)
  check('B7 Esc 关闭 → 层消失、奖励屏仍在', bEsc?.closed === true && bEsc?.screen === 'reward', JSON.stringify(bEsc).slice(0, 120))

  // 关闭后重开另一张（inspectExtra 清空可重开）
  const r3 = rightClick('[data-inspect="bash"]')
  await sleep(400)
  const bRe = evJson(`(() => { const name = document.querySelector('[data-scv="name"]'); return { open: !!document.querySelector('.scv-backdrop'), name: name ? name.textContent.trim() : null } })()`)
  check('B8 关闭后右键另一张 → 新检视（痛击）', bRe?.open === true && bRe?.name === '痛击', JSON.stringify(bRe).slice(0, 120))
  ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
  await sleep(350)

  // ===== C. 商店右键 =====
  console.log('-- C. 商店右键 --')
  mutateRun(`r => {
    r.combat = null; r.screen = 'shop'
    r.gold = 100; r.players[0].gold = 100
    r.shop = { cards: [{ cardId: 'strike', price: 40, sold: false, upgraded: false }, { cardId: 'bash', price: 45, sold: false, upgraded: false, discount: true }, { cardId: 'defend', price: 50, sold: false, upgraded: false }], relics: [{ relicId: 'anchor', price: 160, sold: false }], potions: [{ potionId: 'firePotion', price: 999, sold: false }], removalUsed: false, removalPrice: 75 }
  }`)
  await sleep(2400)
  const shopSel = MODE === 'next' ? '[data-inspect="bash"]' : '#shop-cards [data-sidx="1"]'
  const c1 = rightClick(shopSel)
  await sleep(450)
  const cIns = evJson(`(() => {
    const name = document.querySelector('[data-scv="name"]')
    return { open: !!document.querySelector('.scv-backdrop'), name: name ? name.textContent.trim() : null, arrows: document.querySelectorAll('.scv-arrow').length }
  })()`)
  check('C1 商店右键特卖卡 → 检视（痛击）无箭头 + preventDefault', cIns?.open === true && cIns?.name === '痛击' && cIns?.arrows === 0 && c1?.defaultPrevented === true, JSON.stringify({ c1, cIns: cIns?.name }).slice(0, 160))

  // 检视层上的右键：屏蔽但不切换
  const c2 = rightClick('.scv-backdrop')
  await sleep(300)
  const cHold = evJson(`(() => { const name = document.querySelector('[data-scv="name"]'); return { name: name ? name.textContent.trim() : null, open: !!document.querySelector('.scv-backdrop') } })()`)
  check('C2 检视层上右键被屏蔽且不切换（卡名不变）', cHold?.open === true && cHold?.name === '痛击' && c2?.defaultPrevented === true, JSON.stringify({ c2, cHold: cHold?.name }).slice(0, 160))

  // 售出卡也可检视（hoveredCard 不滤 sold）
  ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
  await sleep(350)
  mutateRun(`r => { r.shop.cards[0].sold = true }`)
  await sleep(600)
  const c3 = rightClick(MODE === 'next' ? '[data-inspect="strike"]' : '#shop-cards [data-sidx="0"]')
  await sleep(450)
  const cSold = evJson(`(() => {
    const name = document.querySelector('[data-scv="name"]')
    return { open: !!document.querySelector('.scv-backdrop'), name: name ? name.textContent.trim() : null }
  })()`)
  check('C3 售出卡右键也可检视（原版 hoveredCard 不滤 sold）', cSold?.open === true && cSold?.name === '打击' && c3?.defaultPrevented === true, JSON.stringify({ c3, cSold: cSold?.name }).slice(0, 160))

  // 关闭后左键购买正常（contextmenu 与 click 不冲突）
  ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
  await sleep(350)
  const buySel = MODE === 'next' ? '[data-inspect="bash"]' : '#shop-cards [data-sidx="1"]'
  ev(`(() => { const el = document.querySelector('${buySel}'); if (el) el.click(); return !!el })()`)
  await sleep(700)
  const cBuy = evJson(`(() => {
    const g = window.__sts.getState()
    const sold = g.run && g.run.shop ? g.run.shop.cards[1].sold : null
    const gold = g.run ? g.run.players[0].gold : null
    const deckN = g.run ? g.run.players[0].deck.length : null
    return { sold, gold, deckN, inspectOpen: !!document.querySelector('.scv-backdrop') }
  })()`)
  check('C4 关闭检视后左键购买正常（sold + 金币扣减 + 无检视残留）', cBuy?.sold === true && cBuy?.gold === 55 && cBuy?.inspectOpen === false, JSON.stringify(cBuy).slice(0, 160))

  // ===== D. 检视层上右键无浏览器菜单（空白处放行是浏览器行为，不作断言） =====
  console.log('-- D. 事件语义 --')
  // 再开一次检视 → 截图存档（VLM 素材）
  rightClick(buySel.replace('bash', 'defend').replace('"1"', '"2"'))
  await sleep(600)
  cli(['screenshot', `${SHOT}/reward_${MODE}_inspect.png`])
  const dShot = evJson(`(() => ({ open: !!document.querySelector('.scv-backdrop') }))()`)
  check('D1 检视态截图存档（VLM 素材）', dShot?.open === true)

  // 回奖励屏截一张
  // 回奖励屏复验（注意 RewardScreen 守卫要求 run.combat 非 null）
  ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
  await sleep(300)
  mutateRun(`r => {
    r.shop = null; r.screen = 'reward'
    r.combat = { isBoss: false, players: [{ drawPile: [] }], activeIdx: 0 }
    if (!r.reward) r.reward = { gold: 10, cards: ['strike', 'bash', 'defend'], taken: [] }
  }`)
  await sleep(2300)
  rightClick('[data-inspect="defend"]')
  await sleep(600)
  cli(['screenshot', `${SHOT}/shop_${MODE}_inspect.png`])
  const d2 = evJson(`(() => { const n = document.querySelector('[data-scv="name"]'); return { open: !!document.querySelector('.scv-backdrop'), name: n ? n.textContent.trim() : null } })()`)
  check('D2 奖励屏检视复验（防御）', d2?.open === true && d2?.name === '防御', JSON.stringify(d2).slice(0, 120))
  ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
  await sleep(300)

  console.log(`== 结果: ${pass} 通过, ${fail} 失败 ==`)
  process.exit(fail ? 1 : 0)
}

function cli(args: string[]): string {
  try { return execFileSync('agent-browser', args, { encoding: 'utf-8', timeout: 60000 }) }
  catch (e: any) { return 'ERR:' + (e.stdout || e.message || '').slice(0, 200) }
}

main().catch(e => { console.error(e); process.exit(1) })
