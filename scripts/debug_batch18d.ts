// 诊断第十八批D区失败：手动走 开始→出发→涅奥→地图 流程
import { execFileSync } from 'child_process'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
function cli(args: string[]): string {
  try { return execFileSync('agent-browser', args, { encoding: 'utf-8', timeout: 60000 }) }
  catch (e: any) { return 'ERR:' + (e.stdout || e.message || '').slice(0, 300) }
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
  for (let i = 0; i < 12; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(800)
  }
  console.log('store就绪:', ev(`typeof window.__sts === 'function'`))

  // 1. 找开始按钮
  const btns1 = ev(`[...document.querySelectorAll('button')].map(b => JSON.stringify(b.textContent.trim())).join(',')`)
  console.log('主菜单按钮:', btns1)

  // 2. 点击开始冒险
  const r1 = ev(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('开 始')); if(!b) return 'notfound'; b.click(); return 'clicked' })()`)
  console.log('点击开始:', r1)
  await sleep(800)
  console.log('点击后screen:', ev(`window.__sts.getState().screen`), '| menuScreen:', ev(`window.__sts.getState().menuScreen`))

  // 3. 出发
  const r2 = ev(`(() => { const b=[...document.querySelectorAll('button')].find(b=>/出\\s*发/.test(b.textContent)); if(!b) return 'notfound'; b.click(); return 'clicked' })()`)
  console.log('点击出发:', r2)
  await sleep(2500)
  const st1 = ev(`(() => { const s=window.__sts.getState(); return JSON.stringify({ menuScreen: s.menuScreen, runNull: s.run === null, runScreen: s.run?.screen }) })()`)
  console.log('出发后状态:', st1)

  // 4. 涅奥循环（打印每步）
  for (let i = 0; i < 10; i++) {
    const info = ev(`(() => { const s=window.__sts.getState(); return JSON.stringify({ i: ${i}, screen: s.run?.screen, buttons: [...document.querySelectorAll('button')].map(b=>b.textContent.trim().slice(0,18)).slice(0,8), cards: document.querySelectorAll('[class*=card]').length }) })()`)
    console.log(`涅奥步${i}:`, info)
    if (ev(`window.__sts.getState().run?.screen`) === 'map') { console.log('  → 已到map'); break }
    const act = ev(`(() => { const ov=document.querySelector('[class*=overlay]'); if(ov){ const c=[...ov.querySelectorAll('[class*=card]')][0]; if(c){c.click(); return 'click-card'} } const opts=[...document.querySelectorAll('button')].filter(b=>/获得|赠予|赐予|交换|代价/.test(b.textContent)); if(opts.length){opts[0].click(); return 'click-opt:'+opts[0].textContent.trim().slice(0,12)} return 'none' })()`)
    console.log('  动作:', act)
    await sleep(900)
  }
  const final = ev(`(() => { const s=window.__sts.getState(); return JSON.stringify({ screen: s.run?.screen }) })()`)
  console.log('最终:', final)
  // 原始JSON输出形状检查
  console.log('原始eval输出:', cli(['eval', `window.__sts.getState().run?.screen`, '--json']).slice(0, 200))
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
