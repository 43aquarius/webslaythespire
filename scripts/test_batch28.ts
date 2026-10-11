// 第二十八批测试：原版 ZHS 默认字体 NotoSansMonoCJKsc（FontHelper.java 权威考证）
// 断言基准：ZHS 全部文字统一 NotoSansMonoCJKsc-Regular（黑体等宽，ASCII 半宽 2:1）；
//           SourceHanSerifSC 系 ZHS_BOLD_FONT 死常量（原版从未引用）→ 弃用；
//           Kreon 仅 ENG 路线 → 中文站主链不引用。
// 用法: npx tsx scripts/test_batch28.ts [next|standalone]
import { execFileSync } from 'child_process'
import * as fs from 'fs'

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
  try { return JSON.parse(r) } catch { return { err: String(r).slice(0, 500) } }
}
let pass = 0, fail = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${detail}`) }
}

async function main() {
  console.log(`== 第二十八批测试 [${MODE}] ==`)
  cli(['open', URL])
  await sleep(3500)
  for (let i = 0; i < 12; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(800)
  }
  check('store就绪', ev(`typeof window.__sts === 'function'`) === true)

  // ===== A. 资产层 =====
  console.log('-- A. 资产层（NotoSansMonoCJKsc 子集 woff2 / 旧宋体弃用） --')
  if (MODE === 'next') {
    const r = evJson(`(async () => {
      const names = ['NotoSansMonoCJKsc-Regular.woff2']
      const res = await Promise.all(names.map(async n => {
        const resp = await fetch('/assets/fonts/' + n)
        if (!resp.ok) return { n, status: resp.status }
        const buf = new Uint8Array(await resp.arrayBuffer()).subarray(0, 4)
        const magic = String.fromCharCode(...buf)
        return { n, status: resp.status, magic }
      }))
      const old = await fetch('/assets/fonts/SourceHanSerifSC-Bold.woff2')
      return { res, oldStatus: old.status }
    })()`)
    const f = (r.res || [])[0] || {}
    check('A1 NotoSansMonoCJKsc-Regular.woff2 可达(200)', f.status === 200, JSON.stringify(r).slice(0, 200))
    check('A2 woff2 magic 头(wOF2)', f.magic === 'wOF2', `magic=${f.magic}`)
    check('A3 旧 SourceHanSerifSC-Bold.woff2 404 弃用', r.oldStatus === 404, `status=${r.oldStatus}`)
    // next/font @font-face 注入检查（localFont 派生族名 zhMonoFont + Fallback）
    const ff = ev(`[...document.fonts].map(f => f.family).join('|')`)
    check('A4 @font-face 族名含 zhMonoFont(next/font派生)', String(ff).includes('zhMonoFont'), String(ff).slice(0, 150))
  } else {
    const html = fs.readFileSync('/home/z/my-project/download/slay-the-spire-standalone.html', 'utf-8')
    const hasFace = /@font-face\{font-family:'NotoSansMonoCJKsc'/.test(html)
    const b64 = /font-family:'NotoSansMonoCJKsc';font-weight:400;[^}]*url\(data:font\/woff2;base64,d09GM[kg]/.test(html)
    const oldSerif = /@font-face\{font-family:'SourceHan Serif SC'/.test(html)
    check('A1 @font-face NotoSansMonoCJKsc 注入', hasFace)
    check('A2 base64 woff2 内联(d09GM[kg]=wOF2, TTF/OTF 两载体的合法头)', b64)
    check('A3 旧 SourceHan Serif SC @font-face 清零', !oldSerif)
    const ff = ev(`[...document.fonts].map(f => f.family).join('|')`)
    check('A4 document.fonts 含 NotoSansMonoCJKsc', String(ff).includes('NotoSansMonoCJKsc'), String(ff).slice(0, 150))
  }

  // ===== B. 等宽特征（NotoSansMonoCJKsc 数学铁证：ASCII 全等宽 + CJK:ASCII = 2:1 半宽） =====
  console.log('-- B. 等宽特征（区分 mono 与旧 serif） --')
  await ev(`document.fonts.ready.then(() => 'ok')`)
  await sleep(300)
  const mq = evJson(`(() => {
    const c = document.createElement('canvas')
    const ctx = c.getContext('2d')
    ctx.font = '32px ' + getComputedStyle(document.body).fontFamily
    const w = s => ctx.measureText(s).width
    const i4 = w('iiii'), m4 = w('MMMM'), han2 = w('永永'), mm = w('MM')
    return { i4, m4, han2, mm, font: ctx.font.slice(0, 60) }
  })()`)
  check('B1 ASCII 等宽(iiii≈MMMM)', mq.i4 > 0 && Math.abs(mq.i4 - mq.m4) < 1.5, JSON.stringify(mq).slice(0, 160))
  check('B2 CJK:ASCII=2:1 半宽(永永≈2×MM)', mq.mm > 0 && Math.abs(mq.han2 - 2 * mq.mm) < 1.5, `han2=${mq.han2} 2*MM=${2 * mq.mm}`)

  // ===== C. 计算样式（游戏全局 + 战斗内元素，无旧 serif 残留） =====
  console.log('-- C. 计算样式（serif 清零） --')
  const cs = evJson(`(() => {
    const gs = el => el ? getComputedStyle(el).fontFamily : null
    const body = gs(document.body)
    const title = gs(document.querySelector('.sts-title, .act-name'))
    const anyEl = gs(document.querySelector('.tp-name b, .hp-num-val, button, .menu-btn'))
    const all = [body, title, anyEl].filter(Boolean).join(' ;; ')
    return { body, title, anyEl, hasSerif: /SourceHanSerif|Source Han Serif|Noto Serif|STSong|SimSun/.test(all) }
  })()`)
  const famOk = (s: string | null) => !!s && /NotoSansMonoCJKsc|Noto Sans Mono/i.test(s)
  check('C1 body fontFamily 为 mono 链', famOk(cs.body), String(cs.body).slice(0, 120))
  check('C2 标题/按钮 fontFamily 为 mono 链', famOk(cs.anyEl), String(cs.anyEl).slice(0, 120))
  check('C3 全局无旧 serif 族残留', cs.hasSerif === false, JSON.stringify(cs).slice(0, 200))

  // ===== D. 战斗内文字渲染（卡面文字继承 mono + 字体加载完成） =====
  console.log('-- D. 战斗内渲染 --')
  ev(`(() => { const g = window.__sts.getState(); g.startRun('ironclad'); const r = JSON.parse(JSON.stringify(g.getState().run)); r.screen = 'map'; window.__sts.setState({ run: r }); return 'ok' })()`)
  await sleep(2400)
  ev(`(() => {
    const g = window.__sts.getState(), r = g.run
    const reach = r.currentNodeId ? r.map.nodes[r.currentNodeId].edges : r.map.startNodes
    const n = reach.map(id => r.map.nodes[id]).find(n => n.type === 'monster') || reach.map(id => r.map.nodes[id]).find(n => n.type !== 'boss')
    if (n) g.chooseNode(n.id)
    return 'ok'
  })()`)
  await sleep(2000)
  const d = evJson(`(() => {
    const loaded = [...document.fonts].filter(f => f.status === 'loaded').length
    const errs = [...document.fonts].filter(f => f.status === 'error').map(f => f.family)
    // 手牌卡名/描述元素（Next: .sts-card 内 span；standalone: .card-name/.card-desc）
    const cardEl = document.querySelector('.card-name, .sts-card span, [class*=card-name]')
    const descEl = document.querySelector('.card-desc, [class*=desc]')
    const monoOk = el => { if (!el) return null; const f = getComputedStyle(el).fontFamily; return /NotoSansMonoCJKsc|Noto Sans Mono/i.test(f) }
    return { loaded, errs, card: monoOk(cardEl), desc: monoOk(descEl), cardText: cardEl ? cardEl.textContent.slice(0, 20) : null }
  })()`)
  check('D1 @font-face 全部加载成功(error=0)', d.loaded > 0 && (d.errs || []).length === 0, `loaded=${d.loaded} errs=${JSON.stringify(d.errs).slice(0, 120)}`)
  check('D2 卡面文字 mono 继承', d.card === true || d.desc === true, JSON.stringify(d).slice(0, 160))

  // ===== E. 截图存档（VLM 验收用） =====
  fs.mkdirSync('/tmp/font_pilot', { recursive: true })
  cli(['screenshot', `/tmp/font_pilot/b28_${MODE}.png`])
  check('E1 战斗截图存档', fs.existsSync(`/tmp/font_pilot/b28_${MODE}.png`))

  console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}
main()
