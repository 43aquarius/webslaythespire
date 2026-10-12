// 第三十六批补：奖励屏重拍（combat 非空）+ 全屏破图机械检测 + 404 扫描
import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import ZAI from 'z-ai-web-dev-sdk'

const URL = process.argv[2] === 'standalone' ? 'file:///home/z/my-project/download/slay-the-spire-standalone.html' : 'http://localhost:3000/'
const TAG = process.argv[2] === 'standalone' ? 'sa' : 'next'
const DIR = 'scripts/study/batch36'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
function cli(args: string[]): string {
  try { return execFileSync('agent-browser', args, { encoding: 'utf-8', timeout: 90000 }) }
  catch (e: any) { return 'ERR:' + (e.stdout || e.message || '').slice(0, 200) }
}
function ev(code: string): any {
  try {
    const out = execFileSync('agent-browser', ['eval', code, '--json'], { encoding: 'utf-8', timeout: 90000 })
    const j = JSON.parse(out)
    return j?.data?.result ?? j?.data ?? ''
  } catch (e: any) { return 'ERR:' + (e.stdout || e.message || '').slice(0, 300) }
}

// 破图检测：所有 img naturalWidth===0 + 背景图加载失败探测
const BROKEN_CHK = `(() => {
  const bad = []
  document.querySelectorAll('img').forEach(im => { if (im.complete && im.naturalWidth === 0) bad.push((im.src||'').slice(-70)) })
  // performance 里的 4xx/5xx 资源
  const fails = (performance.getEntriesByType('resource')||[]).filter(e => e.responseStatus >= 400).map(e => e.name.slice(-70) + ' ' + e.responseStatus)
  return JSON.stringify({ brokenImgs: bad, httpFails: fails })
})()`

async function main() {
  console.log(`== [${TAG}] 奖励屏重拍 + 破图扫描 ==`)
  cli(['open', URL])
  await sleep(4000)
  for (let i = 0; i < 15; i++) { if (ev(`typeof window.__sts === 'function'`) === true) break; await sleep(800) }

  // 快速进入 run（直接 startRun）
  ev(`(() => { const g = window.__sts.getState(); g.startRun('ironclad'); const st = g.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.screen='map'; window.__sts.setState({run:r}); return 'ok' })()`)
  await sleep(2200)
  // 战斗（保持 combat 非空）→ 胜利回奖励屏：直接构造 combat 完结态
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run));
    r.combat = { players: r.players.map((p,i)=>({uid:'p'+i, hp:p.maxHp, maxHp:p.maxHp, block:0, energy:3, statuses:{}, potions:p.potions||[], relics:p.relics||[]})), enemies: [], activeIdx: 0, turn: 1, drawPile: [], hand: [], discardPile: [], exhaustPile: [], spawnedEnemies: [] };
    r.screen = 'reward';
    r.reward = { cards: [{ cardId: 'bash', upgraded: false }, { cardId: 'whirlwind', upgraded: false }, { cardId: 'defend', upgraded: false }], gold: 25, potionId: 'firePotion', relicId: null, taken: { card: false, gold: false, potion: false, relic: false } };
    window.__sts.setState({ run: r }); return 'ok' })()`)
  await sleep(2600)
  const scr = ev(`window.__sts.getState().run?.screen`)
  console.log('screen =', scr)
  const chk = ev(BROKEN_CHK)
  console.log('奖励屏破图检测:', chk)
  cli(['screenshot', `${DIR}/10_reward_${TAG}.png`])
  console.log(`  shot: 10_reward_${TAG}`)

  // 逐屏再走一遍做机械破图检测（标题/选角/地图/战斗/商店/宝箱/休息/事件）
  const scenes: [string, string][] = [
    ['title', `window.__sts.getState().backToTitle ? window.__sts.getState().backToTitle() : 'skip'`],
  ]
  for (const [name, nav] of scenes) { try { ev(nav) } catch {} }
  await sleep(1800)
  console.log('title 破图:', ev(BROKEN_CHK))

  // 重新走全流程扫其余屏
  ev(`location.reload ? 'r' : 'r'`); await sleep(3800)
  for (let i = 0; i < 15; i++) { if (ev(`typeof window.__sts === 'function'`) === true) break; await sleep(800) }
  const click = (re: string) => cli(['eval', `[...document.querySelectorAll('button')].find(b=>/${re}/.test(b.textContent||''))?.click()`])
  await sleep(1500)
  click('开 始'); await sleep(1600)
  console.log('charselect 破图:', ev(BROKEN_CHK))
  click('铁甲战士'); await sleep(800)
  click('出\\s*发')
  for (let i = 0; i < 10; i++) { if (ev(`!!window.__sts.getState().run`) === true) break; await sleep(600) }
  await sleep(1200)
  if (ev(`window.__sts.getState().run?.screen`) === 'neow') ev(`window.__sts.getState().chooseNeow(1)`)
  await sleep(2000)
  console.log('map 破图:', ev(BROKEN_CHK))
  // 战斗
  for (let i = 0; i < 14; i++) {
    const c = ev(`(() => { const el=document.querySelector('.sts-map-node.sts-map-pulse[data-ntype=monster]')||document.querySelector('.sts-map-node.sts-map-pulse'); if(!el) return 'n/a'; el.click(); return 'go' })()`)
    if (c === 'go') break; await sleep(450)
  }
  for (let i = 0; i < 14; i++) { if (ev(`window.__sts.getState().run?.screen`) === 'combat') break; await sleep(450) }
  await sleep(3000)
  console.log('combat 破图:', ev(BROKEN_CHK))
  // 悬停一张卡看放大检视
  ev(`(() => { const c = document.querySelector('[class*=card]'); if (c) { const r = c.getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2}) } return 'no' })()`)
  const mutate = (fn: string) => ev(`(() => { const st = window.__sts.getState(); if (!st.run) return 'no-run'; const r = JSON.parse(JSON.stringify(st.run)); (${fn})(r); window.__sts.setState({ run: r }); return 'ok' })()`)
  mutate(`r => { r.combat = null; r.screen = 'shop'; r.shop = { cards: [{ cardId: 'strike', price: 999, sold: false, upgraded: false }, { cardId: 'bash', price: 45, sold: false, upgraded: false, discount: true }], relics: [{ relicId: 'anchor', price: 160, sold: false }], potions: [{ potionId: 'firePotion', price: 999, sold: false }], removalUsed: false, removalPrice: 75 }; r.players[0].gold = 200 }`)
  await sleep(2800)
  console.log('shop 破图:', ev(BROKEN_CHK))
  mutate(`r => { r.screen = 'rest'; r.mpRest = null }`)
  await sleep(2000)
  console.log('rest 破图:', ev(BROKEN_CHK))
  mutate(`r => { r.screen = 'event'; r.currentEvent = 'cleric'; r.players[0].gold = 100 }`)
  await sleep(2000)
  console.log('event 破图:', ev(BROKEN_CHK))
  // 检视屏（右键卡）— pile view 大图
  mutate(`r => { r.screen = 'map' }`)
  await sleep(1500)

  // VLM 复核奖励屏
  const zai = await (ZAI as any).create()
  const ask = async (img: string, q: string) => {
    const content: any[] = [{ type: 'image_url', image_url: { url: `data:image/png;base64,${readFileSync(img).toString('base64')}` } }]
    content.push({ type: 'text', text: q })
    const r = await zai.chat.completions.createVision({ messages: [{ role: 'user', content }] })
    return (r as any).choices?.[0]?.message?.content ?? JSON.stringify(r).slice(0, 400)
  }
  console.log('\n== VLM 复核奖励屏 ==')
  console.log(await ask(`${DIR}/10_reward_${TAG}.png`, `这是网页复刻《杀戮尖塔1》的战斗奖励屏截图。请检查：1) 是否有三张奖励卡牌可看见卡面插画？2) 是否有金币奖励与药水奖励图标？3) 有无破图/黑屏/错位？4) 卡面插画是否符合一代手绘暗黑风（而非二代2025高饱和3D小人国风）？逐项简短回答。`))
  try { cli(['close']); await sleep(1200); cli(['open', 'about:blank']) } catch {}
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
