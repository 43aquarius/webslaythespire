// 第十二批验证（sts2-web 研究第二批落地）：
// ①震屏层结构（只震舞台不震HUD） ②受伤红晕 ③punch震动+分档 ④回合横幅原版动画
// ⑤费用付不起红/升级绿名/攻击数值随力量变色 ⑥能量0红字暗球+回能爆发
// ⑦宝球∩形拱弧 ⑧奖励卡发光（稀有金晕/罕见蓝晕）
// 用法: npx tsx scripts/test_batch12.ts [url]
import { execFileSync } from 'child_process'

const URL = process.argv[2] || 'http://localhost:3000/'
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
  console.log('== 打开页面 ==')
  execFileSync('agent-browser', ['open', URL], { encoding: 'utf-8', timeout: 60000 })
  await sleep(3000)
  for (let i = 0; i < 15; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(1000)
  }
  check('store就绪', ev(`typeof window.__sts === 'function'`) === true)
  await sleep(1200)

  // ===== 开一局铁甲，直进第一场战斗 =====
  ev(`window.__sts.getState().startRun('ironclad')`)
  for (let i = 0; i < 10; i++) {
    const s = ev(`window.__sts.getState().run?.screen`)
    if (s === 'neow') break
    await sleep(700)
  }
  ev(`window.__sts.getState().chooseNeow(1)`) // 槽2普通：最稳（普通遗物/金币等，无选牌）
  for (let i = 0; i < 12; i++) {
    const j = evJson(`(() => { const g = window.__sts.getState(); return JSON.stringify({ screen: g.run?.screen, sel: g.select ? g.select.kind : null, uids: g.select?.cardUids?.slice(0,2) }) })()`)
    if (j.screen === 'map' && !j.sel) break
    if (j.sel && Array.isArray(j.uids) && j.uids.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(j.uids[0])})`)
    await sleep(800)
  }
  // 进第一节点（战斗）
  ev(`(() => {
    const st = window.__sts.getState()
    const r = st.run
    if (!r || r.screen !== 'map') return 'notmap'
    st.chooseNode(r.map.startNodes[0])
    return 'ok'
  })()`)
  for (let i = 0; i < 12; i++) {
    if (ev(`window.__sts.getState().run?.screen`) === 'combat') break
    await sleep(700)
  }
  await sleep(1500)
  check('进入战斗', ev(`window.__sts.getState().run?.screen`) === 'combat')

  // ===== ① 震屏层结构 =====
  const layer = evJson(`(() => {
    const l = document.querySelector('.sts-shake-layer')
    if (!l) return { exists: false }
    const inLayer = (sel) => !!l.querySelector(sel)
    const hud = document.querySelector('.top-hud')
    let hudOutside = false
    if (hud) { let e = hud.parentElement; hudOutside = true; while (e) { if (e === l) { hudOutside = false; break } e = e.parentElement } }
    return {
      exists: true,
      hasBg: !!l.querySelector('[style*=background-image]'),
      hasHero: inLayer('img[src*=hero]'),
      hasEnemies: !!l.querySelector('img[src*=enemies]'),
      hudOutside: hudOutside,
      peNone: getComputedStyle(l).pointerEvents === 'none',
    }
  })()`)
  check('震屏层存在', layer.exists === true)
  check('背景在震屏层内', layer.hasBg === true, JSON.stringify(layer))
  check('角色在震屏层内', layer.hasHero === true)
  check('敌人在震屏层内', layer.hasEnemies === true)
  check('HUD在震屏层外(不随震动)', layer.hudOutside === true)
  check('震屏层穿透(pe:none)', layer.peNone === true)

  // ===== ②③ 受伤红晕 + punch 分档震动（直接对玩家造成 15 点伤害） =====
  const vign0 = ev(`document.querySelector('.sts-hurt-vignette')?.className || 'none'`)
  ev(`(() => {
    const st = window.__sts.getState()
    const r = st.run
    // 直接调引擎 damagePlayer（hpLoss=15 → 中档 17px 震动）
    // 引擎在 bundle 内，改用 store 手法：设置 run.hp 触发不了 fx，这里直接推一条 shake fx 事件再手测 UI 反应
    window.__stsTestFx = window.__stsTestFx || { id: 0 }
    const id = ++window.__stsTestFx.id
    st.fxList.push({ kind: 'shake', target: 'player', value: 15, text: undefined, id: 900000 + id })
    window.__sts.setState({ fxList: [...st.fxList] })
    return id
  })()`)
  await sleep(180)
  const vign1 = evJson(`(() => {
    const v = document.querySelector('.sts-hurt-vignette')
    const l = document.querySelector('.sts-shake-layer')
    return { cls: v?.className || 'none', opacity: v ? getComputedStyle(v).opacity : '-1', translate: l ? (l.style.translate || getComputedStyle(l).translate) : 'none' }
  })()`)
  check('受伤红晕触发(class)', String(vign1.cls).includes('sts-vignette-play'), JSON.stringify(vign1))
  check('受伤红晕可见(opacity>0)', parseFloat(vign1.opacity) > 0.01, 'opacity=' + vign1.opacity)
  check('震屏层位移生效(translate≠none)', vign1.translate !== 'none' && vign1.translate !== '', 'translate=' + vign1.translate)
  await sleep(1300)
  const vignAfter = ev(`document.querySelector('.sts-hurt-vignette')?.className || 'none'`)
  const translateAfter = ev(`(() => { const l = document.querySelector('.sts-shake-layer'); return l?.style.translate ?? 'unset' })()`)
  check('红晕1s后停止(class移除或opacity=0)', !String(vignAfter).includes('vignette-play') || ev(`getComputedStyle(document.querySelector('.sts-hurt-vignette')).opacity`) === '0', vignAfter)
  check('震动结束后位移复位', translateAfter === '' || translateAfter === 'unset', translateAfter)

  // ===== ⑤ 费用付不起红字（把能量改为0） =====
  ev(`(() => {
    const st = window.__sts.getState()
    const c = st.run.combat
    c.players[0].energy = 0
    window.__sts.setState({ run: { ...st.run } })
    return 'ok'
  })()`)
  await sleep(600)
  const costInfo = evJson(`(() => {
    const cards = Array.from(document.querySelectorAll('.sts-hand-card .sts-card'))
    const out = []
    for (const c of cards) {
      const costEl = c.querySelector('[class*=card-cost]')
      if (!costEl) continue
      out.push({ cost: costEl.textContent.trim(), color: getComputedStyle(costEl).color })
    }
    return { costs: out.slice(0, 5) }
  })()`)
  const hasRedCost = (costInfo.costs || []).some((c: any) => c.color === 'rgb(255, 85, 85)')
  check('能量不足时费用数字变红#FF5555', hasRedCost, JSON.stringify(costInfo.costs))
  const energyRed = evJson(`(() => {
    const st = window.__sts.getState()
    return { energy: st.run.combat.players[0].energy }
  })()`)
  // ===== ⑥ 能量0红字 + 回能爆发 =====
  const energyNumStyle = evJson(`(() => {
    const el = document.querySelector('[class*=energy] span, [class*=energy] div, .sts-energy div')
    const box = document.querySelector('.sts-energy, [class*=energy]')
    const img = box ? box.querySelector('img') : null
    return { color: el ? getComputedStyle(el).color : 'none', filter: img ? (img.style.filter || getComputedStyle(img).filter) : 'none' }
  })()`)
  check('能量0数字红#FF5555', energyNumStyle.color === 'rgb(255, 85, 85)', JSON.stringify(energyNumStyle))
  check('能量0宝球变暗', String(energyNumStyle.filter).includes('brightness'), energyNumStyle.filter)
  // 回能 → 爆发（dataset.burst 标记 + 动画二选一验证）
  const burstMark0 = ev(`document.querySelector('.sts-energy')?.dataset.burst || ''`)
  ev(`(() => {
    const st = window.__sts.getState()
    st.run.combat.players[0].energy = 3
    window.__sts.setState({ run: { ...st.run } })
    return 'ok'
  })()`)
  await sleep(350)
  const burstMark1 = ev(`document.querySelector('.sts-energy')?.dataset.burst || ''`)
  check('回能爆发闪光触发', !!burstMark1 && burstMark1 !== burstMark0, `mark0=${burstMark0} mark1=${burstMark1}`)

  // ===== ⑤b 升级绿名 + 攻击数值随力量变色 =====
  ev(`(() => {
    const st = window.__sts.getState()
    const c = st.run.combat
    const p = c.players[0]
    const idx = p.hand.findIndex(h => h.id.includes('strike') || h.id.includes('bash') || h.id === 'anger')
    const i = idx >= 0 ? idx : 0
    p.hand[i].upgraded = 1
    p.statuses.strength = 3
    window.__sts.setState({ run: { ...st.run } })
    return JSON.stringify({ upg: p.hand[i].id })
  })()`)
  await sleep(700)
  const cardColors = evJson(`(() => {
    const cards = Array.from(document.querySelectorAll('.sts-hand-card .sts-card'))
    const out = []
    for (const c of cards) {
      const name = c.querySelector('[class*=card-name]')
      const desc = c.querySelector('[class*=card-desc]')
      const greens = desc ? Array.from(desc.querySelectorAll('span[style]')).map(s => s.style.color + ':' + s.textContent) : []
      out.push({ name: name ? name.textContent.trim().slice(0, 10) : '', nameColor: name ? getComputedStyle(name).color : '', greens })
    }
    return out
  })()`)
  const upgradedGreen = (cardColors || []).some((c: any) => c.nameColor === 'rgb(127, 255, 0)')
  check('升级卡名变绿#7FFF00', upgradedGreen, JSON.stringify((cardColors || []).map((c: any) => c.nameColor)))
  const valueGreen = (cardColors || []).some((c: any) => (c.greens || []).some((g: string) => g.includes('rgb(127, 255, 0)') || g.includes('#7fff00')))
  check('攻击牌伤害数字随力量变绿', valueGreen, JSON.stringify((cardColors || []).slice(0, 3).map((c: any) => c.greens)))

  // ===== ④ 回合横幅（切敌方回合再切回） =====
  ev(`(() => {
    const st = window.__sts.getState()
    st.run.combat.phase = 'enemy'
    window.__sts.setState({ run: { ...st.run } })
    return 'ok'
  })()`)
  await sleep(500)
  const bannerE = evJson(`(() => {
    const b = document.querySelector('.sts-turn-banner-root')
    if (!b) return { shown: false }
    const label = b.querySelector('.tb-label') || b
    const anims = label.getAnimations ? label.getAnimations() : []
    return { shown: true, text: label.textContent, anims: anims.length, kf: anims.map(a => a.effect && a.effect.getKeyframes ? a.effect.getKeyframes().length : 0) }
  })()`)
  check('敌方回合横幅显示', bannerE.shown === true && String(bannerE.text || '').includes('敌方回合'), JSON.stringify(bannerE))
  check('横幅WAAPI动画运行(缩入+金红渐变)', (bannerE.anims || 0) >= 1, JSON.stringify(bannerE))
  ev(`(() => {
    const st = window.__sts.getState()
    st.run.combat.phase = 'player'
    st.run.combat.turn = (st.run.combat.turn || 1) + 1
    window.__sts.setState({ run: { ...st.run } })
    return 'ok'
  })()`)
  await sleep(500)
  const bannerP = evJson(`(() => {
    const b = document.querySelector('.sts-turn-banner-root')
    if (!b) return { shown: false }
    const turn = b.querySelector('.tb-turn')
    return { shown: true, label: b.textContent?.trim(), turnColor: turn ? getComputedStyle(turn).color : 'none' }
  })()`)
  check('玩家回合横幅+回合数', bannerP.shown === true && String(bannerP.label || '').includes('你的回合'), JSON.stringify(bannerP))
  check('回合数天蓝#87CEEB', bannerP.turnColor === 'rgb(135, 206, 235)', String(bannerP.turnColor))

  // ===== ⑦ 宝球拱弧（开一局 defect 验证） =====
  console.log('== 开故障机器人局验证宝球拱弧 ==')
  ev(`window.__sts.getState().startRun('defect')`)
  await sleep(1200)
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
  ev(`(() => {
    const st = window.__sts.getState()
    if (st.run?.screen === 'map') st.chooseNode(st.run.map.startNodes[0])
    return 'ok'
  })()`)
  for (let i = 0; i < 12; i++) {
    if (ev(`window.__sts.getState().run?.screen`) === 'combat') break
    await sleep(700)
  }
  await sleep(1200)
  // 引导 3 个宝球
  ev(`(() => {
    const st = window.__sts.getState()
    const c = st.run.combat
    // 直接构造宝球状态（绕过卡牌）
    c.players[0].orbs = [{ type: 'frost' }, { type: 'frost' }, { type: 'lightning' }]
    c.players[0].orbSlots = 3
    window.__sts.setState({ run: { ...st.run } })
    return 'ok'
  })()`)
  await sleep(600)
  const orbs = evJson(`(() => {
    const row = document.querySelector('.orb-row')
    if (!row) return { found: false, n: 0 }
    const kids = Array.from(row.querySelectorAll(':scope > *'))
    return { found: true, n: kids.length, pos: kids.map(k => ({ l: k.style.left, t: k.style.top })) }
  })()`)
  check('宝球行渲染(3球)', orbs.found === true && orbs.n === 3, JSON.stringify(orbs).slice(0, 150))
  if (orbs.found && Array.isArray(orbs.pos) && orbs.pos.length === 3) {
    const tops = orbs.pos.map((p: any) => parseFloat(String(p.t)))
    const lefts = orbs.pos.map((p: any) => parseFloat(String(p.l)))
    const middleHigher = tops[1] < tops[0] && tops[1] < tops[2]  // 中间球更靠上（∩形）
    const spread = Math.max(...lefts) - Math.min(...lefts) > 60  // 横向铺开
    check('宝球∩形拱弧(中间球最高)', middleHigher, JSON.stringify(tops))
    check('宝球横向弧线铺开', spread, JSON.stringify(lefts))
  }

  // ===== ⑧ 奖励发光（直接构造奖励屏） =====
  ev(`(() => {
    const st = window.__sts.getState()
    const r = st.run
    // 手动构造战斗奖励（feed=稀有 / battleTrance=罕见 / strike=普通）
    r.screen = 'reward'
    r.reward = { gold: 20, cards: ['feed', 'battleTrance', 'strike'], taken: [] }
    window.__sts.setState({ run: { ...r } })
    return 'ok'
  })()`)
  await sleep(1200)
  const glow = evJson(`(() => {
    const rare = document.querySelectorAll('.sts-reward-glow-rare')
    const unc = document.querySelectorAll('.sts-reward-glow-uncommon')
    const any = document.querySelector('.sts-reward-glow')
    const op = any ? getComputedStyle(any).opacity : 'none'
    return { rare: rare.length, unc: unc.length, opacity: op }
  })()`)
  const rareOk = glow.rare === 1
  const uncOk = glow.unc === 1
  check('稀有卡金晕(1张)', rareOk, JSON.stringify(glow))
  check('罕见卡蓝晕(1张)', uncOk, JSON.stringify(glow))
  check('光晕淡入至高透明度', parseFloat(glow.opacity) > 0.5, 'opacity=' + glow.opacity)

  console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
