// 第三十四批测试：主页贴图修复·对齐重放增量（角色选择屏TitleBackground常驻 + 原版高清Logo + 遗留素材清理）
// 背景：本会话沙箱基于过时第二十批，独立重做了等效主页修复(git show backup-batch25-redo)；
//      fetch 发现远端已含第21-32批与等效修复(4a81959/30ca950)，已 reset 对齐，
//      本批=在其上重放会话独有增量。断言基准：原版 TitleBackground 常驻渲染（charSelect 与主菜单同构）。
// 用法: npx tsx scripts/test_batch34.ts [next|standalone]
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

async function main() {
  console.log(`== 第三十四批测试: 对齐重放增量 [${MODE}] ==`)
  cli(['open', URL])
  await sleep(3500)
  for (let i = 0; i < 12; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(800)
  }
  check('store就绪', ev(`typeof window.__sts === 'function'`) === true)

  // ---------- A. 主菜单基线（沿用第三十三批结构，不受重放影响） ----------
  console.log('-- A. 主菜单基线 --')
  // mg3Top 断言：Next=路径匹配 / standalone=与 ASSETS['title/mg3Top.webp'] 全等
  const mg3topOk = evJson(`(() => {
    if (${MODE === 'standalone' ? `true` : `false`}) {
      const exp = (window.ASSETS || {})['title/mg3Top.webp'] || ''
      return { ok: !!exp && [...document.querySelectorAll('img')].some(im => im.src === exp && im.complete && im.naturalWidth > 0) }
    }
    const im = [...document.querySelectorAll('img[src*="mg3Top.webp"]')].find(i => i.complete && i.naturalWidth > 0)
    return { ok: !!im }
  })()`)
  const menu = evJson(`(() => ({
    clouds: document.querySelectorAll('.sts-cloud').length,
    glows: document.querySelectorAll('.sts-glow').length,
  }))()`)
  check('A1 主菜单18朵漂云', menu.clouds === 18, `n=${menu.clouds}`)
  check('A2 主菜单红光x2', menu.glows === 2, `n=${menu.glows}`)
  check('A3 主菜单mg3Top中景层(已加载)', mg3topOk.ok === true, JSON.stringify(mg3topOk))

  // ---------- B. 原版高清 Logo ----------
  console.log('-- B. 原版Logo --')
  const logo = evJson(`(() => { const l = document.querySelector('.menu-logo'); return l ? { w: l.naturalWidth, h: l.naturalHeight, ok: l.complete && l.naturalWidth > 0 } : null })()`)
  check('B1 原版eng.png高清Logo(680x550)', !!(logo && logo.w === 680 && logo.h === 550 && logo.ok), JSON.stringify(logo))

  // ---------- C. 角色选择屏 TitleBackground 常驻 ----------
  console.log('-- C. 角色选择屏 --')
  ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').replace(/\\s/g, '') === '开始冒险'); if (b) b.click(); return !!b })()`)
  await sleep(1200)
  for (let i = 0; i < 8; i++) {
    if (ev(`!!document.querySelector('.char-card, .char-stand')`) === true) break
    await sleep(500)
  }
  const cs = evJson(`(() => {
    const exp = (window.ASSETS || {})['title/mg3Top.webp'] || ''
    const mg3 = ${MODE === 'standalone'
      ? `!!exp && [...document.querySelectorAll('img')].some(im => im.src === exp && im.complete && im.naturalWidth > 0)`
      : `!![...document.querySelectorAll('img[src*="mg3Top.webp"]')].find(i => i.complete && i.naturalWidth > 0)`}
    return {
      char: !!document.querySelector('.char-card, .char-stand'),
      clouds: document.querySelectorAll('.sts-cloud').length,
      glows: document.querySelectorAll('.sts-glow').length,
      mg3top: mg3,
      shade: (() => { const s = document.querySelector('.shade') || document.querySelector('[style*="rgba(6"]'); return !!s })(),
    }
  })()`)
  check('C1 进入角色选择', cs.char === true, JSON.stringify(cs))
  check('C2 漂云常驻(18)', cs.clouds === 18, `n=${cs.clouds}`)
  check('C3 红光常驻(2)', cs.glows === 2, `n=${cs.glows}`)
  check('C4 mg3Top中景常驻(已加载)', cs.mg3top === true, JSON.stringify(cs))
  check('C5 压暗遮罩存在', cs.shade === true, JSON.stringify(cs))

  // 云动画实证（角色选择屏上云仍在漂移）
  const t1 = ev(`getComputedStyle(document.querySelector('.sts-cloud')).animationName`)
  const s1 = ev(`getComputedStyle(document.querySelector('.sts-cloud')).animationDuration`)
  check('C6 云层动画生效', typeof t1 === 'string' && t1.includes('drift') && typeof s1 === 'string' && s1 !== 'none' && s1 !== '0s', `${t1} ${s1}`)

  // 返回主菜单
  ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').replace(/\\s/g, '') === '返回'); if (b) b.click(); return !!b })()`)
  await sleep(900)
  check('C7 返回主菜单(结构无损)', ev(`document.querySelectorAll('.sts-cloud').length`) === 18 && ev(`document.querySelectorAll('.sts-glow').length`) === 2)

  // ---------- D. 遗留素材清理（仅Next: HTTP探测） ----------
  if (MODE === 'next') {
    console.log('-- D. 遗留素材清理 --')
    const probe = (u: string) => { try { return execFileSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', u], { encoding: 'utf-8', timeout: 15000 }).trim() } catch { return 'ERR' } }
    const legacy = ['mg2.png', 'mg3Bot.png', 'mg3Top.png', 'midCloud13.png', 'midCloud9.png', 'topCloud2.png', 'topCloud7.png']
    let gone = 0
    for (const f of legacy) if (probe(`http://localhost:3000/assets/title/${f}`) === '404') gone++
    check('D1 7张遗留png已删除(404)', gone === 7, `${gone}/7`)
  }

  console.log(`\n== 结果 [${MODE}]: ${pass} 通过, ${fail} 失败 ==`)
  if (fail > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
