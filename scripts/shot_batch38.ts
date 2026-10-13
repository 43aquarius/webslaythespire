// 第三十八批：对齐远端37批后的冒烟验证（主页/地图/预览三问题）+ 本批按钮增量验收
// 用法: npx tsx scripts/shot_batch38.ts
import { execFileSync } from 'child_process'
import { mkdirSync } from 'fs'

const OUT = '/home/z/my-project/scripts/study/batch38'
mkdirSync(OUT, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function ev(code: string): any {
  try {
    const out = execFileSync('agent-browser', ['eval', code, '--json'], { encoding: 'utf-8', timeout: 60000 })
    const j = JSON.parse(out)
    return j?.data?.result ?? j?.data ?? ''
  } catch (e: any) { return 'ERR:' + (e.stdout || e.message || '').slice(0, 300) }
}
function shot(name: string) {
  execFileSync('agent-browser', ['screenshot', `${OUT}/${name}.png`], { encoding: 'utf-8', timeout: 60000 })
  console.log(`✓ ${name}.png`)
}
function open(url: string) {
  execFileSync('agent-browser', ['open', url], { encoding: 'utf-8', timeout: 60000 })
}
function broken(): string {
  return ev(`(() => {
    const bad = []
    document.querySelectorAll('img').forEach(im => { if (!im.complete || im.naturalWidth === 0) bad.push(im.getAttribute('src')) })
    return bad.length ? bad.slice(0, 8).join('|') : 'NONE'
  })()`)
}

async function main() {
  // A. 主菜单
  open('http://127.0.0.1:3000/')
  await sleep(5000)
  console.log('主页破图:', broken())
  shot('menu')

  // B. 子界面（设置）
  ev(`(() => { window.__sts.getState().gotoMenuScreen('settings'); return 'ok' })()`)
  await sleep(1300)
  shot('settings')

  // C. 地图（真实路径 startRun→选角→出发→Neow; 远端模式 chooseNeow(1)+resolveSelect）
  open('http://127.0.0.1:3000/')
  await sleep(3500)
  const nav = ev(`(() => {
    const st = window.__sts.getState()
    st.startRun('ironclad')
    const s2 = window.__sts.getState()
    if (s2.run.screen !== 'neow') return 'screen=' + s2.run.screen
    // 选一个无需后续选择的祝福(金币类)
    const opts = s2.run.neow.options.map((o, i) => ({ i, eff: o.effect }))
    const gold = opts.find(o => o.eff === 'gold')
    if (gold) s2.chooseNeow(gold.i)
    const s3 = window.__sts.getState()
    if (s3.select) { s3.resolveSelect(null); }
    return 'screen=' + window.__sts.getState().run.screen
  })()`)
  console.log('导航:', nav)
  await sleep(2400)
  console.log('地图破图:', broken())
  shot('map')
  // 滚到顶
  ev(`(() => { const els = [...document.querySelectorAll('*')].filter(el => el.scrollHeight > el.clientHeight + 100 && el.clientHeight > 200); const sc = els[els.length-1]; if (sc) { sc.scrollTop = 0; return 'top' } return 'none' })()`)
  await sleep(900)
  shot('map_top')

  // D. standalone
  open('file:///home/z/my-project/download/slay-the-spire-standalone.html')
  await sleep(5000)
  console.log('standalone 主页破图:', broken())
  shot('std_menu')
  console.log('DONE')
}
main()
