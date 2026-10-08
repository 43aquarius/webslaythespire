// 第十五批截图：地图点状路径+标记 / 事件打字机 / 房间黑幕
// 用法: npx tsx scripts/shot_batch15.ts [url]
import { execFileSync } from 'child_process'

const URL = process.argv[2] || 'http://127.0.0.1:3100/'
const OUT = '/home/z/my-project/scripts/study/batch15'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function ev(code: string): any {
  try {
    const out = execFileSync('agent-browser', ['eval', code, '--json'], { encoding: 'utf-8', timeout: 60000 })
    const j = JSON.parse(out)
    return j?.data?.result ?? j?.data ?? ''
  } catch (e: any) {
    return 'ERR:' + (e.stdout || e.message || '').slice(0, 200)
  }
}
function shot(name: string) {
  execFileSync('agent-browser', ['screenshot', `${OUT}/${name}.png`], { encoding: 'utf-8', timeout: 60000 })
  console.log(`✓ ${name}.png`)
}

async function main() {
  execFileSync('agent-browser', ['open', URL], { encoding: 'utf-8', timeout: 60000 })
  await sleep(3000)
  for (let i = 0; i < 15; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(1000)
  }
  await sleep(1000)

  // 开局 → 地图（走两步有走过路径+标记）
  ev(`window.__sts.getState().startRun('ironclad')`)
  for (let i = 0; i < 10; i++) { if (ev(`window.__sts.getState().run?.screen`) === 'neow') break; await sleep(700) }
  ev(`window.__sts.getState().chooseNeow(1)`)
  for (let i = 0; i < 12; i++) {
    const sel = ev(`window.__sts.getState().select?.cardUids?.[0]`)
    if (ev(`window.__sts.getState().run?.screen`) === 'map' && !sel) break
    if (sel) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(sel)})`)
    await sleep(800)
  }
  await sleep(2500)
  // 第一跳（首步）
  ev(`(() => { const st = window.__sts.getState(); const r = st.run; if (r.screen === 'map') { st.chooseNode(r.map.startNodes[0]); return 'ok' } return 'notmap' })()`)
  for (let i = 0; i < 12; i++) { if (ev(`window.__sts.getState().run?.screen`) === 'combat') break; await sleep(700) }
  await sleep(2300)
  // 注入回地图（有标记+走过路径）
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.screen = 'map'; window.__sts.setState({ run: r }); return 'ok' })()`)
  await sleep(2600)
  shot('map_dots_marker')

  // 墨迹中途：点击下一节点，280ms 时截图（黑幕未起）
  ev(`(() => {
    const el = [...document.querySelectorAll('.sts-map-node.sts-map-pulse')].find(n => n.dataset.ntype !== 'boss')
    if (el) { el.click(); return 'ok' }
    return 'noreach'
  })()`)
  await sleep(300)
  shot('map_inking')

  // 等黑幕扫落中段（选点后550ms跳转 → out相位 0.5-1.1s 即 800ms 处）
  for (let i = 0; i < 12; i++) { if (ev(`window.__sts.getState().run?.screen`) === 'combat') break; await sleep(500) }
  await sleep(750)
  shot('room_fade_out')
  await sleep(2500)

  // 事件界面打字机中途
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.players[0].gold = 10; r.currentEvent = 'cleric'; r.screen = 'event'; window.__sts.setState({ run: r }); return 'ok' })()`)
  await sleep(2300) // 黑幕切换1.1s + 打字机进行中(0.75-1.75s)
  shot('event_typewriter')
  await sleep(1600)
  shot('event_done')
  console.log('done')
}

main().catch(e => { console.error(e); process.exit(1) })
