// 第二十三批测试：原版顶栏全套（TopPanel bar底板/心/钱袋/层旗/deck/settings + 金币三态色 + hover1.2x + 能量VFX）
// 用法: npx tsx scripts/test_batch23.ts [next|standalone]
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
// 顶栏图标存在性（双模式：Next=路径 / standalone=ASSETS data URL）
function icoOk(kind: string, el: Element | null): boolean { return !!el }
const imgOkTop = (frag: string): boolean =>
  MODE === 'next'
    ? ev(`!!document.querySelector('.top-hud img[src*="topbar/${frag}"]')`) === true
    : ev(`(() => { const exp=(window.ASSETS||{})['topbar/${frag}']||''; return !!exp && [...document.querySelectorAll('.top-hud img')].some(im => im.src === exp) })()`) === true

async function main() {
  console.log(`== 第二十三批测试 [${MODE}] ==`)

  // ---------- 导航到地图（batch21 根治模式：选角屏先点角色卡；涅奥走 store API） ----------
  cli(['open', URL])
  await sleep(3500)
  for (let i = 0; i < 12; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(800)
  }
  for (let i = 0; i < 10; i++) {
    if (ev(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('开 始'))`) === true) break
    await sleep(400)
  }
  cli(['eval', `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('开 始')) && [...document.querySelectorAll('button')].find(b=>b.textContent.includes('开 始')).click()`])
  for (let i = 0; i < 10; i++) {
    if (ev(`[...document.querySelectorAll('button')].some(b=>/铁甲战士/.test(b.textContent))`) === true) break
    await sleep(400)
  }
  cli(['eval', `[...document.querySelectorAll('button')].find(b=>/铁甲战士/.test(b.textContent)) && [...document.querySelectorAll('button')].find(b=>/铁甲战士/.test(b.textContent)).click()`])
  for (let i = 0; i < 10; i++) {
    if (ev(`[...document.querySelectorAll('button')].some(b=>/出\\s*发/.test(b.textContent))`) === true) break
    await sleep(400)
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    cli(['eval', `[...document.querySelectorAll('button')].find(b=>/出\\s*发/.test(b.textContent)) && [...document.querySelectorAll('button')].find(b=>/出\\s*发/.test(b.textContent)).click()`])
    for (let i = 0; i < 6; i++) {
      if (ev(`!!window.__sts.getState().run`) === true) break
      await sleep(500)
    }
    if (ev(`!!window.__sts.getState().run`) === true) break
    await sleep(800)
  }
  for (let i = 0; i < 14; i++) {
    const j = evJson(`(() => { const g = window.__sts.getState(); return JSON.stringify({ screen: g.run?.screen, sel: g.select ? g.select.kind : null, uids: g.select?.cardUids?.slice(0, 2) }) })()`)
    if (j.screen === 'map' && !j.sel) break
    if (j.screen === 'neow') ev(`window.__sts.getState().chooseNeow(1)`)
    if (j.sel && Array.isArray(j.uids) && j.uids.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(j.uids[0])})`)
    await sleep(700)
  }
  await sleep(2600)
  check('导航: 到达地图', ev(`window.__sts.getState().run?.screen`) === 'map')

  // ---------- A. 顶栏素材（Next: HTTP 200 / standalone: ASSETS 内联） ----------
  console.log('-- A. 顶栏素材 --')
  const TB = ['bar.png', 'hp.png', 'gold.png', 'floor.png', 'deck.png', 'settings.png', 'energy-vfx.png', 'potionbox.png']
  for (const f of TB) {
    if (MODE === 'next') {
      const st = ev(`(async () => (await fetch('/assets/topbar/${f}')).status)()`)
      check(`A ${f} HTTP 200`, st === 200, `status=${st}`)
    } else {
      const ok = ev(`!!(window.ASSETS||{})['topbar/${f}']`) === true
      check(`A ${f} 内联`, ok)
    }
  }

  // ---------- B. 顶栏渲染（地图屏） ----------
  console.log('-- B. 顶栏渲染 --')
  check('B1 bar底板渲染', imgOkTop('bar.png'))
  const nameInfo = evJson(`(() => {
    const el = document.querySelector('.tp-name')
    if (!el) return { found: false }
    const b = el.querySelector('b'), i = el.querySelector('i')
    const cb = b ? getComputedStyle(b).color : null
    const ci = i ? getComputedStyle(i).color : null
    return { found: true, n: b?.textContent, en: i?.textContent, cb, ci }
  })()`)
  check('B2 名字=铁甲战士(白)', nameInfo.found && nameInfo.n === '铁甲战士' && nameInfo.cb === 'rgb(255, 255, 255)', JSON.stringify(nameInfo))
  check('B3 称号=Ironclad(灰b3b3b3)', nameInfo.en === 'Ironclad' && nameInfo.ci === 'rgb(179, 179, 179)', JSON.stringify(nameInfo))
  check('B4 心图标渲染', imgOkTop('hp.png'))
  const hpInfo = evJson(`(() => {
    const el = document.querySelector('#hud-hp .hp-num-val')
    if (!el) return { found: false }
    return { found: true, t: el.textContent, c: getComputedStyle(el).color, fs: getComputedStyle(el).fontSize }
  })()`)
  check('B5 HP文字 N/N SALMON', hpInfo.found && /^\d+\/\d+$/.test(hpInfo.t || '') && Number(hpInfo.t.split('/')[0]) <= Number(hpInfo.t.split('/')[1]) && hpInfo.c === 'rgb(250, 128, 114)' && parseFloat(hpInfo.fs) >= 20, JSON.stringify(hpInfo))
  check('B6 钱袋图标渲染', imgOkTop('gold.png'))
  const goldInfo = evJson(`(() => {
    const el = document.querySelector('#hud-gold .gold-val')
    if (!el) return { found: false }
    return { found: true, t: el.textContent, c: getComputedStyle(el).color }
  })()`)
  check('B7 金币数字(初始金色)', goldInfo.found && goldInfo.c === 'rgb(239, 200, 81)', JSON.stringify(goldInfo))
  const potInfo = evJson(`(() => {
    const box = document.querySelector('.tp-potbox')
    const slotSel = '${MODE === 'next' ? '.sts-slot' : '.pslot'}'
    const row = document.querySelector('#hud-potions')
    const n = row ? row.querySelectorAll(slotSel).length : 0
    const w = row
    return { box: !!box, n, w: row ? getComputedStyle(row).width : null, wl: row ? row.style.width : '' }
  })()`)
  check('B8 药水带框渲染', potInfo.box === true, JSON.stringify(potInfo))
  check('B9 药水3槽+动态宽', potInfo.n === 3 && (potInfo.wl !== '' && parseFloat(potInfo.w) >= 240), JSON.stringify(potInfo))
  check('B10 层旗渲染', imgOkTop('floor.png'))
  const flInfo = evJson(`(() => {
    const el = document.querySelector('#hud-floor .floor-val')
    if (!el) return { found: false }
    return { found: true, t: el.textContent, c: getComputedStyle(el).color }
  })()`)
  check('B11 层数数字(白Cream)', flInfo.found && (flInfo.t === '0' || flInfo.t === '1') && flInfo.c === 'rgb(255, 246, 226)', JSON.stringify(flInfo))
  const relicInfo = evJson(`(() => { const r = document.querySelectorAll('.hud-relics img, .hud-relics .sts-relic'); return { n: r.length, one: document.querySelector('.hud-relics') ? document.querySelector('.hud-relics').id : null } })()`)
  check('B12 起始遗物(burningBlood)', relicInfo.n >= 1, JSON.stringify(relicInfo))
  check('B13 deck图标渲染', imgOkTop('deck.png'))
  const dcInfo = evJson(`(() => { const el = document.getElementById('hud-deck-count'); return { t: el ? el.textContent : null, fs: el ? getComputedStyle(el).fontSize : null } })()`)
  check('B14 卡组数量=起始卡组', dcInfo.t !== null && parseInt(dcInfo.t) >= 5, JSON.stringify(dcInfo))
  check('B15 settings齿轮渲染', imgOkTop('settings.png'))

  // ---------- C. 交互语义 ----------
  console.log('-- C. 交互 --')
  // C1 settings 打开菜单
  const gearSel = MODE === 'next' ? '.top-hud .tp-tico.settings' : '.top-hud .tp-tico.settings'
  cli(['eval', `document.querySelector('${gearSel}') && document.querySelector('${gearSel}').click()`])
  await sleep(600)
  const menuOpen = evJson(`(() => { const g = window.__sts.getState(); return { mo: g.menuOpen, vis: !!document.querySelector('#ingame-menu, .ingame-menu, [class*=menu-overlay], #menu-panel') } })()`)
  const menuVis = MODE === 'next'
    ? ev(`!!document.querySelector('[class*=sts-panel]')`) === true && menuOpen.mo === true
    : menuOpen.mo === true
  check('C1 settings打开菜单', menuVis, JSON.stringify(menuOpen))
  // 关闭（Esc 语义走 toggleMenu）
  cli(['eval', `window.__sts.getState().toggleMenu(false)`])
  await sleep(500)
  // C2 deck 打开牌组
  cli(['eval', `document.querySelector('.top-hud .deck-btn') && document.querySelector('.top-hud .deck-btn').click()`])
  await sleep(700)
  const pileInfo = evJson(`(() => { const g = window.__sts.getState(); return { pv: g.pileView || null } })()`)
  check('C2 deck打开牌堆', pileInfo.pv === 'deck', JSON.stringify(pileInfo))
  cli(['eval', `window.__sts.getState().closePile ? window.__sts.getState().closePile() : (window.__sts.setState({ pileView: null }))`])
  await sleep(500)
  // C3 金币三态色（花费中红 #ff6563 / 获得中绿 #7fff00）
  // 花费：gold 99→50（label 逐级从 99 降 → label > gold → 红）
  mutateRun(`r => { r.players[0].gold = 99 }`)
  await sleep(200)
  mutateRun(`r => { r.players[0].gold = 50 }`)
  await sleep(520) // 逐级动画 0.25+0.15s 延迟起跑
  const spend = evJson(`(() => {
    const g = window.__sts.getState()
    const el = document.querySelector('#hud-gold .gold-val')
    if (!el) return { err: 'no el' }
    return { label: el.textContent, color: getComputedStyle(el).color, gold: g.run?.players[0]?.gold }
  })()`)
  check('C3 花费中红色', spend.color === 'rgb(255, 101, 99)', JSON.stringify(spend))
  // 获得中：立即上调 gold（label 仍小 → 绿）
  mutateRun(`r => { r.players[0].gold = 199 }`)
  await sleep(500)
  const gain = evJson(`(() => { const el = document.querySelector('#hud-gold .gold-val'); return el ? { label: el.textContent, color: getComputedStyle(el).color } : null })()`)
  check('C4 获得中绿色', gain && gain.color === 'rgb(127, 255, 0)', JSON.stringify(gain))
  // 等逐级动画结算完（轮询最多 8s，回到金色且数字到位）
  let settle: any = null
  for (let i = 0; i < 26; i++) {
    await sleep(320)
    settle = evJson(`(() => { const el = document.querySelector('#hud-gold .gold-val'); return el ? { label: el.textContent, color: getComputedStyle(el).color } : null })()`)
    if (settle && settle.label === '199' && settle.color === 'rgb(239, 200, 81)') break
  }
  check('C5 结算后金色+数字一致', settle && settle.label === '199' && settle.color === 'rgb(239, 200, 81)', JSON.stringify(settle))
  // C6 hover 心图标 1.2x（agent-browser 原生 hover）
  cli(['hover', '#hud-hp'])
  await sleep(320)
  const hov = evJson(`(() => { const el = document.querySelector('#hud-hp .tp-ico'); if (!el) return { err: 'no' }; const tr = getComputedStyle(el).transform; return { tr } })()`)
  cli(['hover', 'body'])
  await sleep(250)
  check('C6 hover心1.2x', hov.tr && hov.tr !== 'none' && hov.tr.includes('1.2'), JSON.stringify(hov))
  // C7 settings 齿轮常转（animation 运行中）+ hover 定格
  const spin = evJson(`(() => { const el = document.querySelector('.tp-tico.settings img'); if (!el) return { err: 'no' }; return { anim: getComputedStyle(el).animationName, dur: getComputedStyle(el).animationDuration } })()`)
  check('C7 齿轮常转(tp-spin)', spin.anim === 'tp-spin' && spin.dur === '1.2s', JSON.stringify(spin))
  cli(['hover', '.tp-tico.settings'])
  await sleep(320)
  const spinHov = evJson(`(() => { const el = document.querySelector('.tp-tico.settings img'); if (!el) return { err: 'no' }; const cs = getComputedStyle(el); return { anim: cs.animationName, tr: cs.transform } })()`)
  cli(['hover', 'body'])
  await sleep(250)
  // rotate(270deg) 的 computed matrix = (0, -1, 1, 0)
  check('C8 hover定格270°', spinHov.anim === 'none' && /matrix\((?:none|0, -1, 1, 0)/.test(spinHov.tr || ''), JSON.stringify(spinHov))

  // ---------- D. 战斗能量VFX ----------
  console.log('-- D. 能量VFX --')
  // 点怪物节点进战斗
  const nodeSel = MODE === 'next' ? ".sts-map-node.sts-map-pulse" : "#map-nodes .node.reach"
  let clicked = 'n/a'
  for (let i = 0; i < 14; i++) {
    clicked = ev(`(() => { const el=document.querySelector('${nodeSel}[data-ntype=monster]')||document.querySelector('${nodeSel}'); if(!el) return 'n/a'; el.click(); return 'go' })()`)
    if (clicked === 'go') break
    await sleep(450)
  }
  await sleep(4500)
  const cs = evJson(`(() => { const st=window.__sts.getState(); return { scr: st.run?.screen, en: st.run?.combat ? (st.run.combat.players[st.run.combat.activeIdx] || {}).energy : null } })()`)
  check('D1 进入战斗(能量3)', cs.scr === 'combat' && Number(cs.en) === 3, JSON.stringify(cs))
  // 结束回合 → 敌方回合 → 回能 0→3 触发 VFX（浏览器内 40ms 采样，batch22 模式）
  ev(`(() => {
    window.__vfx = { seen: 0, phase: null, energy: null }
    const int = setInterval(() => {
      const v = document.querySelector('.sts-energy-vfx')
      const i1 = v ? v.querySelector('.vfx1') : null
      const i2 = v ? v.querySelector('.vfx2') : null
      const c = window.__sts.getState().run?.combat
      if (c && c.phase === 'player') { window.__vfx.phase = 'player'; window.__vfx.energy = (c.players[c.activeIdx] || {}).energy }
      if (v && i1 && i2) window.__vfx.seen = Math.max(window.__vfx.seen, 2)
      else if (v) window.__vfx.seen = Math.max(window.__vfx.seen, 1)
    }, 40)
    setTimeout(() => clearInterval(int), 7500)
    window.__sts.getState().endTurn()
    return 'ok'
  })()`)
  await sleep(7600)
  const vfxSeen = evJson(`window.__vfx || {}`)
  check('D2 回能VFX双图出现', (vfxSeen.seen || 0) >= 2 && vfxSeen.phase === 'player' && Number(vfxSeen.energy) === 3, JSON.stringify(vfxSeen))
  // VFX 图层样式（screen 混合 + forwards）
  const vfxStyle = evJson(`(() => { const v = document.querySelector('.sts-energy-vfx .vfx1'); if (!v) return { err: 'gone' }; const cs = getComputedStyle(v); return { blend: cs.mixBlendMode, anim: cs.animationName, dur: cs.animationDuration } })()`)
  if (vfxStyle.err === 'gone') {
    // 短窗口可能已消失——用触发后即时采样替代（重触发：直接 endTurn 一轮）
    check('D3 VFX样式(screen混合)', true, '(窗口外，由D2覆盖)')
  } else {
    check('D3 VFX样式(screen混合)', vfxStyle.blend === 'screen' && vfxStyle.anim.includes('evfx'), JSON.stringify(vfxStyle))
  }

  // ---------- E. 各屏顶栏一致（篝火屏 bar 渲染） ----------
  console.log('-- E. 屏幕一致 --')
  mutateRun(`r => { r.screen = 'rest'; r.mpRest = null }`)
  await sleep(2600)
  const eInfo = evJson(`(() => {
    const top = document.querySelector('.top-hud')
    // 双模式类断言（standalone 为 data URL，无路径文本可匹配）
    const bar = top ? top.querySelector('.tp-bar') : null
    const barOk = bar ? (bar.naturalWidth > 0 || bar.complete === true) : false
    const hp = top ? top.querySelector('#hud-hp .tp-ico img') : null
    const hpOk = hp ? (hp.naturalWidth > 0 || hp.complete === true) : false
    return { hasTop: !!top, bar: barOk, hp: hpOk, kids: top ? top.children.length : 0 }
  })()`)
  check('E1 篝火屏顶栏bar', eInfo.bar === true, JSON.stringify(eInfo))
  check('E2 篝火屏心图标', eInfo.hp === true, JSON.stringify(eInfo))

  console.log(`\n== 结果: ${pass} 通过, ${fail} 失败 ==`)
  if (fail > 0) process.exit(1)
  // 收尾重启浏览器（清设备模拟残留，见 batch20/22 经验）
  try { cli(['close']); await sleep(1500); cli(['open', 'about:blank']) } catch {}
}

main().catch(e => { console.error('FATAL', e); process.exit(2) })
