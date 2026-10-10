// 第二十一批 VLM 验收截图：药水分层渲染（地图HUD药水带 + 商店），双版本
import { execFileSync } from 'child_process'
import { mkdirSync } from 'fs'

const MODE = (process.argv[2] === 'standalone') ? 'standalone' : 'next'
const URL = MODE === 'next' ? 'http://localhost:3000/' : 'file:///home/z/my-project/download/slay-the-spire-standalone.html'
const OUT = `/home/z/my-project/scripts/study/batch21`
mkdirSync(OUT, { recursive: true })
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
function shot(name: string) {
  cli(['screenshot', `${OUT}/${MODE}_${name}.png`])
  console.log(`  📸 ${MODE}_${name}.png`)
}

async function main() {
  console.log(`== 第二十一批截图 [${MODE}] ==`)
  cli(['open', URL])
  await sleep(3500)
  for (let i = 0; i < 12; i++) { if (ev(`typeof window.__sts === 'function'`) === true) break; await sleep(800) }
  // 开始 → 角色卡 → 出发
  for (let i = 0; i < 10; i++) { if (ev(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('开 始'))`) === true) break; await sleep(400) }
  ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('开 始'))?.click()`)
  for (let i = 0; i < 10; i++) { if (ev(`[...document.querySelectorAll('button')].some(b=>/铁甲战士/.test(b.textContent))`) === true) break; await sleep(400) }
  ev(`[...document.querySelectorAll('button')].find(b=>/铁甲战士/.test(b.textContent))?.click()`)
  for (let i = 0; i < 10; i++) { if (ev(`[...document.querySelectorAll('button')].some(b=>/出\\s*发/.test(b.textContent))`) === true) break; await sleep(400) }
  ev(`[...document.querySelectorAll('button')].find(b=>/出\\s*发/.test(b.textContent))?.click()`)
  await sleep(2500)
  // 涅奥 store API
  for (let i = 0; i < 14 && ev(`window.__sts.getState().run?.screen`) !== 'map'; i++) {
    const j = evJson(`(() => { const g = window.__sts.getState(); return JSON.stringify({ screen: g.run?.screen, sel: g.select ? g.select.kind : null, uids: g.select?.cardUids?.slice(0, 2) }) })()`)
    if (j.screen === 'map' && !j.sel) break
    if (j.screen === 'neow') ev(`window.__sts.getState().chooseNeow(1)`)
    if (j.sel && Array.isArray(j.uids) && j.uids.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(j.uids[0])})`)
    await sleep(700)
  }
  await sleep(2400)
  console.log('  screen =', ev(`window.__sts.getState().run?.screen`))

  // 场景1：药水带 = 火焰(红球+橙) / 瓶中仙女(仙女形) / 邪教徒(蓝月)
  mutateRun(`r => { r.potions = ['firePotion', 'fairyInBottle', 'cultistPotion']; r.players[0].potions = r.potions }`)
  await sleep(900)
  shot('belt1')

  // 场景2：药水带 = 迅捷(深蓝+青点) / 毒药(绿) / 液态青铜(金铜+青蓝)
  mutateRun(`r => { r.potions = ['swiftPotion', 'poisonPotion', 'liquidBronze']; r.players[0].potions = r.potions }`)
  await sleep(900)
  shot('belt2')

  // 场景3：空槽占位剪影
  mutateRun(`r => { r.potions = [null, null, null]; r.players[0].potions = r.potions }`)
  await sleep(900)
  shot('belt3_empty')

  // 场景4：商店（攻击药水=红卡形 + 液态青铜）
  mutateRun(`r => { r.screen = 'shop'; r.shop = { cards: [{ cardId: 'strike', price: 45, sold: false, upgraded: 0 }], relics: [{ relicId: 'anchor', price: 160, sold: false }], potions: [{ potionId: 'attackPotion', price: 60, sold: false }, { potionId: 'liquidBronze', price: 90, sold: false }, { potionId: 'ghostInAJar', price: 120, sold: false }], removalUsed: false, removalPrice: 75 } }`)
  await sleep(2600)
  shot('shop')

  // 清场：回主菜单（避免残留 run 状态影响后续测试）
  ev(`window.__sts.getState().gotoMenu && window.__sts.getState().gotoMenu()`)
  try { cli(['close']); await sleep(1500); cli(['open', 'about:blank']) } catch {}
}
main()
