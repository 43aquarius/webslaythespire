// 第二十四批截图：原版敌人立绘+选角屏（Next|standalone）
import { execFileSync } from 'child_process'
const MODE = (process.argv[2] === 'standalone') ? 'standalone' : 'next'
const URL = MODE === 'next' ? 'http://localhost:3000/' : 'file:///home/z/my-project/download/slay-the-spire-standalone.html'
const OUT = '/home/z/my-project/scripts/spine_test'
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
  console.log(`== 截图 [${MODE}] ==`)
  cli(['open', URL])
  await sleep(3500)
  for (let i = 0; i < 12; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(800)
  }
  // 选角屏
  ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('开 始'))?.click()`)
  for (let i = 0; i < 10; i++) {
    if (ev(`[...document.querySelectorAll('button')].some(b=>/铁甲战士/.test(b.textContent))`) === true) break
    await sleep(400)
  }
  await sleep(900)
  cli(['screenshot', `${OUT}/shot_${MODE}_charselect.png`])
  console.log('✓ 选角屏')
  // 选铁甲→出发
  ev(`[...document.querySelectorAll('button')].find(b=>/铁甲战士/.test(b.textContent))?.click()`)
  for (let i = 0; i < 10; i++) {
    if (ev(`[...document.querySelectorAll('button')].some(b=>/出\\s*发/.test(b.textContent))`) === true) break
    await sleep(400)
  }
  const dep = MODE === 'next'
    ? `[...document.querySelectorAll('button')].find(b=>/出\\s*发/.test(b.textContent))?.click()`
    : `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('出 发'))?.click()`
  ev(dep)
  await sleep(2500)
  // 涅奥
  for (let i = 0; i < 14 && ev(`window.__sts.getState().run?.screen`) !== 'map'; i++) {
    const j = ev(`(() => { const g = window.__sts.getState(); return JSON.stringify({ s: g.run?.screen, sel: g.select ? g.select.kind : null, uids: g.select?.cardUids?.slice(0,2) }) })()`)
    const jj = JSON.parse(j || '{}')
    if (jj.s === 'map' && !jj.sel) break
    if (jj.s === 'neow') ev(`window.__sts.getState().chooseNeow(1)`)
    if (jj.sel && Array.isArray(jj.uids) && jj.uids.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(jj.uids[0])})`)
    await sleep(700)
  }
  // 进战斗
  const nodeSel = MODE === 'next' ? ".sts-map-node.sts-map-pulse" : "#map-nodes .node.reach"
  for (let i = 0; i < 14; i++) {
    const clicked = ev(`(() => { const el=document.querySelector('${nodeSel}[data-ntype=monster]')||document.querySelector('${nodeSel}'); if(!el) return 'n/a'; el.click(); return 'go' })()`)
    if (clicked === 'go') break
    await sleep(450)
  }
  await sleep(5000)
  const scr = ev(`window.__sts.getState().run?.screen`)
  console.log(`战斗屏: ${scr}`)
  cli(['screenshot', `${OUT}/shot_${MODE}_combat.png`])
  console.log('✓ 战斗屏')
  // 换敌人再截: 改 combat.enemies[].id (def=ENEMIES[id], sprite 随之变化)
  const enemySets = [
    { ids: ['cultist', 'jawWorm', 'fungiBeast'], label: 'set1' },
    { ids: ['lagavulin'], label: 'set2' },
    { ids: ['gremlinWizard', 'madGremlin', 'fatGremlin', 'shieldGremlin', 'sneakyGremlin'], label: 'set3' },
  ]
  for (const set of enemySets) {
    const ok = ev(`(() => {
      const st = window.__sts.getState()
      if (!st.run || !st.run.combat) return 'no combat'
      const r = JSON.parse(JSON.stringify(st.run))
      const EN = ${JSON.stringify(set.ids)}
      r.combat.enemies = EN.map((id, i) => {
        const base = r.combat.enemies[i % r.combat.enemies.length]
        return { ...base, uid: base.uid + '_s' + i, id, hp: 50, maxHp: 50, block: 0, statuses: {}, intent: null, history: [] }
      })
      r.combat.enemies.forEach(e => { e.hp = 50; e.maxHp = 50 })
      window.__sts.setState({ run: r })
      return 'ok'
    })()`)
    await sleep(1600)
    cli(['screenshot', `${OUT}/shot_${MODE}_${set.label}.png`])
    console.log(`✓ ${set.label}: ${ok}`)
  }
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
