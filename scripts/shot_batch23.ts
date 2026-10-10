// 第二十三批 VLM 截图：顶栏常态/hover1.2x/齿轮定格/战斗VFX/篝火屏顶栏（双版本）
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

async function main() {
  const dir = 'scripts/study/b23'
  cli(['open', URL])
  await sleep(3500)
  for (let i = 0; i < 12; i++) { if (ev(`typeof window.__sts === 'function'`) === true) break; await sleep(800) }
  // 快速开一局到地图
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
  await sleep(2400)
  cli(['screenshot', `${dir}/${MODE}_1_topbar_map.png`])
  // hover 心 1.2x + 名字
  cli(['hover', '#hud-hp'])
  await sleep(400)
  cli(['screenshot', `${dir}/${MODE}_2_hover_hp.png`])
  cli(['hover', 'body'])
  // 金币花费中红
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.players[0].gold = 99; window.__sts.setState({ run: r }); return 1 })()`)
  await sleep(150)
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.players[0].gold = 40; window.__sts.setState({ run: r }); return 1 })()`)
  await sleep(700)
  cli(['screenshot', `${dir}/${MODE}_3_gold_red.png`])
  // 齿轮 hover 定格
  cli(['hover', '.tp-tico.settings'])
  await sleep(400)
  cli(['screenshot', `${dir}/${MODE}_4_gear_hover.png`])
  cli(['hover', 'body'])
  // 进战斗 → VFX
  const nodeSel = MODE === 'next' ? ".sts-map-node.sts-map-pulse" : "#map-nodes .node.reach"
  for (let i = 0; i < 14; i++) {
    const c = ev(`(() => { const el=document.querySelector('${nodeSel}[data-ntype=monster]')||document.querySelector('${nodeSel}'); if(!el) return 'n/a'; el.click(); return 'go' })()`)
    if (c === 'go') break
    await sleep(450)
  }
  await sleep(1500)
  // 战斗开始即有首回合 VFX——进战斗 1.5s 时截图（VFX 2s 窗口内）
  cli(['screenshot', `${dir}/${MODE}_5_energy_vfx.png`])
  await sleep(3500)
  cli(['screenshot', `${dir}/${MODE}_6_combat_topbar.png`])
  // rest 屏
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.screen = 'rest'; r.mpRest = null; window.__sts.setState({ run: r }); return 1 })()`)
  await sleep(2600)
  cli(['screenshot', `${dir}/${MODE}_7_rest_topbar.png`])
  console.log(`[${MODE}] 7 张截图 -> scripts/study/b23/`)
  try { cli(['close']); await sleep(1200); cli(['open', 'about:blank']) } catch {}
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
