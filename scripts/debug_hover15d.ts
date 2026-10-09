// 诊断4：直接调用fiber handler + 检查触摸模拟状态
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
  console.log('当前屏:', ev(`window.__sts.getState().run?.screen`))

  // 0. 触摸/指针环境
  const env = evJson(`(() => ({ hoverNone: matchMedia('(hover: none)').matches, coarse: matchMedia('(pointer: coarse)').matches, maxTouch: navigator.maxTouchPoints, ua: navigator.userAgent.slice(0, 60) }))()`)
  console.log('环境:', JSON.stringify(env))

  // 1. 直接调用 fiber 的 onMouseEnter
  const direct = evJson(`(() => {
    const el = document.querySelector('[data-ltype="monster"]');
    if (!el) return { err: 'noel' };
    const propKey = Object.keys(el).find(k => k.startsWith('__reactProps'));
    if (!propKey) return { err: 'noprops' };
    const props = el[propKey];
    if (!props.onMouseEnter) return { err: 'nohandler' };
    props.onMouseEnter({ type: 'mouseenter' });
    return { called: true };
  })()`)
  console.log('直接调用handler:', JSON.stringify(direct))
  await sleep(500)
  const hot1 = evJson(`(() => ({ n: document.querySelectorAll('.sts-map-node.map-hover').length, hot: !!document.querySelector('.lg-item.lg-hot') }))()`)
  console.log('直接调用后:', JSON.stringify(hot1))

  // 2. 清理（调用 onMouseLeave）
  ev(`(() => { const el=document.querySelector('[data-ltype="monster"]'); const k=Object.keys(el).find(k=>k.startsWith('__reactProps')); el[k].onMouseLeave({type:'mouseleave'}); return 1 })()`)
  await sleep(300)

  // 3. 用 CDP 真实坐标 hover（mousemove 到元素中心）
  const box = evJson(`(() => { const r=document.querySelector('[data-ltype="monster"]').getBoundingClientRect(); return { x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2) } })()`)
  console.log('图例中心坐标:', JSON.stringify(box))
  const mv = cli(['eval', `(() => { const el=document.elementFromPoint(${box.x},${box.y}); return el ? (el.dataset.ltype || el.tagName) : 'none' })()`])
  console.log('该坐标元素:', mv)
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
