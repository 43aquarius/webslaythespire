import { execFileSync } from 'child_process'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
function cli(args: string[]) { return execFileSync('agent-browser', args, { encoding: 'utf8', timeout: 60000 }) }
function ev(code: string): any {
  try {
    const out = execFileSync('agent-browser', ['eval', code, '--json'], { encoding: 'utf8' })
    const j = JSON.parse(out); return j?.data?.result ?? j?.data ?? ''
  } catch (e: any) { return 'ERR:' + String(e.stdout || e.message).slice(0, 200) }
}
function evJson(code: string): any { const r = ev(code); try { return typeof r === 'string' ? JSON.parse(r) : r } catch { return { err: String(r).slice(0, 300) } } }
function mutateRun(patch: string): any {
  return evJson(`(() => { const st = window.__sts.getState(); if (!st.run) return { err: 'no run' }; const r = JSON.parse(JSON.stringify(st.run)); const patch = ${patch}; patch(r); window.__sts.setState({ run: r }); return { ok: true, screen: r.screen } })()`)
}
async function main() {
  cli(['open', 'http://localhost:3100/']); await sleep(3500)
  for (let i = 0; i < 20; i++) { if (ev(`typeof window.__sts === 'function'`) === true) break; await sleep(800) }
  ev(`window.__sts.getState().startRun('ironclad')`)
  await sleep(600)
  for (let i = 0; i < 20; i++) {
    const sc = ev(`window.__sts.getState().run?.screen`)
    if (sc === 'neow' || sc === 'map') break
    await sleep(600)
  }
  for (let i = 0; i < 15; i++) {
    const j = evJson(`(() => { const g = window.__sts.getState(); return JSON.stringify({ s: g.run ? g.run.screen : null, sel: g.select ? g.select.kind : null, uids: g.select ? g.select.cardUids.slice(0,2) : null }) })()`)
    const jj = typeof j === 'string' ? JSON.parse(j || '{}') : j
    if (jj?.s === 'map' && !jj?.sel) break
    if (jj?.s === 'neow') ev(`window.__sts.getState().chooseNeow(1)`)
    if (jj?.sel && jj?.uids?.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(jj.uids[0])})`)
    await sleep(600)
  }
  await sleep(2200)
  // —— 重载注入：复现 B3+B4 的 800 次单eval openTreasure ——
  for (let i = 0; i < 400; i++) {
    mutateRun(`r => { r.combat = null; r.screen = 'treasure'; r.chestSize = 'large'; r.pendingTreasureRelic = undefined; r.chestGold = null; r.act = 1; r.relics = [] }`)
    ev(`window.__sts.getState().openTreasure()`)
  }
  console.log('heavy loop done')
  // 健康检查
  const health = evJson(`(() => ({ alive: !!document.querySelector('#app, #stage, body') && (document.body.innerText || '').slice(0, 40), appErr: (document.body.innerText || '').includes('Application error') }))()`)
  console.log('health after loop:', JSON.stringify(health))
  try { console.log('page errors:', cli(['errors']).slice(0, 600)) } catch (e: any) { console.log('errors cmd fail') }

  // —— 复现 B5b → C 序列 ——
  mutateRun(`r => { r.combat = null; r.screen = 'treasure'; r.chestSize = 'large'; r.pendingTreasureRelic = undefined; r.chestGold = null; r.relics = [] }`)
  await sleep(500)
  ev(`window.__sts.getState().openTreasure()`)
  await sleep(500)
  ev(`window.__sts.getState().confirmTreasure()`)
  await sleep(1000)
  for (let k = 0; k < 12; k++) {
    const st = evJson(`(() => ({ store: window.__sts.getState().run ? window.__sts.getState().run.screen : null, dom: (document.body.innerText || '').slice(0, 30), chest: !!document.querySelector('[data-chest]'), fade: !!document.querySelector('.sts-room-fade') ? document.querySelector('.sts-room-fade').className : null }))()`)
    console.log(`t+${k}s`, JSON.stringify(st))
    if (st?.chest) break
    await sleep(1000)
  }
  // 再 mutate 一次 treasure 看能否恢复
  mutateRun(`r => { r.combat = null; r.screen = 'treasure'; r.chestSize = 'medium'; r.pendingTreasureRelic = undefined }`)
  for (let k = 0; k < 8; k++) {
    const st = evJson(`(() => ({ store: window.__sts.getState().run ? window.__sts.getState().run.screen : null, chest: !!document.querySelector('[data-chest]'), fade: !!document.querySelector('.sts-room-fade') ? document.querySelector('.sts-room-fade').className : null, body: (document.body.innerText || '').slice(0, 50) }))()`)
    console.log(`re+${k}`, JSON.stringify(st))
    if (st?.chest) break
    await sleep(800)
  }
  cli(['close'])
}
main()
