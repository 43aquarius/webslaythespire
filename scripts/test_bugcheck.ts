// 原bug清单回归验证（历经9-16批重构后确认无回退）
// ③药水/设置/全屏/音量按钮重合 ④菜单设置无响应 ⑤弹窗滚动条 ⑥联机房间码不显示
// ⑦手机遗物弹窗越界 ⑧旋转按钮180度 + HUD左上角78/80样式 + 主菜单文字清理
// 用法: npx tsx scripts/test_bugcheck.ts [next|standalone]
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

const STAGE_SEL = MODE === 'next' ? '[data-stage]' : '#stage'
const RELIC_SEL = MODE === 'next' ? '.top-hud .sts-relic' : '.hud-relics .relic[data-tip]'
// ev 内通用：去全部空白(含全角)的规范化函数（无反斜杠构造）
const NORM = `[...(s||'')].filter(c=>c.trim()!=='').join('')`

async function openAndWait(): Promise<boolean> {
  cli(['open', URL])
  await sleep(4000)
  for (let i = 0; i < 30; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) return true
    if (i === 14) { cli(['open', URL]); await sleep(5000); continue }  // 空白页时重新导航(reload 在 about:blank 上无效)
    if (i % 6 === 5) console.log(`  [wait] ready=${ev("document.readyState")} btns=${ev("document.querySelectorAll('button').length")} title=${String(ev("document.title")).slice(0, 30)}`)
    await sleep(1000)
  }
  return ev(`typeof window.__sts === 'function'`) === true
}

/** 涅奥轮转直到地图 */
async function toMap() {
  ev(`window.__sts.getState().startRun('ironclad')`)
  await sleep(500)
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
  await sleep(2800)
}

/** ③ 按钮重合检查：右上控制簇 vs HUD（当前视口） */
function overlapCheck(tag: string) {
  const r = evJson(`(() => {
    const rect = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom } }
    const q = (s) => [...document.querySelectorAll(s)].filter(e => e.offsetParent !== null)
    const hudSel = ${MODE === 'next'
      ? `['.top-hud .rounded-full','#hud-gold','#hud-potions','.top-hud .flex-wrap', '#hud-deck-count']`
      : `['#hud-portrait','#hud-hp','#hud-gold','#hud-potions','#hud-relics','.deck-btn']`}
    const hud = hudSel.flatMap(s => [...document.querySelectorAll(s)]).filter(e => e.offsetParent !== null)
      .map(x => ({ name: x.id || String(x.className).slice(0, 12), ...rect(x) }))
    const ctrls = ['button[title="菜单 (Esc)"]','button[title="全屏"]','button[title*="旋转 180"]','button[title="音乐音量"]']
      .flatMap(s => q(s)).map(x => ({ name: (x.title||'').slice(0,6) || String(x.textContent).slice(0,4), ...rect(x) }))
    const inter = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t))
    const hits = []
    for (const c of ctrls) for (const h of hud) { const a = inter(c, h); if (a > 25) hits.push(c.name + '×' + h.name + '=' + Math.round(a) + 'px2') }
    return { nCtrl: ctrls.length, nHud: hud.length, hits, vw: innerWidth + 'x' + innerHeight }
  })()`)
  check(`③${tag}控制簇与HUD无重合(${r.nCtrl}btn×${r.nHud}hud@${r.vw})`, (r.hits || []).length === 0, JSON.stringify(r.hits || r).slice(0, 300))
}

/** HUD 78/80 红字 + 左上角布局（split('/') 无反斜杠校验） */
function hudCheck(tag: string) {
  const r = evJson(`(() => {
    const st = document.querySelector('${STAGE_SEL}')
    const sr = st ? st.getBoundingClientRect() : { left: 0, top: 0, right: innerWidth, bottom: innerHeight }
    ${MODE === 'next'
      ? `const hpEl = [...document.querySelectorAll('.top-hud span, .top-hud div')].find(e => e.children.length === 0 && (e.textContent||'').includes('/') && e.offsetParent !== null)`
      : `const hpEl = document.getElementById('hud-hp')`}
    const t = hpEl ? hpEl.textContent : ''
    const parts = t.split('/').map(s => s.trim())
    const hpTxt = parts.join('/')
    const hpOk = parts.length === 2 && /^[0-9]+$/.test(parts[0]) && /^[0-9]+$/.test(parts[1])
    const hpColEl = hpEl ? (hpEl.querySelector('.hp-num-val, .sts-num') || hpEl) : null
    const nums = hpColEl ? (getComputedStyle(hpColEl).color.match(/[0-9]+/g) || []).map(Number) : []
    const els = {}
    const put = (k, sel) => { const e = document.querySelector(sel); els[k] = e && e.offsetParent !== null ? (() => { const b = e.getBoundingClientRect(); return { x: b.left - sr.left, y: b.top - sr.top } })() : null }
    ${MODE === 'next'
      ? `put('portrait', '.top-hud .rounded-full'); put('gold', '#hud-gold'); put('potions', '#hud-potions')`
      : `put('portrait', '#hud-portrait'); put('gold', '#hud-gold'); put('potions', '#hud-potions')`}
    const stageW = sr.right - sr.left, stageH = sr.bottom - sr.top
    return { hpTxt, hpOk, hpRed: nums.length >= 2 ? (nums[0] > 200 && nums[1] <= 110) : false, els, stageW: Math.round(stageW), stageH: Math.round(stageH) }
  })()`)
  check(`${tag}血量为78/80红色样式`, r.hpOk === true && r.hpRed === true, `txt=${r.hpTxt} red=${r.hpRed}`)
  const e = r.els || {}
  const okPos = e.portrait && e.gold && e.potions
    && e.gold.x < r.stageW * 0.42 && e.potions.x < r.stageW * 0.42
    && e.portrait.y < r.stageH * 0.3 && e.potions.y < r.stageH * 0.38
  check(`${tag}血量/金币/药水全在左上角`, okPos === true, JSON.stringify(e).slice(0, 260))
}

/** 规范化空白后匹配可见按钮并点击 */
function clickBtn(re: RegExp): boolean {
  return ev(`(() => { const norm = s => ${NORM}; const b = [...document.querySelectorAll('button')].find(b => ${'/' + re.source + '/'}.test(norm(b.textContent)) && b.offsetParent !== null); if (b) { b.click(); return true } return false })()`)
}

async function main() {
  console.log(`== 模式: ${MODE} ==`)
  cli(['close'])
  await sleep(1200) // close 后浏览器重启竞态：立即 open 会得到空白页
  const ok0 = await openAndWait()
  check('store就绪', ok0 === true)
  if (!ok0) { console.log('!! 页面未就绪，中止'); process.exit(1) }
  console.log(`  (环境: hover:none=${ev(`matchMedia('(hover: none)').matches`)} — agent-browser 恒触屏,仅记录)`)

  // ========== ④ 主菜单设置 ==========
  console.log('== ④ 主菜单设置 ==')
  cli(['screenshot', `scripts/study/bugcheck/${MODE}_mainmenu.png`])
  const c1 = clickBtn(/^设置$/)
  await sleep(2300) // 房间过渡黑幕1.1s + 淡入，等新屏挂载
  const st1 = evJson(`(() => ({ ms: window.__sts.getState().menuScreen, rg: document.querySelectorAll('input[type=range]').length }))()`)
  console.log(`  [debug] click=${c1} state=${JSON.stringify(st1)}`)
  check('④设置面板打开(含range控件)', st1.ms === 'settings' && (st1.rg || 0) >= 1, JSON.stringify(st1).slice(0, 120))
  // 音量滑条（0-1刻度）：设 0.3
  const d1 = ev(`(() => {
    const inp = document.querySelector('input[type=range]')
    if (!inp) return 'no-range'
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, '0.3')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
    return 'ok'
  })()`)
  await sleep(500)
  const volAfter = ev(`(() => { const inp = document.querySelector('input[type=range]'); return inp ? inp.value : null })()`)
  check('④音量滑条响应(0.55→0.3)', String(volAfter) === '0.3', `dispatch=${d1} after=${volAfter}`)
  const lsAll = String(ev(`(() => { try { return JSON.stringify(localStorage) } catch { return '{}' } })()`) || '{}')
  check('④音量持久化(localStorage)', /0\.3/.test(lsAll.replace(/0\.55/g, '')), lsAll.slice(0, 140))
  const fsOk = clickBtn(/全屏/)
  await sleep(500)
  check('④全屏按钮可点击无崩溃', fsOk === true && ev(`1+1`) === 2)
  clickBtn(/返回/)
  await sleep(600)

  // ========== HUD 78/80 + ③（桌面） ==========
  console.log('== HUD 78/80 + ③重合 (桌面) ==')
  await toMap()
  check('到达地图', ev(`window.__sts.getState().run?.screen`) === 'map')
  hudCheck('桌面')
  overlapCheck('桌面')
  cli(['screenshot', `scripts/study/bugcheck/${MODE}_hud_desktop.png`])

  // ========== ⑤ 牌堆弹窗滚动条 ==========
  console.log('== ⑤ 牌堆弹窗 ==')
  ev(`(() => { const b = ${MODE === 'next' ? `document.querySelector('#hud-deck-count')?.closest('button')` : `document.querySelector('.deck-btn')`}; if (b) { b.click(); return true } return false })()`)
  await sleep(900)
  const pile = evJson(`(() => {
    const body = document.body, de = document.documentElement
    const frame = ${MODE === 'next' ? `document.querySelector('.sts-panel')` : `document.querySelector('.pile-wrap, .sts-panel')`}
    const st = window.__sts.getState()
    const open = ${MODE === 'next' ? `st.pileView === 'deck'` : `!!frame && document.body.innerText.includes('牌组')`}
    return { open, bsX: body.scrollWidth - de.clientWidth, bsY: body.scrollHeight - de.clientHeight,
      frame: frame ? { sh: frame.scrollHeight, ch: frame.clientHeight, sw: frame.scrollWidth, cw: frame.clientWidth } : null }
  })()`)
  console.log(`  [debug] ${JSON.stringify(pile).slice(0, 220)}`)
  check('⑤牌组弹窗打开', pile.open === true, JSON.stringify(pile).slice(0, 160))
  check('⑤无页面级滚动条', (pile.bsX || 0) <= 1 && (pile.bsY || 0) <= 1, JSON.stringify({ x: pile.bsX, y: pile.bsY }))
  check('⑤弹窗框无内部滚动条', !pile.frame || (pile.frame.sh <= pile.frame.ch + 2 && pile.frame.sw <= pile.frame.cw + 2), JSON.stringify(pile.frame))
  cli(['screenshot', `scripts/study/bugcheck/${MODE}_pile_modal.png`])
  ev(`(() => { const st = window.__sts.getState(); if (st.closePile) st.closePile(); return 0 })()`)
  await sleep(500)

  // ========== ⑥ 联机房间码 ==========
  console.log('== ⑥ 联机房间码 ==')
  ev(`(() => { const st = window.__sts.getState(); if (st.backToTitle) st.backToTitle(); return true })()`)
  await sleep(2800)
  const c2 = clickBtn(/联机合作|联机|合作/)
  console.log(`  [debug] 联机按钮点击=${c2}`)
  await sleep(2400) // 房间过渡
  const c3 = clickBtn(/创建房间|创建/)
  console.log(`  [debug] 创建按钮点击=${c3}`)
  let roomCode = '', lastNet = ''
  for (let i = 0; i < 24; i++) {
    await sleep(1000)
    const st = evJson(`(() => { const g = window.__sts.getState(); const n = g.net || {}; return { code: n.roomCode || '', status: n.status || '' } })()`)
    lastNet = JSON.stringify(st)
    if (st && st.code && /^[0-9A-Za-z]{4,6}$/.test(st.code)) { roomCode = st.code; break }
    if (i % 6 === 5) console.log(`  [debug] net=${lastNet.slice(0, 140)}`)
  }
  check('⑥房间码生成', /^[0-9A-Za-z]{4,6}$/.test(roomCode), `code=${roomCode || '(空)'} net=${lastNet.slice(0, 140)}`)
  if (roomCode) {
    const codeShown = evJson(`(() => {
      const els = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && e.offsetParent !== null)
      const hit = els.find(e => /^[0-9A-Za-z]{4,6}$/.test((e.textContent || '').trim()))
      return { shown: !!hit, txt: hit ? hit.textContent.trim() : '' }
    })()`)
    check('⑥房间码界面可见显示', codeShown.shown === true && codeShown.txt === roomCode, JSON.stringify(codeShown))
    const lobby = evJson(`(() => { const norm = s => ${NORM}; const t = norm(document.body.innerText); return { inLobby: t.includes('合作房间'), hasOurRoom: t.includes('${roomCode}') } })()`)
    check('⑥大厅界面+本房可见', lobby.inLobby === true && lobby.hasOurRoom === true, JSON.stringify(lobby))
  }
  cli(['screenshot', `scripts/study/bugcheck/${MODE}_roomcode.png`])
  clickBtn(/返回主菜单|离开/)
  await sleep(1500)

  // ========== ⑧ 旋转180度 + ⑦ 手机遗物tooltip ==========
  console.log('== ⑧旋转 + ⑦手机tooltip ==')
  cli(['set', 'device', 'iPhone 15'])
  await sleep(600)
  await openAndWait()
  check('⑧触屏模式(hover:none)', ev(`matchMedia('(hover: none)').matches`) === true)
  const rotVisible = ev(`(() => { const b = document.querySelector('button[title*="旋转 180"]'); return b ? b.offsetParent !== null : false })()`)
  check('⑧旋转按钮触屏可见', rotVisible === true)
  if (rotVisible) {
    cli(['click', 'button[title*="旋转 180"'])
    await sleep(400)
    const t1 = ev(`(() => { const s = document.querySelector('${STAGE_SEL}'); return s ? s.style.transform : '' })()`)
    check('⑧点击后画面旋转180度', t1.includes('rotate(180deg)'), t1)
    check('⑧状态持久化localStorage', ev(`localStorage.getItem('stsFlip180')`) === '1')
    await openAndWait()
    const t2 = ev(`(() => { const s = document.querySelector('${STAGE_SEL}'); return s ? s.style.transform : '' })()`)
    check('⑧重载后保持翻转(持久化生效)', t2.includes('rotate(180deg)'), t2)
    cli(['click', 'button[title*="旋转 180"'])
    await sleep(400)
    const t3 = ev(`(() => { const s = document.querySelector('${STAGE_SEL}'); return s ? s.style.transform : '' })()`)
    check('⑧再次点击恢复正向', !t3.includes('rotate(180deg)'), t3)
    check('⑧localStorage清除', ev(`localStorage.getItem('stsFlip180')`) !== '1')
  }

  // 手机 HUD + 遗物 tooltip
  await toMap()
  hudCheck('手机')
  overlapCheck('手机')
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.players[0].relics = ['anchor','bagOfPreparation']; window.__sts.setState({ run: r }); return true })()`)
  await sleep(600)
  const rc = evJson(`(() => { const el = document.querySelector('${RELIC_SEL}'); if (!el) return { found: false }; const b = el.getBoundingClientRect(); return { found: true, x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) } })()`)
  check('⑦遗物图标存在(注入2个)', !!rc && rc.found === true, JSON.stringify(rc).slice(0, 120))
  if (rc && rc.found) {
    cli(['mouse', 'move', String(rc.x), String(rc.y)])
    let tip: any = { found: false }
    for (let i = 0; i < 8; i++) {
      await sleep(200)
      tip = evJson(`(() => {
        ${MODE === 'next'
          ? `const cands = [...document.querySelectorAll('[class*="z-[300]"]')].filter(e => getComputedStyle(e).visibility !== 'hidden' && e.offsetWidth > 50)`
          : `const cands = [...document.querySelectorAll('.tooltip')].filter(e => getComputedStyle(e).display !== 'none')`}
        if (!cands.length) return { found: false }
        const b = cands[0].getBoundingClientRect()
        return { found: true, l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), btm: Math.round(b.bottom), vw: innerWidth, vh: innerHeight }
      })()`)
      if (tip.found) break
    }
    console.log(`  [debug] tooltip=${JSON.stringify(tip).slice(0, 200)}`)
    check('⑦手机遗物tooltip显示', tip.found === true, JSON.stringify(tip).slice(0, 200))
    if (tip.found) {
      const inside = tip.l >= -2 && tip.t >= -2 && tip.r <= tip.vw + 2 && tip.btm <= tip.vh + 2
      check('⑦tooltip钳制在屏幕内(不越界)', inside === true, JSON.stringify(tip))
    }
    ev(`(() => { const el = document.querySelector('${RELIC_SEL}'); if (!el) return false; el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true })); return true })()`)
    await sleep(300)
    const tip2 = evJson(`(() => {
      ${MODE === 'next'
        ? `const n = [...document.querySelectorAll('[class*="z-[300]"]')].filter(e => getComputedStyle(e).visibility !== 'hidden' && e.offsetWidth > 50).length`
        : `const n = [...document.querySelectorAll('.tooltip')].filter(e => getComputedStyle(e).display !== 'none').length`}
      return { found: n > 0 }
    })()`)
    check('⑦触屏轻点显示tooltip', tip2.found === true)
  }
  cli(['screenshot', `scripts/study/bugcheck/${MODE}_hud_mobile.png`])

  console.log(`\n== 结果[${MODE}]: ${pass} 通过 / ${fail} 失败 ==`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
