// 第十四批视觉截图：升级预览/篝火去饱和+烟雾/卡牌涟漪
import { execFileSync } from 'child_process'

const URL = process.argv[2] || 'http://localhost:3000/'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const OUT = '/home/z/my-project/scripts/study/batch13'

function ev(code: string): any {
  try {
    const out = execFileSync('agent-browser', ['eval', code, '--json'], { encoding: 'utf-8', timeout: 60000 })
    const j = JSON.parse(out)
    return j?.data?.result ?? j?.data ?? ''
  } catch (e: any) {
    return 'ERR:' + (e.stdout || e.message || '').slice(0, 300)
  }
}

async function main() {
  execFileSync('agent-browser', ['open', URL], { encoding: 'utf-8', timeout: 60000 })
  await sleep(3000)
  for (let i = 0; i < 15; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(1000)
  }
  ev(`window.__sts.getState().startRun('ironclad')`)
  await sleep(3500)
  ev(`window.__sts.getState().chooseNeow(1)`)
  for (let i = 0; i < 12; i++) {
    const s = ev(`window.__sts.getState().run?.screen`)
    if (s === 'map') break
    await sleep(800)
  }
  ev(`(() => { const st = window.__sts.getState(); const r = st.run; if (r && r.screen === 'map') { st.chooseNode(r.map.startNodes[0]); return 'ok' } return 'notmap' })()`)
  for (let i = 0; i < 12; i++) {
    if (ev(`window.__sts.getState().run?.screen`) === 'combat') break
    await sleep(700)
  }
  await sleep(2000)

  // === 截图1：武装升级预览 ===
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.combat.players[0].hand.push({ uid: 'shot_arm', id: 'armaments', upgraded: 0 }); window.__sts.setState({ run: r }); return 'ok' })()`)
  await sleep(500)
  ev(`window.__sts.getState().playCard('shot_arm', null)`)
  await sleep(900)
  ev(`(() => { const el = document.querySelector('.sts-card-selectable'); if (el) el.click(); return 'ok' })()`)
  await sleep(700)
  execFileSync('agent-browser', ['screenshot', `${OUT}/upgrade_preview.png`], { encoding: 'utf-8', timeout: 60000 })
  // 关闭预览：确认升级
  ev(`(() => { const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('确认升级')); if (btn) btn.click(); return 'ok' })()`)
  await sleep(800)

  // === 截图2：篝火去饱和+烟雾（动画中段） ===
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.screen = 'rest'; if (r.combat) r.combat = null; window.__sts.setState({ run: r }); return 'ok' })()`)
  await sleep(800)
  ev(`(() => { const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('休息')); if (btn) btn.click(); return 'ok' })()`)
  await sleep(1100) // 去饱和最深时
  execFileSync('agent-browser', ['screenshot', `${OUT}/rest_desat.png`], { encoding: 'utf-8', timeout: 60000 })
  await sleep(2000)

  // === 截图3：卡牌涟漪（牌组选牌界面） ===
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.screen = 'rest'; window.__sts.setState({ run: r }); return 'ok' })()`)
  await sleep(700)
  ev(`window.__sts.getState().restAction('smith')`)
  await sleep(900)
  execFileSync('agent-browser', ['screenshot', `${OUT}/card_shimmer.png`], { encoding: 'utf-8', timeout: 60000 })

  console.log('截图完成')
}

main().catch(e => { console.error(e); process.exit(1) })
