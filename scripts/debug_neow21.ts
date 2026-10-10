// 诊断：neow 屏选项按钮文案 + overlay 状态
import { execFileSync } from 'child_process'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
function cli(args: string[]) {
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
  cli(['open', 'http://localhost:3000/'])
  await sleep(3500)
  for (let i = 0; i < 12; i++) { if (ev(`typeof window.__sts === 'function'`) === true) break; await sleep(800) }
  ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('开 始'))?.click()`)
  for (let i = 0; i < 10; i++) { if (ev(`[...document.querySelectorAll('button')].some((b:any)=>/出\\s*发/.test(b.textContent))`) === true) break; await sleep(400) }
  ev(`[...document.querySelectorAll('button')].find((b:any)=>/出\\s*发/.test(b.textContent))?.click()`)
  await sleep(2800)
  for (let step = 0; step < 6; step++) {
    const info = ev(`(() => {
      const st = window.__sts.getState()
      const btns = [...document.querySelectorAll('button')].map(b => (b.textContent || '').trim().slice(0, 30)).filter(t => t)
      const ov = document.querySelector('.overlay')
      const ovCards = ov ? ov.querySelectorAll('[class*=card-selectable]').length : 0
      const sel = st.select ? st.select.kind : null
      return JSON.stringify({ screen: st.run?.screen, sel, nbtn: btns.length, btns: btns.slice(0, 8), ovCards })
    })()`)
    console.log(`step${step}:`, String(info).slice(0, 400))
    if (ev(`window.__sts.getState().run?.screen`) === 'map') break
    // 尝试点击
    const r = ev(`(() => {
      const ov=document.querySelector('.overlay')
      if(ov){ const c=ov.querySelector('[class*=card-selectable]'); if(c){c.click(); return 'ov-card'} }
      const opts=[...document.querySelectorAll('button')].filter(b=>/获得|赠予|赐予|交换|代价|净化/.test(b.textContent))
      if(opts.length){opts[0].click(); return 'btn:'+opts[0].textContent.trim().slice(0,20)}
      return 'none'
    })()`)
    console.log(`  click →`, r)
    await sleep(1000)
  }
}
main()
