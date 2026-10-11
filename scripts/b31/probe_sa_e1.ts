import { execFileSync } from 'child_process'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
function cli(args: string[]) { return execFileSync('agent-browser', args, { encoding: 'utf8', timeout: 60000 }) }
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
async function main() {
  cli(['open', 'file:///home/z/my-project/download/slay-the-spire-standalone.html'])
  await sleep(4000)
  for (let i = 0; i < 20; i++) { if (ev(`typeof window.__sts === 'function'`) === true) break; await sleep(800) }
  ev(`window.__sts.getState().startRun('ironclad')`)
  await sleep(800)
  for (let i = 0; i < 20; i++) {
    const j = evJson(`(() => { const g = window.__sts.getState(); return JSON.stringify({ s: g.run ? g.run.screen : null, sel: g.select ? g.select.kind : null, uids: g.select ? g.select.cardUids.slice(0,2) : null }) })()`)
    const jj = typeof j === 'string' ? JSON.parse(j || '{}') : j
    if (jj?.s === 'map' && !jj?.sel) break
    if (jj?.s === 'neow') ev(`window.__sts.getState().chooseNeow(1)`)
    if (jj?.sel && jj?.uids?.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(jj.uids[0])})`)
    await sleep(700)
  }
  await sleep(2500)
  // 进商店（真实流程）
  mutateRun(`r => { r.combat = null; r.screen = 'shop'; r.shop = { cards: [{ cardId: 'strike', price: 999, sold: false, upgraded: false }, { cardId: 'bash', price: 45, sold: false, upgraded: false, discount: true }], relics: [], potions: [], removalUsed: false, removalPrice: 75 }; r.players[0].gold = 100 }`)
  for (let k = 0; k < 10; k++) {
    const st = evJson(`(() => ({ rug: !!document.querySelector('.shop-rug > img'), bubble: !!document.querySelector('.sts-speech-bubble'), bubbleTxt: (document.querySelector('.sts-speech-bubble') || {}).textContent ? document.querySelector('.sts-speech-bubble').textContent.slice(0, 20) : null, host: !!document.getElementById('shop-bubble-host') }))()`)
    console.log(`e+${k}`, JSON.stringify(st))
    if (st?.bubble) break
    await sleep(700)
  }
  cli(['close'])
}
main()
