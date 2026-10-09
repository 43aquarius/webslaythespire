// 诊断3：React事件委托是否工作
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
  const onMap = ev(`window.__sts.getState().run?.screen`)
  console.log('当前屏:', onMap)

  // 1. root级mouseover监听器探针：dispatch到lg-item，看是否冒泡到document
  const probe = evJson(`(() => {
    window.__probeHits = [];
    document.addEventListener('mouseover', e => { window.__probeHits.push('doc:' + (e.target && e.target.dataset ? (e.target.dataset.ltype || e.target.tagName) : '?')) }, true);
    const el = document.querySelector('[data-ltype="monster"]');
    if (!el) return { err: 'noel' };
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
    return { hits: window.__probeHits };
  })()`)
  console.log('冒泡探针:', JSON.stringify(probe))

  // 2. 对照组：React onClick 是否工作（点地图节点会触发选择）
  //    用一个React按钮：涅奥屏不存在了，用音乐设置按钮(title=音乐设置)
  const before = ev(`window.__sts.getState().menuScreen || (window.__sts.getState().run ? 'run:' + window.__sts.getState().run.screen : '?')`)
  console.log('点击前状态:', before)

  // 3. 检查lg-item是否有React fiber监听（reactProps）
  const fiber = evJson(`(() => {
    const el = document.querySelector('[data-ltype="monster"]');
    if (!el) return { err: 'noel' };
    const keys = Object.keys(el).filter(k => k.startsWith('__react'));
    let hasMouseEnter = false;
    for (const k of keys) { const p = (el as any)[k]; if (p && p.memoizedProps && p.memoizedProps.onMouseEnter) hasMouseEnter = true; }
    return { reactKeys: keys.join(','), hasMouseEnter };
  })()`.replace('(el as any)', 'el'))
  console.log('fiber检查:', JSON.stringify(fiber))
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
