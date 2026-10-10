// 第二十五批 VLM 验收截图：战斗手牌（类型行位置/颜色/无图标）
// 用法: npx tsx scripts/shot_batch25.ts [next|standalone]
import { execFileSync } from 'child_process'
import { mkdirSync } from 'fs'

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
  mkdirSync('scripts/study/batch25', { recursive: true })
  cli(['open', URL])
  await sleep(3500)
  for (let i = 0; i < 12; i++) { if (ev(`typeof window.__sts === 'function'`) === true) break; await sleep(800) }
  // 进战斗（普通怪）
  ev(`(() => { const g = window.__sts.getState(); g.startRun('ironclad'); const r = JSON.parse(JSON.stringify(g.getState().run)); r.screen = 'map'; window.__sts.setState({ run: r }); return 'ok' })()`)
  await sleep(2400)
  ev(`(() => { const g = window.__sts.getState(), r = g.run; const reach = r.currentNodeId ? r.map.nodes[r.currentNodeId].edges : r.map.startNodes; const n = reach.map(id => r.map.nodes[id]).find(n => n.type === 'monster') || reach.map(id => r.map.nodes[id]).find(n => n.type !== 'boss'); if (n) g.chooseNode(n.id); return 'ok' })()`)
  // 等战斗屏挂载
  for (let i = 0; i < 10; i++) { if (ev(`!!document.querySelector('.card-type-row span')`) === true) break; await sleep(400) }
  await sleep(1800) // 手牌入场动画
  const tag = MODE === 'next' ? 'next' : 'sa'
  cli(['screenshot', `scripts/study/batch25/hand_${tag}.png`])
  console.log(`saved: scripts/study/batch25/hand_${tag}.png`)
  // 再来一张放大：悬停中位卡（agent-browser hover 需坐标；改用 CSS 静态放大——直接对 .card-type-row 区域裁剪由 VLM 处理）
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
