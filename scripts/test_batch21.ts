// 第二十一批测试：原版药水分层合成（liquid→hybrid→spots→glass 复刻 AbstractPotion.render + mask 着色管线 + 占位剪影）
// 用法: npx tsx scripts/test_batch21.ts [next|standalone]
import { execFileSync } from 'child_process'
import { POTIONS } from '../src/game/potions'
import { POTION_LAYERS } from '../src/game/potionLayers'

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
const setPotions = (list: (string | null)[]) =>
  mutateRun(`r => { r.potions = ${JSON.stringify(list)}; r.players[0].potions = r.potions }`)

async function main() {
  console.log(`== 第二十一批测试 [${MODE}] ==`)

  // ---------- A. 数据层（Node 单元测试） ----------
  console.log('-- A. 分层数据 --')
  check('A1 全部18药水有映射', Object.keys(POTION_LAYERS).length === Object.keys(POTIONS).length,
    `layers=${Object.keys(POTION_LAYERS).length} potions=${Object.keys(POTIONS).length}`)
  const allShaped = Object.entries(POTION_LAYERS).every(([, s]) => !!s.shape && (s.liquid !== undefined))
  check('A2 每条含 shape+liquid', allShaped === true)
  check('A3 仅仙女无液体层', POTION_LAYERS.fairyInBottle.liquid === null && POTION_LAYERS.fairyInBottle.spots === '#ffffff',
    JSON.stringify(POTION_LAYERS.fairyInBottle))
  check('A4 火焰=红液+橙hybrid', POTION_LAYERS.firePotion.liquid === '#ff0000' && POTION_LAYERS.firePotion.hybrid === '#ffa500')
  check('A5 迅捷=深蓝+青spots', POTION_LAYERS.swiftPotion.liquid === '#0d429d' && POTION_LAYERS.swiftPotion.spots === '#00ffff')
  check('A6 液态青铜=金铜+青蓝hybrid', POTION_LAYERS.liquidBronze.liquid === '#e2b821' && POTION_LAYERS.liquidBronze.hybrid === '#18bcc0')
  check('A7 邪教徒=蓝+深navy hybrid', POTION_LAYERS.cultistPotion.liquid === '#2853bc' && POTION_LAYERS.cultistPotion.hybrid === '#1c2c60')
  const shapes = new Set(Object.values(POTION_LAYERS).map(s => s.shape))
  check('A8 形状集=11种', shapes.size === 11, [...shapes].join(','))
  check('A9 攻击=card形红液', POTION_LAYERS.attackPotion.shape === 'card' && POTION_LAYERS.attackPotion.liquid === '#ff0000')

  // ---------- 导航到地图 ----------
  cli(['open', URL])
  await sleep(3500)
  for (let i = 0; i < 12; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(800)
  }
  // 开始 → 角色选择（需先点角色卡，出发按钮才有效）→ 出发
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
  // 涅奥（store API，batch16 模式）：chooseNeow(1) + resolveSelect 直至地图
  for (let i = 0; i < 14; i++) {
    const j = evJson(`(() => { const g = window.__sts.getState(); return JSON.stringify({ screen: g.run?.screen, sel: g.select ? g.select.kind : null, uids: g.select?.cardUids?.slice(0, 2) }) })()`)
    if (j.screen === 'map' && !j.sel) break
    if (j.screen === 'neow') ev(`window.__sts.getState().chooseNeow(1)`)
    if (j.sel && Array.isArray(j.uids) && j.uids.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(j.uids[0])})`)
    await sleep(700)
  }
  await sleep(2600) // 房间过渡
  const navScreen = ev(`window.__sts.getState().run?.screen`)
  check('导航: 到达地图', navScreen === 'map', `screen=${navScreen}`)

  // ---------- B. 资源可达（页面就绪后，相对 fetch） ----------
  console.log('-- B. 图层资源 --')
  const need = ['sphere_glass', 'sphere_liquid', 'sphere_hybrid', 's_glass', 'h_liquid', 'bolt_glass',
    'heart_glass', 'card_liquid', 'fairy_glass', 'ghost_glass', 'spiky_glass', 'moon_glass', 'm_spots', 'placeholder']
  if (MODE === 'next') {
    for (const k of need.slice(0, 6)) {
      const st = ev(`(async () => (await fetch('/assets/potionlayers/${k}.png')).status)()`)
      check(`B ${k}.png HTTP 200`, st === 200, `status=${st}`)
    }
  } else {
    const a = evJson(`(() => { const A = window.ASSETS || {}; return { ${need.map(k => `'${k}': !!A['potionlayers/${k}.png']`).join(',')} } })()`)
    for (const k of need) check(`B ${k} 内联`, a[k] === true, JSON.stringify(a).slice(0, 200))
  }

  // ---------- C. 药水带分层渲染 ----------
  console.log('-- C. 分层渲染 --')
  setPotions([null, null, null])
  await sleep(600)
  const emptyInfo = evJson(`(() => {
    const el = document.querySelector('#hud-potions [data-pot=empty] [data-layer=placeholder]')
    if (!el) return { found: false }
    const cs = getComputedStyle(el)
    return { found: true, bg: cs.backgroundColor, mask: (cs.webkitMaskImage || cs.maskImage || '').slice(0, 60) }
  })()`)
  check('C1 空槽=占位剪影', emptyInfo.found === true, JSON.stringify(emptyInfo))
  check('C2 占位白色75%', emptyInfo.bg === 'rgba(255, 255, 255, 0.75)', JSON.stringify(emptyInfo))

  // 组1：fire(液+hybrid+玻璃) / energy(仅液+玻璃) / fairy(无液,白spots)
  setPotions(['firePotion', 'energyPotion', 'fairyInBottle'])
  await sleep(600)
  const fire = evJson(`(() => {
    const root = document.querySelector('#hud-potions [data-pot=firePotion]')
    if (!root) return { found: false }
    const kids = [...root.children]
    const li = root.querySelector('[data-layer=liquid]')
    const hy = root.querySelector('[data-layer=hybrid]')
    const gl = root.querySelector('[data-layer=glass]')
    return {
      found: true,
      seq: kids.map(e => e.dataset.layer),
      liq: li ? getComputedStyle(li).backgroundColor : null,
      liqMask: li ? (getComputedStyle(li).webkitMaskImage || '').slice(0, 50) : null,
      hyb: hy ? getComputedStyle(hy).backgroundColor : null,
      glassImg: gl ? gl.tagName : null,
      glassSrc: gl ? (gl.getAttribute('src') || '') : null,
    }
  })()`)
  check('C3 火焰三层层序 liquid→hybrid→glass', fire.found === true && JSON.stringify(fire.seq) === JSON.stringify(['liquid', 'hybrid', 'glass']), JSON.stringify(fire))
  check('C4 火焰液层红色', fire.liq === 'rgb(255, 0, 0)', JSON.stringify(fire))
  check('C5 火焰hybrid橙色', fire.hyb === 'rgb(255, 165, 0)', JSON.stringify(fire))
  const glassSrcOk = MODE === 'next'
    ? (fire.glassSrc || '').includes('potionlayers/sphere_glass')
    : /^data:image\/png/.test(fire.glassSrc || '')
  check('C6 glass为img原图', fire.glassImg === 'IMG' && glassSrcOk, JSON.stringify(fire))
  const maskOk = MODE === 'next'
    ? /potionlayers/.test(fire.liqMask || '')
    : /data:image\/png/.test(fire.liqMask || '')
  check('C7 mask着色引用图层', maskOk === true, `mask=${fire.liqMask}`)

  const energy = evJson(`(() => {
    const root = document.querySelector('#hud-potions [data-pot=energyPotion]')
    if (!root) return { found: false }
    return { found: true, seq: [...root.children].map(e => e.dataset.layer), liq: getComputedStyle(root.querySelector('[data-layer=liquid]')).backgroundColor }
  })()`)
  check('C8 能量仅液+玻璃两层层序', energy.found === true && JSON.stringify(energy.seq) === JSON.stringify(['liquid', 'glass']), JSON.stringify(energy))
  check('C9 能量液金色', energy.liq === 'rgb(255, 215, 0)', JSON.stringify(energy))

  const fairy = evJson(`(() => {
    const root = document.querySelector('#hud-potions [data-pot=fairyInBottle]')
    if (!root) return { found: false }
    return { found: true, seq: [...root.children].map(e => e.dataset.layer), sp: getComputedStyle(root.querySelector('[data-layer=spots]')).backgroundColor }
  })()`)
  check('C10 仙女跳液体层(spots+glass)', fairy.found === true && JSON.stringify(fairy.seq) === JSON.stringify(['spots', 'glass']), JSON.stringify(fairy))
  check('C11 仙女spots白色', fairy.sp === 'rgb(255, 255, 255)', JSON.stringify(fairy))

  // 组2：swift(spots青) / poison(spots森林绿) / ghost(白液+浅灰hybrid)
  setPotions(['swiftPotion', 'poisonPotion', 'ghostInAJar'])
  await sleep(600)
  const trio = evJson(`(() => {
    const q = (sel) => { const root = document.querySelector('#hud-potions ' + sel); if (!root) return null
      return { seq: [...root.children].map(e => e.dataset.layer), bg: (l) => { const el = root.querySelector('[data-layer=' + l + ']'); return el ? getComputedStyle(el).backgroundColor : null } } }
    const sw = q('[data-pot=swiftPotion]'), po = q('[data-pot=poisonPotion]'), gh = q('[data-pot=ghostInAJar]')
    if (!sw || !po || !gh) return { found: false }
    return { found: true,
      swSeq: sw.seq, swLiq: sw.bg('liquid'), swSp: sw.bg('spots'),
      poSeq: po.seq, poLiq: po.bg('liquid'), poSp: po.bg('spots'),
      ghSeq: gh.seq, ghLiq: gh.bg('liquid'), ghHyb: gh.bg('hybrid') }
  })()`)
  check('C12 迅捷层序+青spots', trio.found === true && JSON.stringify(trio.swSeq) === JSON.stringify(['liquid', 'spots', 'glass']) && trio.swLiq === 'rgb(13, 66, 157)' && trio.swSp === 'rgb(0, 255, 255)', JSON.stringify(trio))
  check('C13 毒药层序+森林绿spots', trio.found === true && JSON.stringify(trio.poSeq) === JSON.stringify(['liquid', 'spots', 'glass']) && trio.poLiq === 'rgb(50, 205, 50)' && trio.poSp === 'rgb(34, 139, 34)', JSON.stringify(trio))
  check('C14 瓶中幽灵白液+浅灰hybrid', trio.found === true && JSON.stringify(trio.ghSeq) === JSON.stringify(['liquid', 'hybrid', 'glass']) && trio.ghLiq === 'rgb(255, 255, 255)' && trio.ghHyb === 'rgb(179, 179, 179)', JSON.stringify(trio))

  // ---------- D. 商店药水分层 ----------
  console.log('-- D. 商店 --')
  mutateRun(`r => { r.screen = 'shop'; r.shop = { cards: [{ cardId: 'strike', price: 45, sold: false, upgraded: 0 }], relics: [{ relicId: 'anchor', price: 160, sold: false }], potions: [{ potionId: 'attackPotion', price: 60, sold: false }, { potionId: 'liquidBronze', price: 90, sold: false }], removalUsed: false, removalPrice: 75 } }`)
  await sleep(2400)
  const shop = evJson(`(() => {
    const items = [...document.querySelectorAll('#shop-potions .pot-layers')]
    const atk = document.querySelector('#shop-potions [data-pot=attackPotion]')
    const brz = document.querySelector('#shop-potions [data-pot=liquidBronze]')
    if (!atk || !brz) return { found: false, n: items.length }
    return { found: true, n: items.length,
      atkSeq: [...atk.children].map(e => e.dataset.layer), atkLiq: getComputedStyle(atk.querySelector('[data-layer=liquid]')).backgroundColor,
      brzSeq: [...brz.children].map(e => e.dataset.layer), brzLiq: getComputedStyle(brz.querySelector('[data-layer=liquid]')).backgroundColor, brzHyb: getComputedStyle(brz.querySelector('[data-layer=hybrid]')).backgroundColor }
  })()`)
  check('D1 商店药水分层渲染', shop.found === true && shop.n >= 2, JSON.stringify(shop))
  check('D2 攻击药水红液card形层序', shop.found === true && JSON.stringify(shop.atkSeq) === JSON.stringify(['liquid', 'hybrid', 'glass']) && shop.atkLiq === 'rgb(255, 0, 0)', JSON.stringify(shop))
  check('D3 液态青铜金铜+青蓝', shop.found === true && shop.brzLiq === 'rgb(226, 184, 33)' && shop.brzHyb === 'rgb(24, 188, 192)', JSON.stringify(shop))

  // ---------- E. 丢弃退场ghost分层 ----------
  console.log('-- E. ghost --')
  // 从商店回地图再进战斗简化：ghost 在药水带缩减时触发（任何屏）
  setPotions(['swiftPotion', null, null])
  await sleep(300)
  setPotions([null, null, null]) // 缩减 → ghost
  await sleep(220)
  const ghost = evJson(`(() => {
    const el = document.querySelector('#hud-potions [class*=sts-pot-ghost]')
    if (!el) return { found: false }
    const inner = el.querySelector('.pot-layers')
    return { found: true, cls: el.className, hasLayers: !!inner, pot: inner ? inner.dataset.pot : null }
  })()`)
  check('E1 ghost内含分层渲染', ghost.found === true && ghost.hasLayers === true, JSON.stringify(ghost))

  console.log(`\n== 结果: ${pass} 通过, ${fail} 失败 ==`)
  if (fail > 0) process.exit(1)
  // 收尾重启浏览器（清除本套件可能的设备模拟残留，见 batch20 经验）
  try { cli(['close']); await sleep(1500); cli(['open', 'about:blank']) } catch {}
}

main().catch(e => { console.error('FATAL', e); process.exit(2) })
