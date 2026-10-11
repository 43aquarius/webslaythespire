// 第三十批截图：检视屏多场景（普通卡/升级预览/诅咒卡/tips）双版本
import { execFileSync } from 'child_process'
import { mkdirSync } from 'fs'

const MODE = (process.argv[2] === 'standalone') ? 'standalone' : 'next'
const URL = MODE === 'next' ? 'http://localhost:3000/' : 'file:///home/z/my-project/download/slay-the-spire-standalone.html'
const OUT = '/home/z/my-project/scripts/study/batch30'
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

async function main() {
  console.log(`== 第三十批截图 [${MODE}] ==`)
  cli(['open', URL])
  await sleep(3500)
  for (let i = 0; i < 15; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(800)
  }
  ev(`window.__sts.getState().startRun('ironclad')`)
  await sleep(1200)
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.deck = [
    {uid:'t30a', id:'bash', upgraded:0}, {uid:'t30c', id:'regret', upgraded:0}, {uid:'t30d', id:'offering', upgraded:0}];
    if (r.players?.[0]) r.players[0].deck = r.deck; r.screen='map'; window.__sts.setState({run:r}); return 'ok' })()`)
  await sleep(800)
  ev(`window.__sts.getState().openPile('deck')`)
  await sleep(900)
  ev(`document.querySelector('[title*="检视"]').click()`)
  await sleep(900)
  // 1. 普通卡检视（bash）
  cli(['screenshot', `${OUT}/scv_base_${MODE}.png`])
  // 2. 升级预览勾选
  ev(`document.querySelector('.scv-upgrade-toggle').click()`)
  await sleep(700)
  cli(['screenshot', `${OUT}/scv_upgrade_${MODE}.png`])
  // 3. 诅咒卡 regret
  ev(`(() => { const ks = new KeyboardEvent('keydown', {key:'Escape', bubbles:true}); window.dispatchEvent(ks); return 'esc' })()`)
  await sleep(500)
  ev(`document.querySelector('[title*="检视"]').click()`)
  await sleep(700)
  ev(`(() => { const arrows = document.querySelectorAll('.scv-arrow-next'); arrows[arrows.length-1].click(); return 'p2' })()`)
  await sleep(700)
  cli(['screenshot', `${OUT}/scv_curse_${MODE}.png`])
  // 4. tips（offering 消耗）
  ev(`(() => { const ks = new KeyboardEvent('keydown', {key:'Escape', bubbles:true}); window.dispatchEvent(ks); return 'esc' })()`)
  await sleep(500)
  ev(`document.querySelector('[title*="检视"]').click()`)
  await sleep(700)
  ev(`(() => { const arrows = document.querySelectorAll('.scv-arrow-next'); arrows[arrows.length-1].click(); return 'p2' })()`)
  await sleep(700)
  ev(`(() => { const arrows = document.querySelectorAll('.scv-arrow-next'); arrows[arrows.length-1].click(); return 'p3' })()`)
  await sleep(900)
  cli(['screenshot', `${OUT}/scv_tips_${MODE}.png`])
  console.log(`完成: ${OUT}/scv_{base,upgrade,curse,tips}_${MODE}.png`)
}

main().catch(e => { console.error(e); process.exit(1) })
