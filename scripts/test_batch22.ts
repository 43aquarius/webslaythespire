// 第二十二批测试：结束回合按钮原版化（topPanel 三态素材 + EndTurnButton.render 复刻 + 无可出牌发光语义）
// 用法: npx tsx scripts/test_batch22.ts [next|standalone]
import { execFileSync } from 'child_process'

const MODE = (process.argv[2] === 'standalone') ? 'standalone' : 'next'
const URL = MODE === 'next' ? 'http://localhost:3000/' : 'file:///home/z/my-project/download/slay-the-spire-standalone.html'
const BTNS = MODE === 'next' ? '.sts-endturn' : '#end-turn-btn'
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
    return { ok: true }
  })()`)
}
const btnInfo = () => evJson(`(() => {
  const b = document.querySelector('${BTNS}')
  if (!b) return { found: false }
  const txt = b.querySelector('.et-text')
  const plate = b.querySelector('.et-plate')
  const hov = b.querySelector('.et-hover')
  const cs = (el) => el ? getComputedStyle(el) : null
  const pcs = plate ? cs(plate) : null
  const tcs = txt ? cs(txt) : null
  return {
    found: true,
    cls: b.className, disabled: b.disabled,
    text: txt ? txt.textContent : null,
    textColor: tcs ? tcs.color : null,
    plateImg: MODE_PLACEHOLDER_NEVER,
    plateBg: pcs ? (pcs.backgroundImage || '').slice(0, 70) : null,
    plateSrc: plate && plate.tagName === 'IMG' ? plate.getAttribute('src') : null,
    plateFilter: pcs ? pcs.filter : null,
    hoverOpacity: hov ? cs(hov).opacity : null,
  }
})()`.replace('MODE_PLACEHOLDER_NEVER', 'null'))

async function main() {
  console.log(`== 第二十二批测试 [${MODE}] ==`)

  // ---------- 打开页面（资源检查需在页面打开后做相对 fetch） ----------
  cli(['open', URL])
  await sleep(3500)
  for (let i = 0; i < 12; i++) { if (ev(`typeof window.__sts === 'function'`) === true) break; await sleep(800) }

  // ---------- A. 资源可达 ----------
  console.log('-- A. 三态素材 --')
  if (MODE === 'next') {
    for (const k of ['button', 'hover', 'glow']) {
      const st = ev(`(async () => (await fetch('/assets/endturn/${k}.png')).status)()`)
      check(`A endturn/${k}.png HTTP 200`, st === 200, `status=${st}`)
    }
  } else {
    const a = evJson(`(() => { const A = window.ASSETS || {}; return { button: !!A['endturn/button.png'], hover: !!A['endturn/hover.png'], glow: !!A['endturn/glow.png'] } })()`)
    check('A 三态内联', a.button === true && a.hover === true && a.glow === true, JSON.stringify(a))
  }

  // ---------- 导航到战斗 ----------
  for (let i = 0; i < 10; i++) { if (ev(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('开 始'))`) === true) break; await sleep(400) }
  cli(['eval', `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('开 始')) && [...document.querySelectorAll('button')].find(b=>b.textContent.includes('开 始')).click()`])
  for (let i = 0; i < 10; i++) { if (ev(`[...document.querySelectorAll('button')].some(b=>/铁甲战士/.test(b.textContent))`) === true) break; await sleep(400) }
  cli(['eval', `[...document.querySelectorAll('button')].find(b=>/铁甲战士/.test(b.textContent)) && [...document.querySelectorAll('button')].find(b=>/铁甲战士/.test(b.textContent)).click()`])
  for (let i = 0; i < 10; i++) { if (ev(`[...document.querySelectorAll('button')].some(b=>/出\\s*发/.test(b.textContent))`) === true) break; await sleep(400) }
  for (let attempt = 0; attempt < 3; attempt++) {
    cli(['eval', `[...document.querySelectorAll('button')].find(b=>/出\\s*发/.test(b.textContent)) && [...document.querySelectorAll('button')].find(b=>/出\\s*发/.test(b.textContent)).click()`])
    for (let i = 0; i < 6; i++) { if (ev(`!!window.__sts.getState().run`) === true) break; await sleep(500) }
    if (ev(`!!window.__sts.getState().run`) === true) break
    await sleep(800)
  }
  for (let i = 0; i < 14 && ev(`window.__sts.getState().run?.screen`) !== 'map'; i++) {
    const j = evJson(`(() => { const g = window.__sts.getState(); return JSON.stringify({ screen: g.run?.screen, sel: g.select ? g.select.kind : null, uids: g.select?.cardUids?.slice(0, 2) }) })()`)
    if (j.screen === 'map' && !j.sel) break
    if (j.screen === 'neow') ev(`window.__sts.getState().chooseNeow(1)`)
    if (j.sel && Array.isArray(j.uids) && j.uids.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(j.uids[0])})`)
    await sleep(700)
  }
  await sleep(2400)
  const nodeSel = MODE === 'next' ? ".sts-map-node.sts-map-pulse" : "#map-nodes .node.reach"
  for (let i = 0; i < 14; i++) {
    const c = ev(`(() => { const el=document.querySelector('${nodeSel}[data-ntype=monster]')||document.querySelector('${nodeSel}'); if(!el) return 'n/a'; el.click(); return 'go' })()`)
    if (c === 'go') break
    await sleep(450)
  }
  for (let i = 0; i < 14; i++) { if (ev(`window.__sts.getState().run?.screen`) === 'combat') break; await sleep(450) }
  await sleep(2600) // 战斗屏挂载+过渡
  check('导航: 进入战斗', ev(`window.__sts.getState().run?.screen`) === 'combat', `screen=${ev(`window.__sts.getState().run?.screen`)}`)

  // ---------- B. 基础态 ----------
  console.log('-- B. 基础态 --')
  await sleep(600)
  const base = btnInfo()
  check('B1 按钮存在+三子层', base.found === true && base.text !== null && base.hoverOpacity !== null
    && (base.plateBg !== null || base.plateSrc !== null), JSON.stringify({ ...base, plateSrc: (base.plateSrc || '').slice(0, 30) }))
  check('B2 基础态无状态类', /glow/.test(base.cls) === false && /enemy/.test(base.cls) === false && /off/.test(base.cls) === false, `cls=${base.cls}`)
  check('B3 文案=结束回合', base.text === '结束回合', `text=${base.text}`)
  check('B4 文字奶白色CREAM', base.textColor === 'rgb(255, 246, 226)', `color=${base.textColor}`)
  const plateOk = MODE === 'next'
    ? /endturn\/button\.png/.test(base.plateBg || '')
    : /data:image\/png/.test(base.plateSrc || '')
  check('B5 常态板=button.png', plateOk === true, MODE === 'next' ? `bg=${base.plateBg}` : `src=${(base.plateSrc || '').slice(0, 40)}`)
  check('B6 悬停层初始透明', base.hoverOpacity === '0', `op=${base.hoverOpacity}`)

  // ---------- C. 悬停态（agent-browser 原生 hover） ----------
  console.log('-- C. 悬停态 --')
  cli(['hover', BTNS])
  await sleep(400)
  const hov = btnInfo()
  check('C1 悬停亮轮廓显现', hov.hoverOpacity === '1', `op=${hov.hoverOpacity}`)
  check('C2 悬停文字CYAN', hov.textColor === 'rgb(0, 255, 255)', `color=${hov.textColor}`)
  // 移开鼠标（悬到别的元素）
  cli(['hover', MODE === 'next' ? '.sts-map-node, body' : '#hud-potions, body'])
  await sleep(350)
  const unhov = btnInfo()
  check('C3 移开恢复', unhov.hoverOpacity === '0' && unhov.textColor === 'rgb(255, 246, 226)', `op=${unhov.hoverOpacity} color=${unhov.textColor}`)

  // ---------- D. 发光态（能量清零→手牌无可出牌） ----------
  console.log('-- D. 发光态 --')
  mutateRun(`r => { const c = r.combat; c.players[c.activeIdx].energy = 0 }`)
  await sleep(700)
  const glow = btnInfo()
  check('D1 glow类生效', /glow/.test(glow.cls) === true, `cls=${glow.cls}`)
  check('D2 文字金色GOLD', glow.textColor === 'rgb(239, 200, 81)', `color=${glow.textColor}`)
  if (MODE === 'next') {
    check('D3 发光板=glow.png', /endturn\/glow\.png/.test(glow.plateBg || ''), `bg=${glow.plateBg}`)
  } else {
    check('D3 发光板src已切换', (glow.plateSrc || '') !== (base.plateSrc || ''), 'src未变化')
  }
  // 恢复能量 → 发光消失
  mutateRun(`r => { const c = r.combat; c.players[c.activeIdx].energy = 3 }`)
  await sleep(700)
  const ung = btnInfo()
  check('D4 恢复能量后发光消失', /glow/.test(ung.cls) === false, `cls=${ung.cls}`)
  check('D5 板回button.png', MODE === 'next'
    ? /endturn\/button\.png/.test(ung.plateBg || '')
    : (ung.plateSrc || '') === (base.plateSrc || ''), `bg=${ung.plateBg}`)

  // ---------- E. 敌方回合（灰度）——浏览器内采样（外部轮询exec往返太慢，会错过短窗口） ----------
  console.log('-- E. 敌方回合 --')
  ev(`(() => {
    window.__etE = { cls: [], caught: false, filter: null, text: null, plateSwitched: null }
    const btn = document.querySelector('${BTNS}')
    const int = setInterval(() => {
      if (!btn) return
      window.__etE.cls.push(btn.className)
      const ph = window.__sts.getState().run?.combat?.phase
      if (ph === 'enemy' && !window.__etE.caught) {
        window.__etE.caught = true
        const plate = btn.querySelector('.et-plate')
        const txt = btn.querySelector('.et-text')
        window.__etE.filter = plate ? getComputedStyle(plate).filter : null
        window.__etE.text = txt ? txt.textContent : null
        window.__etE.plateBg = plate ? (getComputedStyle(plate).backgroundImage || '').slice(0, 70) : null
        window.__etE.plateSrc = plate && plate.tagName === 'IMG' ? plate.getAttribute('src') : null
      }
    }, 40)
    setTimeout(() => clearInterval(int), 6000)
    window.__sts.getState().endTurn()
    return 'ok'
  })()`)
  await sleep(6500)
  const e = evJson(`window.__etE || {}`)
  check('E1 enemy类捕获', (e.cls || []).some((c: string) => /(^| )enemy/.test(c)), JSON.stringify((e.cls || []).slice(0, 4)))
  check('E2 敌方回合灰度板', e.caught === true && /grayscale/.test(e.filter || ''), `filter=${e.filter}`)
  check('E3 文案=敌方回合', e.caught === true && e.text === '敌方回合…', `text=${e.text}`)
  // 等回玩家回合恢复
  for (let i = 0; i < 20; i++) { if (ev(`window.__sts.getState().run?.combat?.phase`) === 'player') break; await sleep(400) }
  const back = btnInfo()
  check('E4 回玩家回合恢复常态', /enemy/.test(back.cls) === false && back.plateFilter === 'none', `cls=${back.cls} filter=${back.plateFilter}`)

  console.log(`\n== 结果: ${pass} 通过, ${fail} 失败 ==`)
  if (fail > 0) process.exit(1)
  try { cli(['close']); await sleep(1500); cli(['open', 'about:blank']) } catch {}
}

main().catch(e => { console.error('FATAL', e); process.exit(2) })
