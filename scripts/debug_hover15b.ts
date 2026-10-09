// 诊断2：手动mouseover+relatedTarget 与 React handler
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
  // 复用上个脚本已到达的地图页（浏览器会话还在）
  const onMap = ev(`window.__sts.getState().run?.screen`)
  console.log('当前屏:', onMap)
  if (onMap !== 'map') { console.log('不在地图，中止'); return }

  // 1. 手动 mouseover + relatedTarget（React onMouseEnter 合成路径）
  ev(`(() => { const el=document.querySelector('[data-ltype="monster"]'); if(!el) return 'noel'; el.dispatchEvent(new MouseEvent('mouseover', {bubbles:true, relatedTarget: document.body})); return 'ok' })()`)
  await sleep(500)
  let hot = evJson(`(() => { const n=document.querySelectorAll('.sts-map-node.map-hover').length; const h=!!document.querySelector('.lg-item.lg-hot'); return { n: n, hot: h } })()`)
  console.log('手动mouseover后:', JSON.stringify(hot))

  // 2. agent-browser 原生 hover 再试一次（先移开）
  ev(`(() => { document.querySelectorAll('.lg-item').forEach(i=>i.dispatchEvent(new MouseEvent('mouseout', {bubbles:true, relatedTarget: document.body}))); return 1 })()`)
  await sleep(200)
  cli(['hover', '[data-ltype="monster"]'])
  await sleep(500)
  hot = evJson(`(() => { const n=document.querySelectorAll('.sts-map-node.map-hover').length; const h=!!document.querySelector('.lg-item.lg-hot'); return { n: n, hot: h } })()`)
  console.log('agent-browser hover后:', JSON.stringify(hot))

  // 3. 检查事件监听是否被 React 挂载（React 18 root 委托）
  const root = ev(`(() => { const r=document.getElementById('__next') || document.querySelector('#__next') || document.body.firstElementChild; return r ? (r.id || r.tagName) : 'none' })()`)
  console.log('React root容器:', root)

  // 4. lg-hot 类是 CSS 还是 JS 添加？查源码逻辑
  const lgHtml = ev(`(() => { const el=document.querySelector('[data-ltype="monster"]'); return el ? el.outerHTML.slice(0, 300) : 'none' })()`)
  console.log('图例条目HTML:', lgHtml)
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
