// 第二十二批 VLM 验收截图：结束回合按钮三态（常态/悬停/发光/敌方回合灰度）
import { execFileSync } from 'child_process'
import { mkdirSync } from 'fs'
const MODE = (process.argv[2] === 'standalone') ? 'standalone' : 'next'
const URL = MODE === 'next' ? 'http://localhost:3000/' : 'file:///home/z/my-project/download/slay-the-spire-standalone.html'
const BTNS = MODE === 'next' ? '.sts-endturn' : '#end-turn-btn'
const OUT = '/home/z/my-project/scripts/study/batch22'
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
function shot(name: string) { cli(['screenshot', `${OUT}/${MODE}_${name}.png`]); console.log(`  📸 ${MODE}_${name}`) }
async function main() {
  console.log(`== 第二十二批截图 [${MODE}] ==`)
  cli(['open', URL]); await sleep(3500)
  for (let i = 0; i < 12; i++) { if (ev(`typeof window.__sts === 'function'`) === true) break; await sleep(800) }
  for (let i = 0; i < 10; i++) { if (ev(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('开 始'))`) === true) break; await sleep(400) }
  ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('开 始'))?.click()`)
  for (let i = 0; i < 10; i++) { if (ev(`[...document.querySelectorAll('button')].some(b=>/铁甲战士/.test(b.textContent))`) === true) break; await sleep(400) }
  ev(`[...document.querySelectorAll('button')].find(b=>/铁甲战士/.test(b.textContent))?.click()`)
  for (let i = 0; i < 10; i++) { if (ev(`[...document.querySelectorAll('button')].some(b=>/出\\s*发/.test(b.textContent))`) === true) break; await sleep(400) }
  for (let a = 0; a < 3; a++) {
    ev(`[...document.querySelectorAll('button')].find(b=>/出\\s*发/.test(b.textContent))?.click()`)
    for (let i = 0; i < 6; i++) { if (ev(`!!window.__sts.getState().run`) === true) break; await sleep(500) }
    if (ev(`!!window.__sts.getState().run`) === true) break
    await sleep(800)
  }
  for (let i = 0; i < 14 && ev(`window.__sts.getState().run?.screen`) !== 'map'; i++) {
    const j = evJson(`(() => { const g = window.__sts.getState(); return JSON.stringify({ screen: g.run?.screen, sel: g.select ? g.select.kind : null, uids: g.select?.cardUids?.slice(0, 2) }) })()`)
    if (j.screen === 'map' && !j.sel) break
    if (j.screen === 'neow') ev(`window.__sts.getState().chooseNeow(1)`)
    if (j.sel && Array.isArray(j.uids) && j.uids.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(j.uids[0])})`)
    await sleep(700)
  }
  await sleep(2400)
  const nodeSel = MODE === 'next' ? ".sts-map-node.sts-map-pulse" : "#map-nodes .node.reach"
  for (let i = 0; i < 14; i++) {
    const c = ev(`(() => { const el=document.querySelector('${nodeSel}[data-ntype=monster]')||document.querySelector('${nodeSel}'); if(!el) return 'n/a'; el.click(); return 'go' })()`)
    if (c === 'go') break
    await sleep(450)
  }
  for (let i = 0; i < 14; i++) { if (ev(`window.__sts.getState().run?.screen`) === 'combat') break; await sleep(450) }
  await sleep(2800)
  console.log('  screen =', ev(`window.__sts.getState().run?.screen`))
  shot('base')
  cli(['hover', BTNS]); await sleep(450); shot('hover')
  cli(['hover', 'body'])
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.combat.players[r.combat.activeIdx].energy = 0; window.__sts.setState({ run: r }) })()`)
  await sleep(800); shot('glow')
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.combat.players[r.combat.activeIdx].energy = 3; window.__sts.setState({ run: r }) })()`)
  await sleep(500)
  ev(`window.__sts.getState().endTurn()`); await sleep(2600)
  shot('enemy')
  try { cli(['close']); await sleep(1500); cli(['open', 'about:blank']) } catch {}
}
main()
