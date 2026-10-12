// 第三十七批测试：地图背景原版羊皮纸还原 + Neow屏适配 + 菜单家族背景统一
// 背景：本会话沙箱基于过时第二十批独立完成了主页+地图背景还原，fetch发现远端已至36批
//      (第33/34批已含主页TitleBackground完整还原——分离图层方案优于本会话烘焙合成,已弃);
//      本批=在远端权威基线上重放会话独有增量: 地图羊皮纸(mapTop+mapBot+mapBlend合成,
//      远端从未做过——map.jpg此前为wiki时期老素材768x1344) + Neow按高适配 + 菜单家族背景。
// 用法: npx tsx scripts/test_batch37.ts [next|standalone]
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
  console.log(`== 第三十七批测试 [${MODE}] ==`)
  cli(['open', URL])
  await sleep(3500)
  for (let i = 0; i < 12; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(800)
  }
  check('store就绪', ev(`typeof window.__sts === 'function'`) === true)

  // ===== A. 素材就位 =====
  console.log('-- A. 原版地图素材 --')
  if (MODE === 'next') {
    const res = evJson(`(async () => {
      const urls = ['/assets/bg/map.jpg', '/assets/bg/maptop.png', '/assets/bg/mapbot.png', '/assets/bg/mapblend.png', '/assets/bg/mapmid.png']
      const out = {}
      for (const u of urls) { const r = await fetch(u); out[u.split('/').pop()] = r.status }
      return out
    })()`)
    check('A1 地图合成图+源料HTTP 200', Object.values(res).every((s: any) => s === 200), JSON.stringify(res))
    const dim = evJson(`(async () => { const r = await fetch('/assets/bg/map.jpg'); const b = await r.blob(); return { size: b.size } })()`)
    check('A2 合成map.jpg尺寸合理(50-120KB)', dim.size > 50000 && dim.size < 120000, JSON.stringify(dim))
  } else {
    const assets = evJson(`(() => { const A = window.ASSETS || {}; return { map: !!A['bg/map.jpg'], maptop: !A['bg/maptop.png'], mapbot: !A['bg/mapbot.png'], blend: !A['bg/mapblend.png'] } })()`)
    check('A1 合成图内联+源料排除', assets.map === true && assets.maptop === true && assets.mapbot === true && assets.blend === true, JSON.stringify(assets))
  }

  // ===== B. 地图屏: 羊皮纸无滤镜 =====
  console.log('-- B. 地图羊皮纸 --')
  ev(`(() => { const st = window.__sts.getState(); st.startRun('ironclad'); return 'ok' })()`)
  await sleep(1500)
  // 涅奥: store API直选 + resolveSelect(远端batch18成熟模式)
  for (let i = 0; i < 14 && ev(`window.__sts.getState().run?.screen`) !== 'map'; i++) {
    const j = evJson(`(() => { const g = window.__sts.getState(); return { screen: g.run?.screen, sel: g.select ? g.select.kind : null, uids: g.select?.cardUids?.slice(0, 2) } })()`)
    if (j.screen === 'map' && !j.sel) break
    if (j.screen === 'neow') ev(`window.__sts.getState().chooseNeow(1)`)
    if (j.sel && Array.isArray(j.uids) && j.uids.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(j.uids[0])})`)
    await sleep(700)
  }
  for (let i = 0; i < 10; i++) {
    if (ev(`window.__sts.getState().run?.screen`) === 'map') break
    await sleep(600)
  }
  await sleep(1600)
  const mapInfo = evJson(`(() => {
    const el = ${MODE === 'next'
      ? `([...document.querySelectorAll('div')].filter(d => (d.style.backgroundImage || '').includes('map.jpg'))).find(d => getComputedStyle(d).backgroundSize.includes('100%'))`
      : `document.querySelector('.map-canvas')`}
    if (!el) return { found: false }
    const cs = getComputedStyle(el)
    return { found: true, size: cs.backgroundSize, filter: cs.filter, w: el.offsetWidth, h: el.offsetHeight }
  })()`)
  check('B1 地图羊皮纸背景就位', mapInfo.found === true, JSON.stringify(mapInfo))
  check('B2 无压暗滤镜(原版全亮)', mapInfo.found && (!mapInfo.filter || mapInfo.filter === 'none'), `filter=${mapInfo.filter}`)
  check('B3 铺满画布(100% 100%)', mapInfo.found && String(mapInfo.size).includes('100%'), `size=${mapInfo.size}`)

  // ===== C. Neow屏: 羊皮纸按高适配 =====
  console.log('-- C. Neow屏适配 --')
  ev(`(() => { const st = window.__sts.getState(); st.startRun('silent'); return 'ok' })()`)
  await sleep(1800)
  const neowInfo = evJson(`(() => {
    // Next: style含map.jpg; standalone: dataURL → 按计算样式找 auto 100% 的屏
    const want = ${MODE === 'next' ? `"map.jpg"` : `null`}
    let el = null
    if (want) el = [...document.querySelectorAll('div')].find(d => (d.style.backgroundImage || '').includes(want))
    else el = [...document.querySelectorAll('.screen')].find(d => { const cs = getComputedStyle(d); return /^auto/.test(cs.backgroundSize) && cs.backgroundImage !== 'none' })
    if (!el) return { found: false }
    const cs = getComputedStyle(el)
    return { found: true, size: cs.backgroundSize, pos: cs.backgroundPosition }
  })()`)
  check('C1 Neow屏用羊皮纸', neowInfo.found === true, JSON.stringify(neowInfo))
  check('C2 按高适配不裁切(auto 100%)', neowInfo.found && String(neowInfo.size).includes('auto') && String(neowInfo.size).includes('100%'), `size=${neowInfo.size}`)

  // ===== D. 菜单家族背景统一(设置/统计/制作名单) =====
  console.log('-- D. 菜单家族背景 --')
  const famInfo = ev(`(() => { window.__sts.setState({ run: null, menuScreen: 'title' }); return 'ok' })()`)
  check('D0 回主菜单', famInfo === 'ok', String(famInfo))
  await sleep(1500)
  for (const target of ['settings', 'stats', 'credits']) {
    ev(`(() => { const st = window.__sts.getState(); st.gotoMenuScreen('${target}'); return 'ok' })()`)
    await sleep(1600)
    const bg = String(ev(`(() => {
      const menubgUrl = ${MODE === 'next' ? `'/assets/bg/menubg.jpg'` : `(window.ASSETS || {})['bg/menubg.jpg'] || ''`}
      const combatUrl = ${MODE === 'next' ? `'/assets/bg/combat.jpg'` : `(window.ASSETS || {})['bg/combat.jpg'] || ''`}
      const screens = [...document.querySelectorAll('div')].filter(d => (d.style.backgroundImage || '').length > 10)
      const el = screens.find(d => d.style.backgroundImage.includes(menubgUrl)) || screens.find(d => d.style.backgroundImage.includes(combatUrl))
      return el ? (el.style.backgroundImage.includes(menubgUrl) ? 'menubg' : 'COMBAT!') : 'none:' + screens.length
    })()`) || '')
    check(`D-${target} 用menubg背景`, bg === 'menubg', `bg=${bg.slice(0, 70)}`)
  }

  // ===== E. 截图供VLM =====
  const shotDir = '/home/z/my-project/scripts/study/bgrestore'
  ev(`(() => { const st = window.__sts.getState(); st.startRun('ironclad'); return 'ok' })()`)
  await sleep(1600)
  for (let i = 0; i < 14 && ev(`window.__sts.getState().run?.screen`) !== 'map'; i++) {
    const j = evJson(`(() => { const g = window.__sts.getState(); return { screen: g.run?.screen, sel: g.select ? g.select.kind : null, uids: g.select?.cardUids?.slice(0, 2) } })()`)
    if (j.screen === 'map' && !j.sel) break
    if (j.screen === 'neow') ev(`window.__sts.getState().chooseNeow(1)`)
    if (j.sel && Array.isArray(j.uids) && j.uids.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(j.uids[0])})`)
    await sleep(700)
  }
  for (let i = 0; i < 10; i++) {
    if (ev(`window.__sts.getState().run?.screen`) === 'map') break
    await sleep(600)
  }
  await sleep(1800)
  cli(['screenshot', `${shotDir}/shot37_map_${MODE}.png`])

  console.log(`\n结果: ${pass}通过 / ${fail}失败`)
  if (fail > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
