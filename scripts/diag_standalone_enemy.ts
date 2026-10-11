// standalone 敌人渲染诊断：进战斗检查每个敌人 img 的加载状态
import { execFileSync } from 'child_process'
const URL = 'file:///home/z/my-project/download/slay-the-spire-standalone.html'
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
  cli(['open', URL])
  await sleep(4000)
  for (let i = 0; i < 12; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(800)
  }
  ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('开 始'))?.click()`)
  for (let i = 0; i < 10; i++) {
    if (ev(`[...document.querySelectorAll('button')].some(b=>/铁甲战士/.test(b.textContent))`) === true) break
    await sleep(400)
  }
  ev(`[...document.querySelectorAll('button')].find(b=>/铁甲战士/.test(b.textContent))?.click()`)
  for (let i = 0; i < 10; i++) {
    if (ev(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('出 发'))`) === true) break
    await sleep(400)
  }
  ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('出 发'))?.click()`)
  await sleep(2500)
  for (let i = 0; i < 14 && ev(`window.__sts.getState().run?.screen`) !== 'map'; i++) {
    const j = ev(`(() => { const g = window.__sts.getState(); return JSON.stringify({ s: g.run?.screen, sel: g.select ? g.select.kind : null, uids: g.select?.cardUids?.slice(0,2) }) })()`)
    const jj = JSON.parse(j || '{}')
    if (jj.s === 'map' && !jj.sel) break
    if (jj.s === 'neow') ev(`window.__sts.getState().chooseNeow(1)`)
    if (jj.sel && Array.isArray(jj.uids) && jj.uids.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(jj.uids[0])})`)
    await sleep(700)
  }
  for (let i = 0; i < 14; i++) {
    const clicked = ev(`(() => { const el=document.querySelector('#map-nodes .node.reach'); if(!el) return 'n/a'; el.click(); return 'go' })()`)
    if (clicked === 'go') break
    await sleep(450)
  }
  await sleep(5000)
  // 诊断: 敌人 img 状态
  const info = ev(`(() => {
    const st = window.__sts.getState()
    const enemies = (st.run?.combat?.enemies || []).map(e => e.id)
    const imgs = [...document.querySelectorAll('.sprite img, img.idle-bob')].map(im => ({
      src_head: (im.getAttribute('src')||'').slice(0, 30),
      nw: im.naturalWidth, complete: im.complete,
      w: im.offsetWidth
    }))
    return JSON.stringify({ screen: st.run?.screen, enemies, imgs })
  })()`)
  console.log(info)
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
