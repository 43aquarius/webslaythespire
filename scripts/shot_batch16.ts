// 第十六批截图：商店HUD+价格配色 / 宝箱遗物展示+光晕 / 死亡界面阶段动画 / HUD药水动画
// 用法: npx tsx scripts/shot_batch16.ts [url]
import { execFileSync } from 'child_process'
import { mkdirSync } from 'fs'

const URL = process.argv[2] || 'http://127.0.0.1:3100/'
const OUT = '/home/z/my-project/scripts/study/batch16'
mkdirSync(OUT, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function ev(code: string): any {
  try {
    const out = execFileSync('agent-browser', ['eval', code, '--json'], { encoding: 'utf-8', timeout: 60000 })
    const j = JSON.parse(out)
    return j?.data?.result ?? j?.data ?? ''
  } catch (e: any) {
    return 'ERR:' + (e.stdout || e.message || '').slice(0, 200)
  }
}
function shot(name: string) {
  execFileSync('agent-browser', ['screenshot', `${OUT}/${name}.png`], { encoding: 'utf-8', timeout: 60000 })
  console.log(`✓ ${name}.png`)
}
function mutateRun(patch: string) {
  return ev(`(() => {
    const st = window.__sts.getState()
    if (!st.run) return 'no run'
    const r = JSON.parse(JSON.stringify(st.run))
    ;(${patch})(r)
    window.__sts.setState({ run: r })
    return 'ok'
  })()`)
}

async function main() {
  execFileSync('agent-browser', ['open', URL], { encoding: 'utf-8', timeout: 60000 })
  await sleep(3000)
  for (let i = 0; i < 15; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(1000)
  }
  await sleep(1000)
  ev(`window.__sts.getState().startRun('ironclad')`)
  await sleep(600)
  for (let i = 0; i < 12; i++) {
    const j = ev(`(() => { const g = window.__sts.getState(); return JSON.stringify({ s: g.run?.screen, sel: g.select?.kind, u: g.select?.cardUids?.[0] }) })()`)
    if (JSON.parse(j).s === 'map') break
    const p = JSON.parse(j)
    if (p.s === 'neow') ev(`window.__sts.getState().chooseNeow(1)`)
    if (p.sel && p.u) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(p.u)})`)
    await sleep(700)
  }
  await sleep(2600)

  // ① 商店（HUD 常驻 + 价格配色 + 满药水带）
  mutateRun(`r => {
    r.potions = ['firePotion', 'blockPotion', 'strengthPotion']; r.players[0].potions = r.potions
    r.players[0].gold = 60
    r.screen = 'shop'
    r.shop = { cards: [{ cardId: 'bludgeon', price: 140, sold: false, upgraded: false }, { cardId: 'whirlwind', price: 42, sold: false, upgraded: false, discount: true }, { cardId: 'inflame', price: 55, sold: false, upgraded: false }], relics: [{ relicId: 'anchor', price: 160, sold: false }, { relicId: 'bagOfPreparation', price: 95, sold: false }], potions: [{ potionId: 'firePotion', price: 52, sold: false }, { potionId: 'blockPotion', price: 40, sold: false }], removalUsed: false, removalPrice: 75 }
  }`)
  await sleep(2400)
  shot('shop_hud_prices')

  // ② 宝箱两步：开箱后的遗物展示 + 稀有度光晕
  mutateRun(`r => { r.shop = null; r.screen = 'treasure'; r.pendingTreasureRelic = undefined }`)
  await sleep(1800)
  shot('treasure_closed')
  ev(`window.__sts.getState().openTreasure()`)
  await sleep(1000)
  shot('treasure_relic_glow')

  // ③ 死亡界面（引言 + 统计 + 徽章阶段动画进行中）
  mutateRun(`r => {
    r.screen = 'gameover'
    r.gameOverInfo = { victory: false, floor: 22, monstersSlain: 31, elitesSlain: 4, goldEarned: 862 }
    r.players[0].deck = Array.from({ length: 9 }, (_, i) => ({ uid: 'd' + i, id: 'strike', upgraded: 0 }))
    r.players[0].gold = 1240
  }`)
  await sleep(2100) // 统计行滑入完成、徽章进行中
  shot('gameover_stages')

  // ④ 地图 HUD（金钱计数后的满药水带 + 遗物行）
  mutateRun(`r => {
    r.screen = 'map'
    r.players[0].gold = 99
    r.players[0].relics = ['anchor', 'bagOfPreparation', 'lantern']
    r.relics = r.players[0].relics
  }`)
  await sleep(2400)
  shot('hud_potions_relics')

  console.log('完成')
}

main().catch(e => { console.error(e); process.exit(1) })
