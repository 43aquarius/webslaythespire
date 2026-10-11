// 调试：商店购买失败抖动（复刻 batch16 的就绪流程）
import { execFileSync } from 'child_process'
const URL = 'http://localhost:3100/'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
function ev(code: string): any {
  try { return JSON.parse(execFileSync('agent-browser', ['eval', code], { encoding: 'utf8' })) } catch { return undefined }
}
function cli(args: string[]) { return execFileSync('agent-browser', args, { encoding: 'utf8' }) }
function mutateRun(patch: string): any {
  return ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); ${patch}; window.__sts.setState({ run: r }); return true })()`)
}
async function main() {
  cli(['open', URL]); await sleep(3000)
  for (let i = 0; i < 40; i++) { if (ev(`typeof window.__sts === 'function'`) === true) break; await sleep(1000) }
  ev(`window.__sts.getState().startRun('ironclad')`)
  await sleep(500)
  for (let i = 0; i < 30; i++) {
    const sc = ev(`window.__sts.getState().run?.screen`)
    if (sc === 'neow' || sc === 'map') break
    await sleep(700)
  }
  for (let i = 0; i < 20; i++) {
    const j = ev(`(() => { const g = window.__sts.getState(); return JSON.stringify({ screen: g.run?.screen, sel: g.select ? g.select.kind : null, uids: g.select?.cardUids?.slice(0,2) }) })()`)
    const jj = JSON.parse(j || '{}')
    if (jj.screen === 'map' && !jj.sel) break
    if (jj.screen === 'neow') ev(`window.__sts.getState().chooseNeow(1)`)
    if (jj.sel && Array.isArray(jj.uids) && jj.uids.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(jj.uids[0])})`)
    await sleep(700)
  }
  await sleep(2600)
  mutateRun(`r => { r.combat = null; r.screen = 'shop'; r.shop = { cards: [{ cardId: 'strike', price: 999, sold: false, upgraded: false }, { cardId: 'bash', price: 45, sold: false, upgraded: false, discount: true }], relics: [], potions: [], removalUsed: false, removalPrice: 75 }; r.players[0].gold = 100 }`)
  await sleep(1500)
  ev(`window.__sts.getState().buyCard(0)`)
  await sleep(300)
  const out = ev(`(() => {
    const el = document.querySelector('[data-sidx="0"]')
    const st = window.__sts.getState()
    return JSON.stringify({
      cls: el ? el.className : null,
      anims: el ? el.getAnimations().map(a => ({ playState: a.playState, cur: a.currentTime, dur: a.effect && a.effect.getTiming ? a.effect.getTiming().duration : null })) : [],
      fail: st.shopFail,
      gold: st.run ? st.run.players[0].gold : null,
    })
  })()`)
  console.log(out)
  cli(['close'])
}
main().catch(e => { console.error(e); process.exit(1) })
