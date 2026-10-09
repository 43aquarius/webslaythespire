// 第十二批单文件版验证（与 Next.js 版对应的核心项）
// 用法: npx tsx scripts/test_batch12_standalone.ts
import { execFileSync } from 'child_process'

const URL = 'file:///home/z/my-project/download/slay-the-spire-standalone.html'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function ev(code: string): any {
  try {
    const out = execFileSync('agent-browser', ['eval', code, '--json'], { encoding: 'utf-8', timeout: 60000 })
    const j = JSON.parse(out)
    return j?.data?.result ?? j?.data ?? ''
  } catch (e: any) {
    return 'ERR:' + (e.stdout || e.message || '').slice(0, 300)
  }
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
  console.log('== 打开单文件版 ==')
  execFileSync('agent-browser', ['open', URL], { encoding: 'utf-8', timeout: 60000 })
  await sleep(4000)
  for (let i = 0; i < 15; i++) {
    if (ev(`typeof window.__sts === 'function' || !!window.__sts`) === true) break
    await sleep(1000)
  }
  await sleep(1500)

  // 开局进战斗
  ev(`window.__sts.getState().startRun('ironclad')`)
  for (let i = 0; i < 10; i++) {
    const s = ev(`window.__sts.getState().run?.screen`)
    if (s === 'neow') break
    await sleep(700)
  }
  ev(`window.__sts.getState().chooseNeow(1)`)
  for (let i = 0; i < 12; i++) {
    const j = evJson(`(() => { const g = window.__sts.getState(); return JSON.stringify({ screen: g.run?.screen, sel: g.select ? g.select.kind : null, uids: g.select?.cardUids?.slice(0,2) }) })()`)
    if (j.screen === 'map' && !j.sel) break
    if (j.sel && Array.isArray(j.uids) && j.uids.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(j.uids[0])})`)
    await sleep(800)
  }
  ev(`(() => { const st = window.__sts.getState(); if (st.run?.screen === 'map') st.chooseNode(st.run.map.startNodes[0]); return 'ok' })()`)
  for (let i = 0; i < 12; i++) {
    if (ev(`window.__sts.getState().run?.screen`) === 'combat') break
    await sleep(700)
  }
  await sleep(1500)
  check('进入战斗', ev(`window.__sts.getState().run?.screen`) === 'combat')

  // ① 震屏层结构
  const layer = evJson(`(() => {
    const l = document.querySelector('.sts-shake-layer')
    if (!l) return { exists: false }
    const bg = document.getElementById('combat-bg')
    const hero = l.querySelector('.player-zone')
    return { exists: true, hasBg: !!bg, hasHero: !!hero, hasEnemies: !!l.querySelector('#enemies-row'), pe: getComputedStyle(l).pointerEvents }
  })()`)
  check('震屏层存在+背景/角色/敌人', layer.exists === true && layer.hasBg === true && layer.hasHero === true && layer.hasEnemies === true, JSON.stringify(layer))
  check('震屏层穿透', layer.pe === 'none', layer.pe)

  // ② 受伤红晕 + 震动
  ev(`(() => {
    const st = window.__sts.getState()
    const id = 950000 + (window.__tfx = (window.__tfx || 0) + 1)
    st.fxList.push({ kind: 'shake', target: 'player', value: 15, text: undefined, id })
    window.__sts.setState({ fxList: [...st.fxList] })
    return id
  })()`)
  await sleep(200)
  const vign = evJson(`(() => {
    const v = document.querySelector('.sts-hurt-vignette')
    const l = document.querySelector('.sts-shake-layer')
    return { cls: v ? v.className : 'none', opacity: v ? getComputedStyle(v).opacity : '-1', translate: l ? l.style.translate : 'none' }
  })()`)
  check('受伤红晕触发', String(vign.cls).includes('sts-vignette-play'), JSON.stringify(vign))
  check('红晕可见', parseFloat(vign.opacity) > 0.01, 'op=' + vign.opacity)
  check('震屏位移生效', vign.translate !== 'none' && vign.translate !== '', 'tr=' + vign.translate)

  // ③ 费用红 + 能量0红字
  ev(`(() => {
    const st = window.__sts.getState()
    st.run.combat.players[0].energy = 0
    window.__sts.setState({ run: { ...st.run } })
    return 'ok'
  })()`)
  await sleep(700)
  const costInfo = evJson(`(() => {
    const els = Array.from(document.querySelectorAll('#hand-row .card-cost'))
    return els.map(e => ({ cost: e.textContent.trim(), color: getComputedStyle(e).color }))
  })()`)
  check('能量不足费用红字', (costInfo || []).some((c: any) => c.color === 'rgb(255, 85, 85)'), JSON.stringify(costInfo).slice(0, 160))
  const energyInfo = evJson(`(() => {
    const num = document.getElementById('energy-num')
    const img = document.querySelector('#energy-box img')
    return { color: num ? getComputedStyle(num).color : 'none', filter: img ? img.style.filter : 'none' }
  })()`)
  check('能量0数字红', energyInfo.color === 'rgb(255, 85, 85)', JSON.stringify(energyInfo))
  check('能量0宝球暗', String(energyInfo.filter).includes('brightness'), energyInfo.filter)

  // ④ 回能爆发 + 升级绿名 + 数值变色
  const mark0 = ev(`document.getElementById('energy-box')?.dataset.burst || ''`)
  ev(`(() => {
    const st = window.__sts.getState()
    st.run.combat.players[0].energy = 3
    window.__sts.setState({ run: { ...st.run } })
    return 'ok'
  })()`)
  await sleep(400)
  const mark1 = ev(`document.getElementById('energy-box')?.dataset.burst || ''`)
  check('回能爆发触发', !!mark1 && mark1 !== mark0, `m0=${mark0} m1=${mark1}`)

  ev(`(() => {
    const st = window.__sts.getState()
    const p = st.run.combat.players[0]
    const idx = p.hand.findIndex(h => h.id.includes('strike') || h.id.includes('bash'))
    const i = idx >= 0 ? idx : 0
    p.hand[i].upgraded = 1
    p.statuses.strength = 3
    window.__sts.setState({ run: { ...st.run } })
    return 'ok'
  })()`)
  await sleep(800)
  const cardsRaw = evJson(`(() => {
    const els = Array.from(document.querySelectorAll('#hand-row .sts-card'))
    return JSON.stringify(els.map(c => {
      const name = c.querySelector('.card-name')
      const desc = c.querySelector('.card-desc')
      const greens = desc ? Array.from(desc.querySelectorAll('span[style]')).map(s => s.style.color + ':' + s.textContent) : []
      return { nameColor: name ? getComputedStyle(name).color : 'none', greens }
    }))
  })()`)
  const cards = Array.isArray(cardsRaw) ? cardsRaw : (Array.isArray(cardsRaw?.err) ? null : (typeof cardsRaw === 'string' ? (() => { try { return JSON.parse(cardsRaw) } catch { return null } })() : Object.values(cardsRaw || {})))
  check('升级卡名绿#7FFF00', (cards || []).some((c: any) => c && c.nameColor === 'rgb(127, 255, 0)'), JSON.stringify(cards).slice(0, 120))
  check('攻击数值随力量变绿', (cards || []).some((c: any) => c && (c.greens || []).some((g: string) => String(g).includes('127, 255, 0') || String(g).includes('7fff00'))), JSON.stringify(cards).slice(0, 200))

  // ⑤ 回合横幅
  ev(`(() => { const st = window.__sts.getState(); st.run.combat.phase = 'enemy'; window.__sts.setState({ run: { ...st.run } }); return 'ok' })()`)
  await sleep(600)
  const bannerE = evJson(`(() => {
    const b = document.querySelector('#turn-banner-holder .turn-banner')
    if (!b) return { shown: false }
    const label = document.getElementById('tb-label')
    return { shown: true, text: b.textContent, anims: label ? (label.getAnimations ? label.getAnimations().length : -1) : -2 }
  })()`)
  check('敌方回合横幅+动画', bannerE.shown === true && String(bannerE.text || '').includes('敌方回合') && (bannerE.anims || 0) >= 1, JSON.stringify(bannerE))
  ev(`(() => { const st = window.__sts.getState(); st.run.combat.phase = 'player'; st.run.combat.turn = (st.run.combat.turn || 1) + 1; window.__sts.setState({ run: { ...st.run } }); return 'ok' })()`)
  await sleep(600)
  const bannerP = evJson(`(() => {
    const t = document.getElementById('tb-turn')
    if (!t) return { color: 'none', shown: false }
    return { color: getComputedStyle(t).color, shown: true }
  })()`)
  check('玩家回合横幅回合数天蓝', bannerP.shown === true && bannerP.color === 'rgb(135, 206, 235)', JSON.stringify(bannerP))

  // ⑥ 宝球拱弧（defect）
  console.log('== defect 宝球拱弧 ==')
  ev(`window.__sts.getState().startRun('defect')`)
  await sleep(1500)
  for (let i = 0; i < 10; i++) {
    const s = ev(`window.__sts.getState().run?.screen`)
    if (s === 'neow') break
    await sleep(700)
  }
  ev(`window.__sts.getState().chooseNeow(1)`)
  for (let i = 0; i < 12; i++) {
    const j = evJson(`(() => { const g = window.__sts.getState(); return JSON.stringify({ screen: g.run?.screen, sel: g.select ? g.select.kind : null, uids: g.select?.cardUids?.slice(0,2) }) })()`)
    if (j.screen === 'map' && !j.sel) break
    if (j.sel && Array.isArray(j.uids) && j.uids.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(j.uids[0])})`)
    await sleep(800)
  }
  ev(`(() => { const st = window.__sts.getState(); if (st.run?.screen === 'map') st.chooseNode(st.run.map.startNodes[0]); return 'ok' })()`)
  for (let i = 0; i < 12; i++) {
    if (ev(`window.__sts.getState().run?.screen`) === 'combat') break
    await sleep(700)
  }
  await sleep(1200)
  ev(`(() => {
    const st = window.__sts.getState()
    const c = st.run.combat
    c.players[0].orbs = [{ type: 'frost' }, { type: 'frost' }, { type: 'lightning' }]
    c.players[0].orbSlots = 3
    window.__sts.setState({ run: { ...st.run } })
    return 'ok'
  })()`)
  await sleep(700)
  const orbs = evJson(`(() => {
    const row = document.querySelector('.orb-row')
    if (!row) return { found: false }
    const kids = Array.from(row.querySelectorAll(':scope > span'))
    return { found: true, n: kids.length, pos: kids.map(k => ({ l: k.style.left, t: k.style.top })) }
  })()`)
  check('宝球3球拱弧渲染', orbs.found === true && orbs.n === 3, JSON.stringify(orbs).slice(0, 150))
  if (orbs.found && Array.isArray(orbs.pos) && orbs.pos.length === 3) {
    const tops = orbs.pos.map((p: any) => parseFloat(String(p.t)))
    const lefts = orbs.pos.map((p: any) => parseFloat(String(p.l)))
    check('∩形拱弧(中间最高)', tops[1] < tops[0] && tops[1] < tops[2], JSON.stringify(tops))
    check('横向铺开', Math.max(...lefts) - Math.min(...lefts) > 60, JSON.stringify(lefts))
  }

  // ⑦ 奖励发光
  ev(`(() => {
    const st = window.__sts.getState()
    const r = st.run
    r.screen = 'reward'
    r.reward = { gold: 20, cards: ['feed', 'battleTrance', 'strike'], taken: [] }
    window.__sts.setState({ run: { ...r } })
    return 'ok'
  })()`)
  // 等奖励屏DOM真正挂载（房间过渡黑幕1.1s后才切屏）再等光晕1s淡入完成
  for (let i = 0; i < 14; i++) {
    if (Number(ev(`document.querySelectorAll('.sts-reward-glow').length`)) >= 1) break
    await sleep(400)
  }
  await sleep(1200)
  const glow = evJson(`(() => {
    return { rare: document.querySelectorAll('.sts-reward-glow-rare').length, unc: document.querySelectorAll('.sts-reward-glow-uncommon').length, op: (() => { const g = document.querySelector('.sts-reward-glow'); return g ? getComputedStyle(g).opacity : 'none' })() }
  })()`)
  check('稀有金晕+罕见蓝晕', glow.rare === 1 && glow.unc === 1, JSON.stringify(glow))
  check('光晕淡入生效', parseFloat(glow.op) > 0.5, 'op=' + glow.op)

  console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
