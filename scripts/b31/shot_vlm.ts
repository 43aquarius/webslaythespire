// 第三十一批 VLM 截图采集：双版本 商店全景/hover气泡/宝箱关/开
import { execFileSync } from 'child_process'
import { mkdirSync } from 'fs'
const SHOT = '/home/z/my-project/scripts/study/batch31'
mkdirSync(SHOT, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
function cli(args: string[]) { return execFileSync('agent-browser', args, { encoding: 'utf8', timeout: 90000 }) }
function ev(code: string): any {
  try {
    const out = execFileSync('agent-browser', ['eval', code, '--json'], { encoding: 'utf8' })
    const j = JSON.parse(out); return j?.data?.result ?? j?.data ?? ''
  } catch (e: any) { return 'ERR:' + String(e.stdout || e.message).slice(0, 150) }
}
function evJson(code: string): any { const r = ev(code); try { return typeof r === 'string' ? JSON.parse(r) : r } catch { return { err: String(r).slice(0, 200) } } }
function mutateRun(patch: string): any {
  return evJson(`(() => { const st = window.__sts.getState(); if (!st.run) return { err: 'no run' }; const r = JSON.parse(JSON.stringify(st.run)); const patch = ${patch}; patch(r); window.__sts.setState({ run: r }); return { ok: true } })()`)
}
async function openGame(url: string) {
  cli(['open', url])
  await sleep(3500)
  for (let i = 0; i < 20; i++) { if (ev(`typeof window.__sts === 'function'`) === true) break; await sleep(800) }
  ev(`window.__sts.getState().startRun('ironclad')`)
  await sleep(800)
  for (let i = 0; i < 20; i++) {
    const j = evJson(`(() => { const g = window.__sts.getState(); return JSON.stringify({ s: g.run ? g.run.screen : null, sel: g.select ? g.select.kind : null, uids: g.select ? g.select.cardUids.slice(0, 2) : null }) })()`)
    const jj = typeof j === 'string' ? JSON.parse(j || '{}') : j
    if (jj?.s === 'map' && !jj?.sel) break
    if (jj?.s === 'neow') ev(`window.__sts.getState().chooseNeow(1)`)
    if (jj?.sel && jj?.uids?.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(jj.uids[0])})`)
    await sleep(700)
  }
  await sleep(2500)
}
async function shots(mode: string, url: string) {
  console.log(`-- 采集 [${mode}] --`)
  await openGame(url)
  // 商店全景
  mutateRun(`r => { r.combat = null; r.screen = 'shop'; r.chestSize = undefined; r.shop = { cards: [{ cardId: 'strike', price: 999, sold: false, upgraded: false }, { cardId: 'bash', price: 45, sold: false, upgraded: false, discount: true }, { cardId: 'defend', price: 50, sold: false, upgraded: false }, { cardId: 'twinStrike', price: 70, sold: false, upgraded: false }, { cardId: 'pommelStrike', price: 62, sold: false, upgraded: false }], relics: [{ relicId: 'anchor', price: 160, sold: false }, { relicId: 'bagOfMarbles', price: 240, sold: false }], potions: [{ potionId: 'firePotion', price: 60, sold: false }, { potionId: 'strengthPotion', price: 90, sold: false }], removalUsed: false, removalPrice: 75 }; r.players[0].gold = 180 }`)
  for (let k = 0; k < 12; k++) { if (ev(`!!document.querySelector('.shop-rug > img')`) === true) break; await sleep(500) }
  await sleep(1000)
  cli(['screenshot', `${SHOT}/${mode}_shop_full.png`])
  // hover 卡 + 等欢迎气泡
  const pos = evJson(`(() => { const el = document.querySelector('[data-sidx="1"]'); if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) } })()`)
  if (pos) cli(['mouse', 'move', String(pos.x), String(pos.y)])
  await sleep(3200) // 欢迎气泡 1.5s + 停留
  cli(['screenshot', `${SHOT}/${mode}_shop_hover_bubble.png`])
  cli(['mouse', 'move', '10', '10'])
  await sleep(1400)
  // 宝箱关闭（large）
  mutateRun(`r => { r.shop = null; r.screen = 'treasure'; r.chestSize = 'large'; r.pendingTreasureRelic = undefined; r.chestGold = null }`)
  for (let k = 0; k < 12; k++) { if (ev(`!!document.querySelector('[data-chest]')`) === true) break; await sleep(500) }
  await sleep(800)
  cli(['screenshot', `${SHOT}/${mode}_treasure.png`])
  // 开箱
  ev(`window.__sts.getState().openTreasure()`)
  await sleep(1600)
  cli(['screenshot', `${SHOT}/${mode}_treasure_opened.png`])
}
async function main() {
  cli(['set', 'viewport', '1600', '900'])
  await shots('next', 'http://localhost:3000/')
  await shots('standalone', 'file:///home/z/my-project/download/slay-the-spire-standalone.html')
  cli(['close'])
  console.log('done')
}
main()
