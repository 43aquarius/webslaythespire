// 第二十八批 VLM 验收截图采集：标题屏大字 + 战斗手牌卡面特写（双版本）
import { execFileSync } from 'child_process'
import * as fs from 'fs'

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
  const dir = '/tmp/font_pilot'
  fs.mkdirSync(dir, { recursive: true })
  // 1. 标题屏（viewport 放大）
  cli(['open', URL])
  await sleep(4000)
  cli(['screenshot', `${dir}/b28_${MODE}_title.png`])

  // 2. 战斗 + 手牌卡面特写（viewport 1280x800 保证卡完整，batch25 教训）
  ev(`(() => { const g = window.__sts.getState(); g.startRun('ironclad'); const r = JSON.parse(JSON.stringify(g.getState().run)); r.screen = 'map'; window.__sts.setState({ run: r }); return 'ok' })()`)
  await sleep(2400)
  ev(`(() => {
    const g = window.__sts.getState(), r = g.run
    const reach = r.currentNodeId ? r.map.nodes[r.currentNodeId].edges : r.map.startNodes
    const n = reach.map(id => r.map.nodes[id]).find(n => n.type === 'monster') || reach.map(id => r.map.nodes[id]).find(n => n.type !== 'boss')
    if (n) g.chooseNode(n.id)
    return 'ok'
  })()`)
  await sleep(2200)
  cli(['screenshot', `${dir}/b28_${MODE}_combat.png`])

  // 3. 卡面放大特写：hover 第一张手牌
  ev(`(() => {
    const card = document.querySelector('.sts-card, .card-inner, [class*=hand] [class*=card]')
    if (card) { const r = card.getBoundingClientRect(); const ev2 = new MouseEvent('mousemove', { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }); card.dispatchEvent(ev2) }
    return card ? 'ok' : 'nocard'
  })()`)
  await sleep(900)
  cli(['screenshot', `${dir}/b28_${MODE}_card.png`])
  console.log(`${MODE} 截图完成: title/combat/card`)
}
main()
