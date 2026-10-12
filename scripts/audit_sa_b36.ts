// 第三十六批：standalone 版全屏审计 + Next 奖励屏正确态复拍
import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import ZAI from 'z-ai-web-dev-sdk'

const MODE = process.argv[2] === 'reward-next' ? 'reward-next' : 'standalone'
const URL = MODE === 'standalone' ? 'file:///home/z/my-project/download/slay-the-spire-standalone.html' : 'http://localhost:3000/'
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
const BROKEN_CHK = `(() => {
  const bad = []
  document.querySelectorAll('img').forEach(im => { if (im.complete && im.naturalWidth === 0) bad.push((im.src||'').slice(-70)) })
  const fails = (performance.getEntriesByType('resource')||[]).filter(e => e.responseStatus >= 400).map(e => e.name.slice(-70) + ' ' + e.responseStatus)
  return JSON.stringify({ brokenImgs: bad, httpFails: fails })
})()`
const mutate = (fn: string) => ev(`(() => { const st = window.__sts.getState(); if (!st.run) return 'no-run'; const r = JSON.parse(JSON.stringify(st.run)); (${fn})(r); window.__sts.setState({ run: r }); return 'ok' })()`)
const state = () => ev(`window.__sts ? (window.__sts.getState().run ? window.__sts.getState().run.screen : 'title') : 'no-sts'`)

async function main() {
  cli(['open', URL])
  await sleep(4500)
  for (let i = 0; i < 15; i++) { if (ev(`typeof window.__sts === 'function'`) === true) break; await sleep(800) }
  await sleep(2500)

  if (MODE === 'reward-next') {
    // ===== Next 奖励屏正确态（taken: []）=====
    ev(`(() => { const g = window.__sts.getState(); g.startRun('ironclad'); const st = g.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.screen='map'; window.__sts.setState({run:r}); return 'ok' })()`)
    await sleep(2000)
    ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run));
      r.combat = { players: r.players.map((p,i)=>({uid:'p'+i, hp:p.maxHp, maxHp:p.maxHp, block:0, energy:3, statuses:{}, potions:p.potions||[], relics:p.relics||[]})), enemies: [], activeIdx: 0, turn: 1, drawPile: [], hand: [], discardPile: [], exhaustPile: [], spawnedEnemies: [] };
      r.screen = 'reward';
      r.reward = { cards: [{ cardId: 'bash', upgraded: false }, { cardId: 'whirlwind', upgraded: false }, { cardId: 'defend', upgraded: false }], gold: 25, potionId: 'firePotion', relicId: null, taken: [] };
      window.__sts.setState({ run: r }); return 'ok' })()`)
    await sleep(2600)
    console.log('screen =', state())
    console.log('破图检测:', ev(BROKEN_CHK))
    cli(['screenshot', `${DIR}/10_reward_fixed.png`])
    const zai = await (ZAI as any).create()
    const ask = async (img: string, q: string) => {
      const content: any[] = [{ type: 'image_url', image_url: { url: `data:image/png;base64,${readFileSync(img).toString('base64')}` } }]
      content.push({ type: 'text', text: q })
      const r = await zai.chat.completions.createVision({ messages: [{ role: 'user', content }] })
      return (r as any).choices?.[0]?.message?.content ?? JSON.stringify(r).slice(0, 400)
    }
    console.log(await ask(`${DIR}/10_reward_fixed.png`, `这是网页复刻《杀戮尖塔1》的战斗奖励屏截图。请检查：1) 是否有三张奖励卡牌且卡面插画清晰？2) 是否有金币奖励与药水奖励？3) 有无破图/黑屏/错位/报错文字？4) 卡面插画是否符合一代手绘暗黑风（而非二代2025高饱和3D小人国风）？逐项简短回答。`))
  } else {
    // ===== standalone 全屏审计（__sts 直驱）=====
    console.log('== [standalone] 破图扫描 ==')
    console.log('title 破图:', ev(BROKEN_CHK))
    cli(['screenshot', `${DIR}/sa_01_title.png`])
    ev(`(() => { const g = window.__sts.getState(); g.startRun('ironclad'); const st = g.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.screen='map'; window.__sts.setState({run:r}); return 'ok' })()`)
    await sleep(2400)
    // 首个怪节点进战斗
    ev(`(() => { const g = window.__sts.getState(); const r = g.run; const reach = r.currentNodeId ? r.map.nodes[r.currentNodeId].edges : r.map.startNodes; const n = reach.map(id => r.map.nodes[id]).find(n => n.type === 'monster') || reach.map(id => r.map.nodes[id]).find(n => n.type !== 'boss'); if (n) g.chooseNode(n.id); return 'ok' })()`)
    for (let i = 0; i < 14; i++) { if (state() === 'combat') break; await sleep(450) }
    await sleep(3200)
    console.log('combat 破图:', ev(BROKEN_CHK))
    cli(['screenshot', `${DIR}/sa_02_combat.png`])
    // 战斗屏如果没进（neow 卡住）就直接构造
    if (state() !== 'combat') console.log('!! combat 未进入, screen=', state())
    // 商店
    mutate(`r => { r.combat = null; r.screen = 'shop'; r.shop = { cards: [{ cardId: 'strike', price: 999, sold: false, upgraded: false }, { cardId: 'bash', price: 45, sold: false, upgraded: false, discount: true }], relics: [{ relicId: 'anchor', price: 160, sold: false }], potions: [{ potionId: 'firePotion', price: 999, sold: false }], removalUsed: false, removalPrice: 75 }; r.players[0].gold = 200 }`)
    await sleep(2800)
    console.log('shop 破图:', ev(BROKEN_CHK))
    cli(['screenshot', `${DIR}/sa_03_shop.png`])
    // 休息 / 事件
    mutate(`r => { r.screen = 'rest'; r.mpRest = null }`)
    await sleep(2000)
    console.log('rest 破图:', ev(BROKEN_CHK))
    cli(['screenshot', `${DIR}/sa_04_rest.png`])
    mutate(`r => { r.screen = 'event'; r.currentEvent = 'cleric'; r.players[0].gold = 100 }`)
    await sleep(2000)
    console.log('event 破图:', ev(BROKEN_CHK))
    cli(['screenshot', `${DIR}/sa_05_event.png`])
    // VLM 抽查三屏（标题/战斗/商店）
    const zai = await (ZAI as any).create()
    const ask = async (img: string, q: string) => {
      const content: any[] = [{ type: 'image_url', image_url: { url: `data:image/png;base64,${readFileSync(img).toString('base64')}` } }]
      content.push({ type: 'text', text: q })
      const r = await zai.chat.completions.createVision({ messages: [{ role: 'user', content }] })
      return (r as any).choices?.[0]?.message?.content ?? JSON.stringify(r).slice(0, 400)
    }
    const q = `这是单文件版网页复刻《杀戮尖塔1》截图。简短回答：【完整性】有无破图/黑块/错位/报错文字？【一代纯度】有无任何素材是《杀戮尖塔2》(2025,高饱和3D小人国风)的特征？若有请具体指出。`
    for (const s of ['sa_01_title', 'sa_02_combat', 'sa_03_shop', 'sa_04_rest', 'sa_05_event']) {
      console.log(`\n----- ${s} -----`)
      try { console.log(await ask(`${DIR}/${s}.png`, q)) } catch (e: any) { console.log('VLM-ERR', (e?.message || '').slice(0, 150)) }
    }
  }
  try { cli(['close']); await sleep(1200); cli(['open', 'about:blank']) } catch {}
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
