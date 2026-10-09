// 第二十批测试：原版素材替换后渲染 + 地图boss专属图标（预决定/图标/名称/进战斗一致性/幕推进/旧档兼容）
// 用法: npx tsx scripts/test_batch20.ts [next|standalone]
import { execFileSync } from 'child_process'

const MODE = (process.argv[2] === 'standalone') ? 'standalone' : 'next'
const URL = MODE === 'next' ? 'http://localhost:3000/' : 'file:///home/z/my-project/download/slay-the-spire-standalone.html'
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
let pass = 0, fail = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${detail}`) }
}

async function main() {
  console.log(`== 第二十批测试 [${MODE}] ==`)
  cli(['open', URL])
  await sleep(3500)
  for (let i = 0; i < 12; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(800)
  }
  check('store就绪', ev(`typeof window.__sts === 'function'`) === true)

  // ===== A. 原版素材就位（Next=HTTP资源 / standalone=ASSETS内联） =====
  console.log('-- A. 原版素材 --')
  if (MODE === 'next') {
    const res = evJson(`(async () => {
      const urls = ['/assets/cardart/bash.webp', '/assets/frames/frameAttackCommon.png', '/assets/status/metallicize.png', '/assets/relics/burningBlood.png', '/assets/intent/attack3.png', '/assets/mapicons/guardian.png', '/assets/frames/redEnergy.png']
      const out = {}
      for (const u of urls) { const r = await fetch(u); out[u.split('/').pop()] = r.status }
      return out
    })()`)
    check('A1 七类关键素材HTTP 200', Object.values(res).every((s: any) => s === 200), JSON.stringify(res))
  } else {
    const assets = evJson(`(() => { const A = window.ASSETS || {}; return { card: !!A['cardart/bash.webp'], frame: !!A['frames/frameAttackCommon.png'], status: !!A['status/metallicize.png'], relic: !!A['relics/burningBlood.png'], intent: !!A['intent/attack3.png'], bossIcon: !!A['mapicons/guardian.png'], energy: !!A['frames/redEnergy.png'] } })()`)
    check('A1 七类关键素材内联', Object.values(assets).every(v => v === true), JSON.stringify(assets))
  }

  // ===== B. boss预决定（开新局即有actBoss） =====
  console.log('-- B. boss预决定 --')
  const runInfo = evJson(`(() => { const st = window.__sts.getState(); st.startRun('ironclad'); const s2 = window.__sts.getState(); const r = s2.run; return { act: r.act, boss: r.actBoss ? { name: r.actBoss.name, enemies: r.actBoss.enemies } : null } })()`)
  check('B1 新局即预决定actBoss', runInfo.boss !== null && !!runInfo.boss.name, JSON.stringify(runInfo))
  const ACT1_BOSSES = ['史莱姆老大', '守卫者', '六角幽灵']
  check('B2 属于一幕boss池', ACT1_BOSSES.includes(runInfo.boss?.name || ''), `name=${runInfo.boss?.name}`)
  check('B3 boss敌人非空', Array.isArray(runInfo.boss?.enemies) && runInfo.boss.enemies.length >= 1, JSON.stringify(runInfo.boss?.enemies))

  // ===== C. 地图boss专属图标与名称 =====
  console.log('-- C. 地图boss图标 --')
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.screen = 'map'; window.__sts.setState({ run: r }); return 'ok' })()`)
  await sleep(2400) // 过渡1.1s+挂载
  const bossIcon = evJson(`(() => {
    const st = window.__sts.getState()
    const r = st.run
    const A = window.ASSETS || {}
    const map = { slimeBoss: 'slime', theGuardian: 'guardian', hexaghost: 'hexaghost' }
    const wantKey = 'mapicons/' + (map[r.actBoss.enemies[0]] || 'boss') + '.png'
    const sel = ${MODE === 'next' ? `document.querySelector('.sts-map-node[data-ntype=boss]')` : `document.querySelector('#map-nodes .node.boss')`}
    if (!sel) return { err: 'nobossnode' }
    const img = sel.querySelector('img')
    const src = img ? img.src : ''
    const nextOk = src.includes('/' + (map[r.actBoss.enemies[0]] || 'boss') + '.png')
    const saOk = src === (A[wantKey] || '')
    const tip = ${MODE === 'next' ? `(document.querySelector('.sts-map-node[data-ntype=boss] [class*=tip]')||{}).textContent || sel.getAttribute('data-tip') || sel.innerHTML.slice(0,120)` : `sel.dataset.tip || ''`}
    return { iconOk: ${MODE === 'next' ? 'nextOk' : 'saOk'}, src: src.slice(0, ${MODE === 'next' ? '60' : '28'}), tip: String(tip).slice(0, 40), bossName: r.actBoss.name }
  })()`)
  check('C1 boss节点专属图标', bossIcon.iconOk === true, JSON.stringify(bossIcon).slice(0, 160))
  check('C2 boss节点名称提示', (bossIcon.tip || '').includes(bossIcon.bossName || '∅'), JSON.stringify(bossIcon).slice(0, 160))

  // ===== D. 进boss战斗一致性（预决定=实际遭遇） =====
  console.log('-- D. boss战斗一致性 --')
  const fight = evJson(`(() => { const st = window.__sts.getState(); const r0 = st.run; const bossNode = Object.values(r0.map.nodes).find(n => n.type === 'boss'); const parent = Object.values(r0.map.nodes).find(n => n.edges.includes(bossNode.id)); const r = JSON.parse(JSON.stringify(r0)); r.currentNodeId = parent ? parent.id : null; r.visitedNodes = parent ? [parent.id] : []; window.__sts.setState({ run: r }); const s1 = window.__sts.getState(); s1.chooseNode(bossNode.id); const s2 = window.__sts.getState(); const c = s2.run.combat; return { screen: s2.run.screen, isBoss: c ? c.isBoss : null, enemies: c ? c.enemies.map(e => e.id) : null, actBossEnemies: s2.run.actBoss.enemies } })()`)
  check('D1 进入boss战斗', fight.screen === 'combat' && fight.isBoss === true, JSON.stringify(fight).slice(0, 140))
  check('D2 遭遇=预决定boss', JSON.stringify(fight.enemies) === JSON.stringify(fight.actBossEnemies), JSON.stringify(fight).slice(0, 140))

  // ===== E. 幕推进重掷（chooseBossRelic→advanceAct） =====
  console.log('-- E. 幕推进 --')
  const act2 = evJson(`(() => { const st = window.__sts.getState(); st.chooseBossRelic(null); const s2 = window.__sts.getState(); return { act: s2.run.act, boss: s2.run.actBoss?.name || null, seen: s2.run.bossesSeen } })()`)
  check('E1 二幕重掷actBoss', act2.act === 2 && !!act2.boss, JSON.stringify(act2))
  const ACT2_BOSSES = ['青铜自动机', '收藏家', '勇士']
  check('E2 属于二幕boss池', ACT2_BOSSES.includes(act2.boss), `name=${act2.boss}`)

  // ===== F. 旧档兼容（无actBoss时进boss节点回退现掷） =====
  console.log('-- F. 旧档兼容 --')
  const compat = evJson(`(() => { const st = window.__sts.getState(); const r0 = st.run; const bossNode = Object.values(r0.map.nodes).find(n => n.type === 'boss'); const parent = Object.values(r0.map.nodes).find(n => n.edges.includes(bossNode.id)); const r = JSON.parse(JSON.stringify(r0)); delete r.actBoss; r.currentNodeId = parent ? parent.id : null; r.visitedNodes = parent ? [parent.id] : []; window.__sts.setState({ run: r }); const s1 = window.__sts.getState(); s1.chooseNode(bossNode.id); const s2 = window.__sts.getState(); const c = s2.run.combat; return { screen: s2.run.screen, isBoss: c ? c.isBoss : null, enemies: c ? c.enemies.map(e => e.id) : null } })()`)
  check('F1 无actBoss回退现掷仍可战', compat.screen === 'combat' && compat.isBoss === true && (compat.enemies || []).length >= 1, JSON.stringify(compat).slice(0, 140))

  console.log(`\n== 结果: ${pass} 通过, ${fail} 失败 ==`)
  if (fail > 0) process.exit(1)
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
