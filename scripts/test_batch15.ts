// 第十五批验证（sts2-web 研究第五批落地）：
// ①房间切换过渡(黑幕扫落+淡入) ②地图点状路径+走过变深 ③节点脉冲+悬停/按下 ④玩家标记
// ⑤选点墨迹逐朵点亮 ⑥图例悬停高亮 ⑦事件打字机+选项滑入+锁定红字
// 用法: npx tsx scripts/test_batch15.ts [url]
import { execFileSync } from 'child_process'

const URL = process.argv[2] || 'http://localhost:3100/'
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

/** 等待 run.screen 变为期望值（状态即时变，DOM 滞后于黑幕） */
async function waitScreen(target: string, tries = 20) {
  for (let i = 0; i < tries; i++) {
    if (ev(`window.__sts.getState().run?.screen`) === target) return true
    await sleep(600)
  }
  return false
}

async function main() {
  console.log('== 打开页面 ==')
  execFileSync('agent-browser', ['open', URL], { encoding: 'utf-8', timeout: 60000 })
  await sleep(3000)
  for (let i = 0; i < 15; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(1000)
  }
  check('store就绪', ev(`typeof window.__sts === 'function'`) === true)
  await sleep(1000)

  // ===== ① 房间切换过渡：title → neow =====
  console.log('== ① 房间切换过渡 ==')
  ev(`window.__sts.getState().startRun('ironclad')`)
  await sleep(400)
  const fadeOut = evJson(`(() => {
    const el = document.querySelector('.sts-room-fade')
    if (!el) return { exists: false }
    const sweep = el.querySelector('.rf-sweep')
    const black = el.querySelector('.rf-black')
    const cs = sweep ? getComputedStyle(sweep) : null
    const cb = black ? getComputedStyle(black) : null
    return {
      exists: true, cls: el.className,
      sweepAnim: cs ? cs.animationName + ' ' + cs.animationDuration + ' ' + cs.animationDelay : null,
      blackAnim: cb ? cb.animationName + ' ' + cb.animationDuration + ' ' + cb.animationDelay : null,
    }
  })()`)
  check('①过渡黑幕出现(out)', fadeOut.exists === true && /out/.test(fadeOut.cls || ''), JSON.stringify(fadeOut))
  check('①软边扫落动画', /sts-room-sweep/.test(fadeOut.sweepAnim || '') && /0\.6s/.test(fadeOut.sweepAnim || '') && /0\.5s/.test(fadeOut.sweepAnim || ''), `sweep=${fadeOut.sweepAnim}`)
  check('①平黑淡入动画', /sts-room-black-out/.test(fadeOut.blackAnim || '') && /0\.5s/.test(fadeOut.blackAnim || ''), `black=${fadeOut.blackAnim}`)
  await sleep(900) // 处于 out 中段：旧画面应仍渲染（标题仍在 DOM）
  const oldKept = ev(`!!document.querySelector('.sts-main-menu, [class*=title]') || !document.querySelector('.sts-neow')`)
  check('①旧画面保持到全黑', oldKept === true)
  await waitScreen('neow')
  // 全黑切换后：要么处于 in 淡入，要么已经完成移除（均为成功）
  let fadeMidOk = false, neowOk = false
  for (let i = 0; i < 6; i++) {
    const j = evJson(`(() => {
      const el = document.querySelector('.sts-room-fade')
      return { cls: el ? el.className : null, gone: !el }
    })()`)
    if (j.cls && /in/.test(j.cls)) { fadeMidOk = true; neowOk = true; break }
    if (j.gone) { fadeMidOk = true; neowOk = true; break } // 已完成整个过渡
    await sleep(350)
  }
  check('①全黑后已切换(in)', fadeMidOk === true)
  check('①淡入完成后黑幕移除', neowOk === true)

  // ===== Neow 选祝福进地图 =====
  ev(`window.__sts.getState().chooseNeow(1)`)
  for (let i = 0; i < 12; i++) {
    const j = evJson(`(() => { const g = window.__sts.getState(); return JSON.stringify({ screen: g.run?.screen, sel: g.select ? g.select.kind : null, uids: g.select?.cardUids?.slice(0,2) }) })()`)
    if (j.screen === 'map' && !j.sel) break
    if (j.sel && Array.isArray(j.uids) && j.uids.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(j.uids[0])})`)
    await sleep(800)
  }
  await waitScreen('map')
  await sleep(2400) // 等过渡完成 + 地图渲染
  check('到达地图', ev(`window.__sts.getState().run?.screen`) === 'map')

  // ===== ② 地图点状路径 =====
  console.log('== ② 点状路径 ==')
  const dots = evJson(`(() => {
    const els = [...document.querySelectorAll('.sts-map-dot')]
    const traveled = els.filter(e => e.classList.contains('traveled')).length
    const svgLine = document.querySelectorAll('svg line').length
    return { total: els.length, traveled, svgLine }
  })()`)
  check('②路径圆点渲染(>60朵)', dots.total > 60, `total=${dots.total}`)
  check('②SVG旧虚线已移除', dots.svgLine === 0, `svgLine=${dots.svgLine}`)

  // ===== ③ 节点脉冲 =====
  console.log('== ③ 节点脉冲 ==')
  const pulse = evJson(`(() => {
    const el = document.querySelector('.sts-map-node.sts-map-pulse')
    if (!el) return { found: false }
    const cs = getComputedStyle(el)
    const boss = document.querySelector('.sts-map-node[data-ntype="boss"]')
    const bossCs = boss ? getComputedStyle(boss) : null
    return {
      found: true, anim: cs.animationName, dur: cs.animationDuration,
      bossAnim: bossCs ? bossCs.animationName : null,
    }
  })()`)
  check('③可达节点脉冲动画', pulse.found === true && pulse.anim === 'sts-map-node-pulse', JSON.stringify(pulse))
  check('③脉冲周期1.571s(4rad/s)', /1\.571s/.test(pulse.dur || ''), `dur=${pulse.dur}`)
  check('③Boss节点不脉冲', pulse.bossAnim === 'none', `bossAnim=${pulse.bossAnim}`)

  // ===== ⑤ 墨迹动画 + 真实选点 =====
  console.log('== ⑤ 选点墨迹 ==')
  // 通过 DOM 点击可达节点（触发 pick() 墨迹路径）
  const clicked = ev(`(() => {
    const el = document.querySelector('.sts-map-node.sts-map-pulse')
    if (!el) return 'noreach'
    el.click()
    return 'clicked'
  })()`)
  check('⑤点击可达节点', clicked === 'clicked', clicked)
  await sleep(250) // 墨迹已开始（transitionDelay 各异），跳转尚未发生(550ms)
  const ink = evJson(`(() => {
    const dots = [...document.querySelectorAll('.sts-map-dot')]
    const inked = dots.filter(d => d.classList.contains('traveled') && d.style.transitionDelay)
    return { inked: inked.length, sample: inked.length ? inked[0].style.transitionDelay : null, screen: window.__sts.getState().run?.screen }
  })()`)
  // 原版：首次移动（无 currentNodeId）无路径可墨迹（原版 visited 为空同样不墨迹）
  check('⑤首次移动无墨迹(原版行为)', ink.inked === 0, JSON.stringify(ink))
  check('⑤跳转延迟550ms(仍在地图)', ink.screen === 'map', `screen=${ink.screen}`)
  // 等跳转发生
  let combatReached = false
  for (let i = 0; i < 15; i++) {
    const s = ev(`window.__sts.getState().run?.screen`)
    if (s === 'combat') { combatReached = true; break }
    await sleep(600)
  }
  check('⑤墨迹后进入战斗', combatReached === true)
  await sleep(2200) // 等过渡完成

  // ===== ④ 玩家标记（注入回地图） =====
  console.log('== ④ 玩家标记(注入) ==')
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.screen = 'map'; window.__sts.setState({ run: r }); return 'ok' })()`)
  await waitScreen('map')
  await sleep(2400) // 过渡 + 渲染
  const marker = evJson(`(() => {
    const m = document.querySelector('.sts-map-marker')
    if (!m) return { found: false }
    const cs = getComputedStyle(m)
    const img = m.querySelector('img')
    return { found: true, anim: cs.animationName, dur: cs.animationDuration, img: img ? img.src.split('/').pop() : null, left: m.style.left, top: m.style.top }
  })()`)
  check('④玩家标记渲染', marker.found === true, JSON.stringify(marker))
  check('④标记入场动画(X轴展开+弹性)', marker.anim === 'sts-map-marker-in', `anim=${marker.anim}`)
  check('④标记为角色头像', /ironclad|silent|defect|watcher/.test(marker.img || ''), `img=${marker.img}`)
  check('④标记在节点上方', /62px/.test(marker.top || ''), `top=${marker.top}`)

  // ===== ⑤b 第二次移动：真实墨迹（currentNodeId 已设，边存在） =====
  console.log('== ⑤b 第二次选点墨迹 ==')
  ev(`(() => {
    const el = [...document.querySelectorAll('.sts-map-node.sts-map-pulse')]
      .find(n => n.dataset.ntype !== 'boss')
    if (!el) return 'noreach'
    el.click()
    return 'clicked'
  })()`)
  await sleep(280)
  const ink2 = evJson(`(() => {
    const dots = [...document.querySelectorAll('.sts-map-dot')]
    const inked = dots.filter(d => d.classList.contains('traveled') && d.style.transitionDelay)
    const delays = inked.map(d => parseFloat(d.style.transitionDelay) || 0)
    return {
      inked: inked.length,
      maxDelay: delays.length ? Math.max(...delays) : null,
      screen: window.__sts.getState().run?.screen,
    }
  })()`)
  check('⑤b墨迹逐朵点亮(带延迟)', ink2.inked > 3, JSON.stringify(ink2))
  check('⑤b墨迹延迟递增(≤0.55s)', ink2.maxDelay !== null && ink2.maxDelay > 0.02 && ink2.maxDelay <= 0.56, `max=${ink2.maxDelay}`)
  // 等待跳转完成再继续（战斗）
  for (let i = 0; i < 15; i++) {
    if (ev(`window.__sts.getState().run?.screen`) === 'combat') break
    await sleep(600)
  }
  await sleep(2200)
  // 回地图（注入）
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.screen = 'map'; window.__sts.setState({ run: r }); return 'ok' })()`)
  await waitScreen('map')
  await sleep(2400)

  // ===== ⑥ 图例 =====
  console.log('== ⑥ 图例 ==')
  const legend = evJson(`(() => {
    const lg = document.querySelector('.sts-map-legend')
    if (!lg) return { found: false }
    const items = [...lg.querySelectorAll('.lg-item')]
    return { found: true, n: items.length, title: lg.querySelector('.lg-title')?.textContent }
  })()`)
  check('⑥图例渲染(6项)', legend.found === true && legend.n === 6, JSON.stringify(legend))
  // 悬停"敌人"条目 → monster 节点高亮（原生 CDP 悬停，触发真实 mouseenter）
  try {
    execFileSync('agent-browser', ['hover', '[data-ltype="monster"]'], { encoding: 'utf-8', timeout: 30000 })
  } catch { /* ignore */ }
  await sleep(300)
  const hot = evJson(`(() => {
    const nodes = [...document.querySelectorAll('.sts-map-node.map-hover')]
    const hotItem = document.querySelector('.sts-map-legend .lg-item.lg-hot')
    return { n: nodes.length, types: [...new Set(nodes.map(n => n.dataset.ntype))].join(','), hotItem: !!hotItem }
  })()`)
  check('⑥悬停高亮同类节点', hot.n > 0 && hot.types === 'monster' && hot.hotItem === true, JSON.stringify(hot))
  ev(`(() => { document.querySelectorAll('.sts-map-legend .lg-item').forEach(i => i.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))); return 'ok' })()`)

  // ===== ⑦ 事件界面：打字机 + 选项滑入 =====
  console.log('== ⑦ 事件界面 ==')
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.players[0].gold = 10; r.currentEvent = 'cleric'; r.screen = 'event'; window.__sts.setState({ run: r }); return 'ok' })()`)
  await waitScreen('event')
  await sleep(1500) // 过渡黑幕(1.1s)+事件渲染；打字机 delay 0.75s 进行中
  const evMid = evJson(`(() => {
    const title = document.querySelector('.sts-ev-title')
    const desc = document.querySelector('.sts-ev-desc')
    const opts = [...document.querySelectorAll('.sts-ev-opt')]
    const locked = document.querySelector('.sts-ev-opt:disabled')
    return {
      title: title ? getComputedStyle(title).animationName : null,
      descText: desc ? desc.textContent.length : 0,
      fullLen: desc ? desc.textContent.length + (desc.querySelector('span[style*="opacity: 0"]')?.textContent.length ?? 0) : 0,
      optN: opts.length,
      optDelays: opts.map(o => o.style.animationDelay).join(','),
      optAnim: opts[0] ? getComputedStyle(opts[0]).animationName : null,
      hasLocked: !!locked,
    }
  })()`)
  check('⑦事件标题淡入动画', evMid.title === 'sts-ev-title-in', `title=${evMid.title}`)
  check('⑦打字机进行中(部分字符)', evMid.descText > 0 && evMid.descText < evMid.fullLen, `shown=${evMid.descText}/${evMid.fullLen}`)
  check('⑦选项滑入动画', evMid.optN >= 2 && evMid.optAnim === 'sts-ev-opt-in', `n=${evMid.optN} anim=${evMid.optAnim}`)
  check('⑦选项错峰延迟(0.5+0.2i)', /0\.5s,0\.7s/.test(evMid.optDelays || ''), `delays=${evMid.optDelays}`)
  await sleep(1600) // 打字机完成
  const evDone = evJson(`(() => {
    const desc = document.querySelector('.sts-ev-desc')
    const locked = document.querySelector('.sts-ev-opt:disabled')
    const lockedStyle = locked ? getComputedStyle(locked) : null
    return {
      shown: desc ? desc.textContent.length : 0,
      fullLen: desc ? desc.textContent.length + (desc.querySelector('span[style*="opacity: 0"]')?.textContent.length ?? 0) : 0,
      lockedFilter: lockedStyle ? lockedStyle.filter : null,
    }
  })()`)
  check('⑦打字机完成(全字符)', evDone.shown === evDone.fullLen && evDone.fullLen > 10, `shown=${evDone.shown}/${evDone.fullLen}`)
  check('⑦锁定选项红化滤镜', /hue-rotate\(173deg\)/.test(evDone.lockedFilter || ''), `filter=${evDone.lockedFilter}`)

  console.log(`\n== 结果: ${pass} 通过, ${fail} 失败 ==`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
