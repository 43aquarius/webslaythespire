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
  mutateRun(`r => { r.combat = null; r.screen = 'shop'; r.shop = { cards: [{ cardId: 'strike', price: 999, sold: false, upgraded: false }, { cardId: 'bash', price: 45, sold: false, upgraded: false, discount: true }], relics: [], potions: [], removalUsed: false, removalPrice: 75 }; r.players[0].gold = 100 }`)
  // 等商店应用
  for (let k = 0; k < 10; k++) { if (ev(`!!document.querySelector('.shop-rug > img')`) === true) break; await sleep(500) }
  await sleep(3200) // 等欢迎气泡窗口
  const w = evJson(`(() => ({ welcome: !!document.querySelector('.sts-speech-bubble'), txt: (document.querySelector('.sts-speech-bubble')||{}).textContent ? document.querySelector('.sts-speech-bubble').textContent.trim().slice(0,16) : null }))()`)
  console.log('welcome:', JSON.stringify(w))
  // E2: 买不起
  ev(`window.__sts.getState().buyCard(0)`)
  for (let k = 0; k < 14; k++) {
    const st = evJson(`(() => ({ b: !!document.querySelector('.sts-speech-bubble'), txt: (document.querySelector('.sts-speech-bubble')||{textContent:''}).textContent.trim().slice(0,20), hostHtml: (document.getElementById('shop-bubble-host')||{innerHTML:''}).innerHTML.slice(0,80), fail: window.__sts.getState().shopFail ? 1 : 0 }))()`)
    console.log(`e2+${k * 300}ms`, JSON.stringify(st))
    if (st?.b) break
    await sleep(300)
  }
  // E3: 成交
  ev(`window.__sts.getState().buyCard(1)`)
  for (let k = 0; k < 14; k++) {
    const st = evJson(`(() => ({ b: !!document.querySelector('.sts-speech-bubble'), txt: (document.querySelector('.sts-speech-bubble')||{textContent:''}).textContent.trim().slice(0,20), sold: window.__sts.getState().run ? window.__sts.getState().run.shop.cards[1].sold : null }))()`)
    console.log(`e3+${k * 300}ms`, JSON.stringify(st))
    if (st?.b) break
    await sleep(300)
  }
  cli(['close'])
}
main()
