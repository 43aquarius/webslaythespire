// 第三十六批：预览全面视觉审计（:3000 全屏幕截图 + VLM 完整性/一代纯度双查）
// 用法: npx tsx scripts/audit_visual_b36.ts [next|standalone]
import { execFileSync } from 'child_process'
import { readFileSync, mkdirSync } from 'fs'
import ZAI from 'z-ai-web-dev-sdk'

const MODE = (process.argv[2] === 'standalone') ? 'standalone' : 'next'
const URL = MODE === 'next' ? 'http://localhost:3000/' : 'file:///home/z/my-project/download/slay-the-spire-standalone.html'
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
const shot = (name: string) => { cli(['screenshot', `${DIR}/${name}.png`]); console.log(`  shot: ${name}`) }
const state = () => ev(`window.__sts ? (window.__sts.getState().run ? window.__sts.getState().run.screen : 'title') : 'no-sts'`)

async function main() {
  mkdirSync(DIR, { recursive: true })
  console.log(`== [${MODE}] 全屏幕截图采集 ==`)
  cli(['open', URL])
  await sleep(4000)
  for (let i = 0; i < 15; i++) { if (ev(`typeof window.__sts === 'function'`) === true) break; await sleep(800) }
  await sleep(2500)
  shot('01_title')

  // ---- 开始游戏 → 角色选择 ----
  for (let i = 0; i < 10; i++) { if (ev(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('开 始'))`) === true) break; await sleep(400) }
  cli(['eval', `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('开 始'))?.click()`])
  await sleep(2200)
  shot('02_charselect')

  // ---- 选铁甲 → 出发 ----
  cli(['eval', `[...document.querySelectorAll('button')].find(b=>/铁甲战士/.test(b.textContent))?.click()`])
  await sleep(900)
  for (let i = 0; i < 10; i++) { if (ev(`[...document.querySelectorAll('button')].some(b=>/出\\s*发/.test(b.textContent))`) === true) break; await sleep(400) }
  for (let attempt = 0; attempt < 3; attempt++) {
    cli(['eval', `[...document.querySelectorAll('button')].find(b=>/出\\s*发/.test(b.textContent))?.click()`])
    for (let i = 0; i < 6; i++) { if (ev(`!!window.__sts.getState().run`) === true) break; await sleep(500) }
    if (ev(`!!window.__sts.getState().run`) === true) break
    await sleep(800)
  }
  await sleep(1600)
  if (state() === 'neow') shot('03_neow')
  // neow → map
  for (let i = 0; i < 14 && state() !== 'map'; i++) {
    if (state() === 'neow') ev(`window.__sts.getState().chooseNeow(1)`)
    await sleep(700)
  }
  await sleep(2000)
  shot('04_map')

  // ---- 战斗（怪节点）----
  for (let i = 0; i < 14; i++) {
    const c = ev(`(() => { const el=document.querySelector('.sts-map-node.sts-map-pulse[data-ntype=monster]')||document.querySelector('.sts-map-node.sts-map-pulse'); if(!el) return 'n/a'; el.click(); return 'go' })()`)
    if (c === 'go') break
    await sleep(450)
  }
  for (let i = 0; i < 14; i++) { if (state() === 'combat') break; await sleep(450) }
  await sleep(3200) // 手牌入场
  shot('05_combat')

  const mutate = (fn: string) => ev(`(() => { const st = window.__sts.getState(); if (!st.run) return 'no-run'; const r = JSON.parse(JSON.stringify(st.run)); (${fn})(r); window.__sts.setState({ run: r }); return 'ok' })()`)

  // ---- 商店 ----
  mutate(`r => {
    r.combat = null; r.screen = 'shop'
    r.shop = { cards: [{ cardId: 'strike', price: 999, sold: false, upgraded: false }, { cardId: 'bash', price: 45, sold: false, upgraded: false, discount: true }, { cardId: 'defend', price: 50, sold: false, upgraded: false }, { cardId: 'whirlwind', price: 120, sold: false, upgraded: false }], relics: [{ relicId: 'anchor', price: 160, sold: false }, { relicId: 'lantern', price: 90, sold: false }], potions: [{ potionId: 'firePotion', price: 999, sold: false }, { potionId: 'essenceOfSteel', price: 60, sold: false }], removalUsed: false, removalPrice: 75 }
    r.players[0].gold = 200
  }`)
  await sleep(3000) // rug 滑入 + 欢迎气泡
  shot('06_shop')

  // ---- 宝箱 ----
  mutate(`r => { Object.assign(r, { combat: null, screen: 'treasure', currentNodeId: null, visitedNodes: [], chestSize: 'large', pendingTreasureRelic: undefined, chestGold: null, act: 1 }); r.map = JSON.parse(JSON.stringify(r.map)); r.map.startNodes = ['n1']; r.map.nodes.n1 = { id: 'n1', x: 0, y: 0, type: 'treasure', edges: [] } }`)
  ev(`window.__sts.getState().chooseNode('n1')`)
  await sleep(2200)
  shot('07_treasure')

  // ---- 休息 ----
  mutate(`r => { r.combat = null; r.screen = 'rest'; r.mpRest = null }`)
  await sleep(2200)
  shot('08_rest')

  // ---- 事件 ----
  mutate(`r => { r.combat = null; r.screen = 'event'; r.currentEvent = 'cleric'; r.players[0].gold = 100 }`)
  await sleep(2200)
  shot('09_event')

  // ---- 奖励屏（战斗胜利后常态）----
  mutate(`r => { r.screen = 'reward'; r.reward = { cards: [{ cardId: 'bash', upgraded: false }, { cardId: 'whirlwind', upgraded: false }, { cardId: 'defend', upgraded: false }], gold: 25, potionId: 'firePotion', relicId: null, taken: { card: false, gold: false, potion: false, relic: false } } }`)
  await sleep(2200)
  shot('10_reward')

  console.log('\n== VLM 审计（完整性 + 一代(STS1)纯度）==')
  const zai = await (ZAI as any).create()
  const ask = async (img: string, q: string) => {
    const content: any[] = [{ type: 'image_url', image_url: { url: `data:image/png;base64,${readFileSync(`${DIR}/${img}.png`).toString('base64')}` } }]
    content.push({ type: 'text', text: q })
    const r = await zai.chat.completions.createVision({ messages: [{ role: 'user', content }] })
    return (r as any).choices?.[0]?.message?.content ?? JSON.stringify(r).slice(0, 400)
  }
  const base = `这是网页复刻《杀戮尖塔1》(Slay the Spire, 2019) 的截图。请分两部分简短回答：
【完整性】有无破图(裂图图标/alt文字)、素材缺失(黑块/空白)、错位拉伸、UI重叠遮挡？逐项列出或答"无"。
【一代纯度】图中有没有任何素材呈现《杀戮尖塔2》(Slay the Spire 2, 2025, 美术为现代高饱和小人国3D渲染风格、UI更精致现代)的特征？特别注意：背景/立绘/卡面插画/UI贴图的画风。若全部符合一代手绘暗黑地牢风，答"纯一代"；若有可疑素材，具体指出位置与理由。`
  const screens: [string, string][] = [
    ['01_title', '主菜单（标题屏）：天空+尖塔中景+红光+云+Logo'],
    ['02_charselect', '角色选择屏：四个角色立绘与各自背景'],
    ['03_neow', '涅奥祝福屏：鲸鱼与文字'],
    ['04_map', '地图屏：节点图标与背景'],
    ['05_combat', '战斗屏：敌人立绘/卡牌/背景/顶栏'],
    ['06_shop', '商店屏：地毯/商人手/卡牌/遗物/药水'],
    ['07_treasure', '宝箱屏：宝箱与遗物'],
    ['08_rest', '休息屏：篝火背景与按钮'],
    ['09_event', '事件屏：事件插画与选项'],
    ['10_reward', '奖励屏：卡牌/金币/药水'],
  ]
  for (const [img, desc] of screens) {
    console.log(`\n----- ${img}: ${desc} -----`)
    try { console.log(await ask(img, base)) } catch (e: any) { console.log('VLM-ERR', (e?.message || '').slice(0, 200)) }
  }
  try { cli(['close']); await sleep(1200); cli(['open', 'about:blank']) } catch {}
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
