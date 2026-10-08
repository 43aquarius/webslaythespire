// 第十五批单文件版验证：房间过渡/点状路径/节点脉冲/玩家标记/墨迹/图例/事件打字机
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
async function waitScreen(target: string, tries = 20) {
  for (let i = 0; i < tries; i++) {
    if (ev(`window.__sts.getState().run?.screen`) === target) return true
    await sleep(600)
  }
  return false
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

  // ===== ① 房间过渡 =====
  ev(`window.__sts.getState().startRun('ironclad')`)
  await sleep(500)
  const fadeOut = evJson(`(() => {
    const el = document.querySelector('.room-fade')
    if (!el) return { exists: false }
    const sweep = el.querySelector('.rf-sweep')
    const black = el.querySelector('.rf-black')
    const cs = sweep ? getComputedStyle(sweep) : null
    const cb = black ? getComputedStyle(black) : null
    return { exists: true, cls: el.className,
      sweepAnim: cs ? cs.animationName + ' ' + cs.animationDuration + ' ' + cs.animationDelay : null,
      blackAnim: cb ? cb.animationName + ' ' + cb.animationDuration + ' ' + cb.animationDelay : null }
  })()`)
  check('①过渡黑幕出现(out)', fadeOut.exists === true && /out/.test(fadeOut.cls || ''), JSON.stringify(fadeOut))
  check('①软边扫落+平黑淡入', /sts-room-sweep/.test(fadeOut.sweepAnim || '') && /sts-room-black-out/.test(fadeOut.blackAnim || ''), `s=${fadeOut.sweepAnim} b=${fadeOut.blackAnim}`)
  await waitScreen('neow')
  let fadeDone = false
  for (let i = 0; i < 8; i++) {
    const j = evJson(`(() => { const el = document.querySelector('.room-fade'); return { cls: el ? el.className : null, gone: !el } })()`)
    if ((j.cls && /in/.test(j.cls)) || j.gone) { fadeDone = true; break }
    await sleep(350)
  }
  check('①全黑后切换(in)', fadeDone === true)
  await sleep(1400)
  check('①黑幕最终移除', ev(`document.querySelector('.room-fade') === null`) === true)

  // ===== Neow → 地图 =====
  ev(`window.__sts.getState().chooseNeow(1)`)
  for (let i = 0; i < 12; i++) {
    const j = evJson(`(() => { const g = window.__sts.getState(); return JSON.stringify({ screen: g.run?.screen, sel: g.select ? g.select.kind : null, uids: g.select?.cardUids?.slice(0,2) }) })()`)
    if (j.screen === 'map' && !j.sel) break
    if (j.sel && Array.isArray(j.uids) && j.uids.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(j.uids[0])})`)
    await sleep(800)
  }
  await waitScreen('map')
  await sleep(2400)
  check('到达地图', ev(`window.__sts.getState().run?.screen`) === 'map')

  // ===== ② 点状路径 =====
  const dots = evJson(`(() => {
    const els = [...document.querySelectorAll('#map-dots .map-dot')]
    const svg = document.getElementById('map-edges')
    return { total: els.length, edges: new Set(els.map(e => e.dataset.edge)).size, svgGone: !svg }
  })()`)
  check('②点状路径渲染(>60朵/多边)', dots.total > 60 && dots.edges > 20, JSON.stringify(dots))
  check('②SVG旧虚线已移除', dots.svgGone === true)

  // ===== ③ 节点脉冲 + Boss =====
  const pulse = evJson(`(() => {
    const el = document.querySelector('#map-nodes .node.reach')
    const boss = document.querySelector('#map-nodes .node[data-ntype="boss"]')
    return {
      found: !!el,
      anim: el ? getComputedStyle(el).animationName : null,
      dur: el ? getComputedStyle(el).animationDuration : null,
      bossAnim: boss ? getComputedStyle(boss).animationName : null,
    }
  })()`)
  check('③可达节点脉冲动画', pulse.found === true && pulse.anim === 'sts-map-node-pulse', JSON.stringify(pulse))
  check('③脉冲周期1.571s', /1\.571s/.test(pulse.dur || ''), `dur=${pulse.dur}`)
  check('③Boss节点不脉冲', pulse.bossAnim === 'none', `bossAnim=${pulse.bossAnim}`)

  // ===== ⑤ 墨迹 + 选点（DOM点击，走事件委托） =====
  const clicked = ev(`(() => {
    const el = document.querySelector('#map-nodes .node.reach:not([data-ntype="boss"])')
    if (!el) return 'noreach'
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return 'clicked'
  })()`)
  check('⑤点击可达节点', clicked === 'clicked', clicked)
  await sleep(280)
  const ink = evJson(`(() => {
    const dots = [...document.querySelectorAll('#map-dots .map-dot')]
    const sel = document.querySelector('#map-nodes .node.map-select')
    return { screen: window.__sts.getState().run?.screen, hasSelect: !!sel }
  })()`)
  check('⑤选中态+延迟跳转', ink.hasSelect === true && ink.screen === 'map', JSON.stringify(ink))
  let combatOk = false
  for (let i = 0; i < 15; i++) {
    if (ev(`window.__sts.getState().run?.screen`) === 'combat') { combatOk = true; break }
    await sleep(600)
  }
  check('⑤延迟后进入战斗', combatOk === true)
  await sleep(2300)

  // ===== ④ 玩家标记（注入回地图） =====
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.screen = 'map'; window.__sts.setState({ run: r }); return 'ok' })()`)
  await waitScreen('map')
  await sleep(2400)
  const marker = evJson(`(() => {
    const m = document.querySelector('#map-marker-holder .map-marker')
    if (!m) return { found: false }
    const cs = getComputedStyle(m)
    const img = m.querySelector('img')
    return { found: true, anim: cs.animationName, hasImg: !!img && img.src.length > 10, top: m.style.top }
  })()`)
  check('④玩家标记渲染', marker.found === true, JSON.stringify(marker))
  check('④标记入场动画', marker.anim === 'sts-map-marker-in', `anim=${marker.anim}`)
  check('④标记为角色头像', marker.hasImg === true, `hasImg=${marker.hasImg}`)
  check('④标记在节点上方(-62px)', /62px/.test(marker.top || ''), `top=${marker.top}`)

  // ===== ⑤b 第二次选点墨迹（DOM点击，currentNodeId 已设） =====
  ev(`(() => {
    const el = [...document.querySelectorAll('#map-nodes .node.reach')].find(n => n.dataset.ntype !== 'boss')
    if (!el) return 'noreach'
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return 'clicked'
  })()`)
  await sleep(280)
  const ink2 = evJson(`(() => {
    const dots = [...document.querySelectorAll('#map-dots .map-dot.traveled')]
    const delayed = dots.filter(d => d.style.transitionDelay)
    const delays = delayed.map(d => parseFloat(d.style.transitionDelay) || 0)
    return { delayed: delayed.length, max: delays.length ? Math.max(...delays) : null }
  })()`)
  check('⑤b墨迹逐朵点亮(带延迟)', ink2.delayed >= 3, JSON.stringify(ink2))
  check('⑤b墨迹延迟≤0.56s', ink2.max !== null && ink2.max > 0.02 && ink2.max <= 0.56, `max=${ink2.max}`)
  for (let i = 0; i < 15; i++) {
    if (ev(`window.__sts.getState().run?.screen`) === 'combat') break
    await sleep(600)
  }
  await sleep(2300)
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.screen = 'map'; window.__sts.setState({ run: r }); return 'ok' })()`)
  await waitScreen('map')
  await sleep(2400)

  // ===== ⑥ 图例（原生悬停） =====
  const legend = evJson(`(() => {
    const lg = document.querySelector('.map-legend')
    const items = lg ? [...lg.querySelectorAll('.lg-item')] : []
    return { found: !!lg, n: items.length }
  })()`)
  check('⑥图例渲染(6项)', legend.found === true && legend.n === 6, JSON.stringify(legend))
  try { execFileSync('agent-browser', ['hover', '[data-ltype="monster"]'], { encoding: 'utf-8', timeout: 30000 }) } catch { }
  await sleep(350)
  const hot = evJson(`(() => {
    const nodes = [...document.querySelectorAll('#map-nodes .node.map-hover')]
    return { n: nodes.length, types: [...new Set(nodes.map(n => n.dataset.ntype))].join(',') }
  })()`)
  check('⑥悬停高亮同类节点', hot.n > 0 && hot.types === 'monster', JSON.stringify(hot))

  // ===== ⑦ 事件打字机 =====
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.players[0].gold = 10; r.currentEvent = 'cleric'; r.screen = 'event'; window.__sts.setState({ run: r }); return 'ok' })()`)
  await waitScreen('event')
  await sleep(2300)
  const evMid = evJson(`(() => {
    const shown = document.getElementById('ev-shown')
    const rest = document.getElementById('ev-rest')
    const title = document.querySelector('.ev-title')
    const opts = [...document.querySelectorAll('.ev-opt')]
    const locked = document.querySelector('.ev-opt.dis')
    return {
      shownLen: shown ? shown.textContent.length : 0,
      restLen: rest ? rest.textContent.length : 0,
      titleAnim: title ? getComputedStyle(title).animationName : null,
      optN: opts.length,
      optAnim: opts[0] ? getComputedStyle(opts[0]).animationName : null,
      delays: opts.map(o => o.style.animationDelay).join(','),
      lockedFilter: locked ? getComputedStyle(locked).filter : null,
    }
  })()`)
  check('⑦打字机进行中(部分字符)', evMid.shownLen > 0 && evMid.restLen > 0, `shown=${evMid.shownLen} rest=${evMid.restLen}`)
  check('⑦标题淡入', evMid.titleAnim === 'sts-ev-title-in', `anim=${evMid.titleAnim}`)
  check('⑦选项滑入动画', evMid.optN >= 2 && evMid.optAnim === 'sts-ev-opt-in', `n=${evMid.optN} anim=${evMid.optAnim}`)
  check('⑦选项错峰延迟', /0\.5s,0\.7s/.test(evMid.delays || ''), `delays=${evMid.delays}`)
  check('⑦锁定选项红化', /hue-rotate\(173deg\)/.test(evMid.lockedFilter || ''), `filter=${evMid.lockedFilter}`)
  await sleep(1700)
  const done = evJson(`(() => {
    const shown = document.getElementById('ev-shown')
    const rest = document.getElementById('ev-rest')
    return { shown: shown ? shown.textContent.length : 0, rest: rest ? rest.textContent.length : 0 }
  })()`)
  check('⑦打字机完成(全字符)', done.rest === 0 && done.shown > 10, JSON.stringify(done))

  console.log(`\n== 结果: ${pass} 通过, ${fail} 失败 ==`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
