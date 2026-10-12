// 第三十五批 VLM 视觉验收：CSS陈旧修复后的结束回合按钮渲染（dev:3000 此前整段 endturn CSS 丢失）
// 用法: npx tsx scripts/vlm_review_b35.ts
import { execFileSync } from 'child_process'
import ZAI from 'z-ai-web-dev-sdk'
import { readFileSync, mkdirSync } from 'fs'

const URL = 'http://localhost:3000/'
const DIR = 'scripts/study/batch35'
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
  mkdirSync(DIR, { recursive: true })
  console.log('== 截图采集（dev:3000 战斗屏 结束回合按钮） ==')
  cli(['open', URL])
  await sleep(3500)
  for (let i = 0; i < 12; i++) { if (ev(`typeof window.__sts === 'function'`) === true) break; await sleep(800) }
  // 导航到战斗（复刻 test_batch22 流程）
  for (let i = 0; i < 10; i++) { if (ev(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('开 始'))`) === true) break; await sleep(400) }
  cli(['eval', `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('开 始'))?.click()`])
  for (let i = 0; i < 10; i++) { if (ev(`[...document.querySelectorAll('button')].some(b=>/铁甲战士/.test(b.textContent))`) === true) break; await sleep(400) }
  cli(['eval', `[...document.querySelectorAll('button')].find(b=>/铁甲战士/.test(b.textContent))?.click()`])
  for (let i = 0; i < 10; i++) { if (ev(`[...document.querySelectorAll('button')].some(b=>/出\\s*发/.test(b.textContent))`) === true) break; await sleep(400) }
  for (let attempt = 0; attempt < 3; attempt++) {
    cli(['eval', `[...document.querySelectorAll('button')].find(b=>/出\\s*发/.test(b.textContent))?.click()`])
    for (let i = 0; i < 6; i++) { if (ev(`!!window.__sts.getState().run`) === true) break; await sleep(500) }
    if (ev(`!!window.__sts.getState().run`) === true) break
    await sleep(800)
  }
  for (let i = 0; i < 14 && ev(`window.__sts.getState().run?.screen`) !== 'map'; i++) {
    const j = ev(`(() => { const g = window.__sts.getState(); return JSON.stringify({ screen: g.run?.screen, sel: g.select ? g.select.kind : null, uids: g.select?.cardUids?.slice(0, 2) }) })()`)
    let scr = ''
    try { scr = JSON.parse(j).screen } catch { scr = '' }
    if (scr === 'map') break
    if (scr === 'neow') ev(`window.__sts.getState().chooseNeow(1)`)
    const sel = (() => { try { return JSON.parse(j) } catch { return null } })()
    if (sel?.sel && Array.isArray(sel.uids) && sel.uids.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(sel.uids[0])})`)
    await sleep(700)
  }
  await sleep(2400)
  const nodeSel = '.sts-map-node.sts-map-pulse'
  for (let i = 0; i < 14; i++) {
    const c = ev(`(() => { const el=document.querySelector('${nodeSel}[data-ntype=monster]')||document.querySelector('${nodeSel}'); if(!el) return 'n/a'; el.click(); return 'go' })()`)
    if (c === 'go') break
    await sleep(450)
  }
  for (let i = 0; i < 14; i++) { if (ev(`window.__sts.getState().run?.screen`) === 'combat') break; await sleep(450) }
  await sleep(3000)
  const inCombat = ev(`window.__sts.getState().run?.screen`) === 'combat'
  console.log(`进入战斗: ${inCombat}`)
  if (!inCombat) { console.log('FATAL: 未进入战斗'); process.exit(2) }

  // 1. 常态截图
  cli(['screenshot', `${DIR}/endturn_base.png`])
  await sleep(400)
  // 2. 发光态（能量清零→无可出牌）
  ev(`(() => { const st = window.__sts.getState(); if (!st.run) return 'no'; const r = JSON.parse(JSON.stringify(st.run)); r.combat.players[r.combat.activeIdx].energy = 0; window.__sts.setState({ run: r }); return 'ok' })()`)
  await sleep(900)
  cli(['screenshot', `${DIR}/endturn_glow.png`])
  await sleep(400)
  // 3. 按钮区域放大（滚动定位截图右下角）
  ev(`(() => { const b = document.querySelector('.sts-endturn'); if (b) b.scrollIntoView({ block: 'end', inline: 'end' }); return 'ok' })()`)
  await sleep(300)
  cli(['screenshot', `${DIR}/endturn_zoom_hint.png`])

  // 计算样式取证
  const info = ev(`(() => {
    const b = document.querySelector('.sts-endturn')
    if (!b) return { found: false }
    const txt = b.querySelector('.et-text'), plate = b.querySelector('.et-plate')
    return { found: true, cls: b.className, color: getComputedStyle(txt).color, bg: (getComputedStyle(plate).backgroundImage||'').slice(0,60), rect: JSON.stringify(b.getBoundingClientRect()) }
  })()`)
  console.log('按钮计算样式:', JSON.stringify(info))

  console.log('\n== VLM 审查 ==')
  const zai = await (ZAI as any).create()
  const ask = async (imgs: string[], q: string) => {
    const content: any[] = imgs.map(p => ({ type: 'image_url', image_url: { url: `data:image/png;base64,${readFileSync(p).toString('base64')}` } }))
    content.push({ type: 'text', text: q })
    const r = await zai.chat.completions.createVision({ messages: [{ role: 'user', content }] })
    return (r as any).choices?.[0]?.message?.content ?? JSON.stringify(r).slice(0, 400)
  }
  const a = await ask([`${DIR}/endturn_base.png`, `${DIR}/endturn_glow.png`], `这是网页复刻游戏《杀戮尖塔》(Slay the Spire) 的战斗界面截图（图1常态、图2能量耗尽无可出牌态）。请检查右下角"结束回合"按钮并逐项简短回答（每项"符合/不符合+一句说明"）：
1. 图1按钮是否有木质/羊皮纸质感的按钮底板图（而非纯文字或空白）？
2. 图1按钮文字"结束回合"是否为奶白/米黄色（而非黑色/深灰）？
3. 图2按钮是否呈现发光/金色高亮版本（提示玩家无牌可出应结束回合）？
4. 按钮是否完整显示在屏幕内、无被裁切或与其他UI重叠？
5. 整体战斗界面是否有破图、错位或明显样式缺失的区域？`)
  console.log(a)
  try { cli(['close']); await sleep(1500); cli(['open', 'about:blank']) } catch {}
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
