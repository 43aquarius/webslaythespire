// 诊断第二十三批 E 区：rest 屏是否有 .top-hud
import { execFileSync } from 'child_process'
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

async function main() {
  cli(['open', 'http://localhost:3000/'])
  await sleep(3500)
  for (let i = 0; i < 12; i++) { if (ev(`typeof window.__sts === 'function'`) === true) break; await sleep(800) }
  // 快速开一局（直接 store 层）
  ev(`window.__sts.setState({ run: window.__sts.getState().makeRunFor ? null : null })`)
  // 走 UI 太慢——直接用 startRun store API？startRun 需要参数。看 store:
  const api = ev(`JSON.stringify(Object.keys(window.__sts.getState()).filter(k => /start|new/i.test(k)))`)
  console.log('store API:', api)
  // 退而求其次：走 UI 快速导航（开始→选角→出发→涅奥）
  cli(['eval', `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('开 始'))?.click()`])
  await sleep(1800)
  cli(['eval', `[...document.querySelectorAll('button')].find(b=>/铁甲战士/.test(b.textContent))?.click()`])
  await sleep(1200)
  for (let i = 0; i < 4; i++) {
    cli(['eval', `[...document.querySelectorAll('button')].find(b=>/出\\s*发/.test(b.textContent))?.click()`])
    await sleep(1500)
    if (ev(`!!window.__sts.getState().run`) === true) break
  }
  for (let i = 0; i < 14; i++) {
    const s = ev(`window.__sts.getState().run?.screen`)
    if (s === 'map') break
    ev(`(() => { const g = window.__sts.getState(); if (g.run?.screen === 'neow') g.chooseNeow(1); const sel = g.select; if (sel && sel.cardUids?.length) g.resolveSelect(sel.cardUids[0]); return 1 })()`)
    await sleep(700)
  }
  await sleep(2000)
  console.log('screen:', ev(`window.__sts.getState().run?.screen`))
  // 切 rest
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.screen = 'rest'; r.mpRest = null; window.__sts.setState({ run: r }); return 1 })()`)
  await sleep(2800)
  const info = ev(`(() => {
    const st = window.__sts.getState()
    const top = document.querySelector('.top-hud')
    const stage = document.querySelector('[data-stage]')
    return {
      screen: st.run?.screen,
      hasTop: !!top,
      topInBody: !!document.body.querySelector('.top-hud'),
      bodyKids: document.body ? document.body.innerHTML.length : 0,
      stageHtml: stage ? stage.innerHTML.slice(0, 300) : null,
      topHtml: top ? top.outerHTML.slice(0, 200) : null
    }
  })()`)
  console.log('REST INFO:', JSON.stringify(info, null, 2))
  cli(['close'])
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
