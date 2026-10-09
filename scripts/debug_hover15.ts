// 诊断batch15⑥：hover图例条目是否触发高亮
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
function evJson(code: string): any {
  const r = ev(code)
  if (r !== null && typeof r === 'object') return r
  try { return JSON.parse(r) } catch { return { err: String(r).slice(0, 400) } }
}

async function main() {
  cli(['open', 'http://localhost:3000/'])
  await sleep(3500)
  // 直接注入到地图屏（避免完整流程）
  const nav = ev(`(() => { const s=window.__sts.getState(); if(s.run) { const r=JSON.parse(JSON.stringify(s.run)); r.screen='map'; window.__sts.setState({run:r}); return 'set' } const r2={screen:'map'}; return 'norun' })()`)
  console.log('注入:', nav)
  await sleep(1600)
  // 有run吗？若无则快速开始一局到地图
  const hasRun = ev(`!!window.__sts.getState().run`)
  console.log('hasRun:', hasRun)
  if (hasRun !== true) {
    cli(['eval', `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('开 始'))?.click()`])
    await sleep(1800)
    cli(['eval', `[...document.querySelectorAll('button')].find(b=>/出\\s*发/.test(b.textContent))?.click()`])
    await sleep(2500)
    for (let i = 0; i < 8 && ev(`window.__sts.getState().run?.screen`) !== 'map'; i++) {
      ev(`(() => { const ov=document.querySelector('.overlay'); if(ov){ const c=ov.querySelector('[class*=card-selectable]'); if(c){c.click(); return 1} } const opts=[...document.querySelectorAll('button')].filter(b=>/获得|赠予|赐予|交换|代价/.test(b.textContent)); if(opts.length){opts[0].click(); return 2} return 0 })()`)
      await sleep(900)
    }
    await sleep(1600)
  }
  // 图例存在？
  const lg = evJson(`(() => { const items=[...document.querySelectorAll('.sts-map-legend .lg-item')]; return { n: items.length, ltype: items.map(i=>i.dataset.ltype).join(',') } })()`)
  console.log('图例:', JSON.stringify(lg))
  // hover
  const hv = cli(['hover', '[data-ltype="monster"]'])
  console.log('hover输出:', hv.slice(0, 120))
  await sleep(400)
  const hot = evJson(`(() => { const nodes=[...document.querySelectorAll('.sts-map-node.map-hover')]; const hotItem=document.querySelector('.sts-map-legend .lg-item.lg-hot'); return { n: nodes.length, types: [...new Set(nodes.map(n=>n.dataset.ntype))].join(','), hotItem: !!hotItem } })()`)
  console.log('hover后:', JSON.stringify(hot))
  // 手动dispatch mouseenter看React handler是否活着（React onMouseEnter 由 mouseover 合成）
  const manual = evJson(`(() => { const el=document.querySelector('[data-ltype="monster"]'); if(!el) return {err:'noel'}; el.dispatchEvent(new MouseEvent('mouseover', {bubbles:true, relatedTarget: document.body})); return {ok:1} })()`)
  await sleep(400)
  const hot2 = evJson(`(() => ({ n: document.querySelectorAll('.sts-map-node.map-hover').length, hotItem: !!document.querySelector('.lg-item.lg-hot') })()`)
  console.log('手动mouseover后:', JSON.stringify(hot2))
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
