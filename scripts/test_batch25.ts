// 第二十五批测试：类型行原版文字化（纯文字渲染/位置/颜色/字号 + 描述底端锚定 + wiki徽章弃用）
// 断言基准：原版 AbstractCard.renderType —— 卡中心下方22px(55.5% from top)、灰#595959、
//           cardTypeFont 17px/420；ZHS typeWidth=0.42<1.1 无动态框无图标
// 用法: npx tsx scripts/test_batch25.ts [next|standalone]
import { execFileSync } from 'child_process'

const MODE = (process.argv[2] === 'standalone') ? 'standalone' : 'next'
const URL = MODE === 'next' ? 'http://localhost:3000/' : 'file:///home/z/my-project/download/slay-the-spire-standalone.html'
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
const HAND_SEL = MODE === 'next' ? '.sts-hand-card' : '.hand-card'

async function main() {
  console.log(`== 第二十五批测试 [${MODE}] ==`)
  cli(['open', URL])
  await sleep(3500)
  for (let i = 0; i < 12; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(800)
  }
  check('store就绪', ev(`typeof window.__sts === 'function'`) === true)

  // ===== A. 类型行结构与样式（战斗手牌） =====
  console.log('-- A. 类型行纯文字化 --')
  // 开新局→地图→进普通战斗（monster 节点）
  ev(`(() => { const g = window.__sts.getState(); g.startRun('ironclad'); const r = JSON.parse(JSON.stringify(g.getState().run)); r.screen = 'map'; window.__sts.setState({ run: r }); return 'ok' })()`)
  await sleep(2400) // 过渡1.1s+挂载
  const entered = ev(`(() => {
    const g = window.__sts.getState(), r = g.run
    const reach = r.currentNodeId ? r.map.nodes[r.currentNodeId].edges : r.map.startNodes
    const n = reach.map(id => r.map.nodes[id]).find(n => n.type === 'monster') || reach.map(id => r.map.nodes[id]).find(n => n.type !== 'boss')
    if (!n) return 'nonode'
    g.chooseNode(n.id)
    return 'ok:' + n.id
  })()`)
  check('A0 进入战斗', String(entered).startsWith('ok'), String(entered))
  // 战斗屏挂载轮询（过渡1.1s）
  let handReady = false
  for (let i = 0; i < 10; i++) {
    handReady = ev(`!!document.querySelector('${HAND_SEL} .card-type-row')`) === true
    if (handReady) break
    await sleep(400)
  }
  check('A0b 手牌类型行挂载', handReady)

  const struct = evJson(`(() => {
    const rows = [...document.querySelectorAll('${HAND_SEL} .card-type-row')]
    const g = window.__sts.getState()
    const hand = (g.run.combat.players[g.run.combat.activeIdx].hand || []).map(c => c.id)
    const imgs = document.querySelectorAll('${HAND_SEL} .card-type-row img').length
    const typeiconsRefs = document.querySelectorAll('[src*="typeicons"], [style*="typeicons"]').length
    // 首卡：中位卡(奇数手牌 rot=0)
    const cards = [...document.querySelectorAll('${HAND_SEL}')]
    const mid = cards[Math.floor(cards.length / 2)]
    const cardRect = mid.getBoundingClientRect()
    const row = mid.querySelector('.card-type-row')
    const span = row.querySelector('span')
    const rowRect = row.getBoundingClientRect()
    const spanCs = getComputedStyle(span)
    // 描述文本块（Range 取内容联合矩形）
    const desc = mid.querySelector('.card-desc')
    const rng = document.createRange(); rng.selectNodeContents(desc)
    const descRect = rng.getBoundingClientRect()
    return {
      n: rows.length, imgs, typeiconsRefs, handIds: hand.slice(0, 8),
      texts: rows.slice(0, 8).map(r => (r.textContent || '').trim()),
      midIndex: Math.floor(cards.length / 2),
      // 类型行相对卡盒位置
      rowCenterPct: (rowRect.top + rowRect.height / 2 - cardRect.top) / cardRect.height,
      rowBottomPct: (rowRect.bottom - cardRect.top) / cardRect.height,
      color: spanCs.color, fontSize: parseFloat(spanCs.fontSize), cardW: mid.querySelector('.sts-card').offsetWidth,
      // 描述块
      descTopPct: (descRect.top - cardRect.top) / cardRect.height,
      descBottomPct: (descRect.bottom - cardRect.top) / cardRect.height,
      lineHeightRatio: parseFloat(spanCs.lineHeight) / parseFloat(getComputedStyle(desc).fontSize),
      descLH: parseFloat(getComputedStyle(desc).lineHeight) / parseFloat(getComputedStyle(desc).fontSize),
    }
  })()`)
  check('A1 类型行无图标img', struct.imgs === 0 && struct.typeiconsRefs === 0, `imgs=${struct.imgs} refs=${struct.typeiconsRefs}`)
  const EXPECT: Record<string, string> = { strike: '攻击', bash: '攻击', defend: '技能', perfectedStrike: '攻击' }
  const textOk = struct.texts.every((t: string) => ['攻击', '技能', '能力'].includes(t))
  const pairOk = struct.handIds.every((id: string, i: number) => {
    const exp = EXPECT[id]
    return !exp || (struct.texts[i] === exp)
  })
  check('A2 类型文案正确(攻击/技能/能力)', textOk && pairOk, `ids=${JSON.stringify(struct.handIds)} texts=${JSON.stringify(struct.texts)}`)
  check('A3 颜色原版灰#595959', /89,\s*89,\s*89/.test(String(struct.color)), String(struct.color))
  check('A4 位置≈55.5%卡高(52~59%)', struct.rowCenterPct >= 0.52 && struct.rowCenterPct <= 0.59, `center=${(struct.rowCenterPct * 100).toFixed(1)}%`)
  const fsRatio = struct.fontSize / struct.cardW
  check('A5 字号≈0.057×卡宽', fsRatio >= 0.049 && fsRatio <= 0.065, `ratio=${fsRatio.toFixed(4)}`)

  // ===== B. 描述底端锚定（原版 renderDescriptionCN 块不下侵类型行） =====
  console.log('-- B. 描述底端锚定 --')
  check('B1 类型行底<描述块顶(不重叠)', struct.rowBottomPct <= struct.descTopPct + 0.005, `rowBot=${(struct.rowBottomPct * 100).toFixed(1)}% descTop=${(struct.descTopPct * 100).toFixed(1)}%`)
  check('B2 描述块底端≈81%(78~84%)', struct.descBottomPct >= 0.78 && struct.descBottomPct <= 0.84, `descBot=${(struct.descBottomPct * 100).toFixed(1)}%`)
  check('B3 行距收紧1.15(1.08~1.22)', struct.descLH >= 1.08 && struct.descLH <= 1.22, `lh=${struct.descLH?.toFixed(3)}`)

  // ===== C. 4行长描述卡注入（描述块不得上侵类型行） =====
  console.log('-- C. 4行长描述卡 --')
  ev(`(() => {
    const g = window.__sts.getState(), r = g.run
    const p = r.combat.players[r.combat.activeIdx]
    p.hand.length = 0
    p.hand.push({ uid: 't25ps', id: 'perfectedStrike', upgraded: 0 })
    p.hand.push({ uid: 't25up', id: 'strike', upgraded: 1 })
    window.__sts.setState({ run: r })
    return 'ok'
  })()`)
  await sleep(900) // 手牌重渲染同步
  const longCard = evJson(`(() => {
    const cards = [...document.querySelectorAll('${HAND_SEL}')]
    // 找包含 t25ps/t25up 的卡（Next 无 data-cuid，按文本/序号：手牌2张，rot≈±2°）
    let ps = null, up = null
    for (const c of cards) {
      const txt = (c.querySelector('.card-name')||{}).textContent || ''
      if (txt.includes('完美打击') || txt.includes('Perfect')) ps = c
      if (txt.includes('打击') && !txt.includes('完美')) up = c
    }
    const out = (el) => {
      if (!el) return null
      const cardRect = el.getBoundingClientRect()
      const rowRect = el.querySelector('.card-type-row').getBoundingClientRect()
      const desc = el.querySelector('.card-desc')
      const rng = document.createRange(); rng.selectNodeContents(desc)
      const dRect = rng.getBoundingClientRect()
      return {
        name: (el.querySelector('.card-name')||{}).textContent || '',
        rowCenterPct: (rowRect.top + rowRect.height / 2 - cardRect.top) / cardRect.height,
        rowBottomPct: (rowRect.bottom - cardRect.top) / cardRect.height,
        descTopPct: (dRect.top - cardRect.top) / cardRect.height,
        descBottomPct: (dRect.bottom - cardRect.top) / cardRect.height,
        typeText: (el.querySelector('.card-type-row')||{}).textContent || '',
      }
    }
    return { ps: out(ps), up: out(up) }
  })()`)
  check('C1 长描述卡渲染', !!longCard?.ps, JSON.stringify(longCard?.ps || {}).slice(0, 120))
  if (longCard?.ps) {
    check('C2 4行卡不与类型行重叠', longCard.ps.rowBottomPct <= longCard.ps.descTopPct + 0.005,
      `rowBot=${(longCard.ps.rowBottomPct * 100).toFixed(1)}% descTop=${(longCard.ps.descTopPct * 100).toFixed(1)}%`)
    check('C3 4行卡描述块底端锚定', longCard.ps.descBottomPct >= 0.78 && longCard.ps.descBottomPct <= 0.84,
      `descBot=${(longCard.ps.descBottomPct * 100).toFixed(1)}%`)
  } else { fail += 2; console.log('  ✗ C2/C3 跳过（C1失败）') }
  check('C4 升级卡类型行不变(攻击/位置)', longCard?.up?.typeText?.trim() === '攻击' && longCard.up.rowCenterPct >= 0.52 && longCard.up.rowCenterPct <= 0.59,
    JSON.stringify(longCard?.up || {}).slice(0, 140))

  // ===== D. wiki徽章素材弃用 =====
  console.log('-- D. 素材弃用 --')
  if (MODE === 'next') {
    const st = await evJson(`(async () => { const r = await fetch('/assets/typeicons/attackCommon.png'); return { code: r.status } })()`)
    check('D1 typeicons 目录已移除(404)', st?.code === 404, JSON.stringify(st))
  } else {
    const keys = evJson(`(() => { const A = window.ASSETS || {}; return { any: Object.keys(A).some(k => k.startsWith('typeicons/')), count: Object.keys(A).length } })()`)
    check('D1 ASSETS 无 typeicons 内联', keys?.any === false, JSON.stringify(keys))
  }

  console.log(`\n== 结果: ${pass} 通过, ${fail} 失败 ==`)
  if (fail > 0) process.exit(1)
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
