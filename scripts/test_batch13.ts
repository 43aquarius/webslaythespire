// 第十三批验证（sts2-web 研究第三批落地）：
// ①意图图标浮动 ②浮动伤害数字物理(红→奶油/21关键帧/2000ms) ③状态图标获得闪光
// ④敌人执行时意图四重爆发(引擎+DOM) ⑤有格挡时血条变蓝 ⑥格挡破碎两半飞散 ⑦战斗开始状态栏滑入
// ⑧锻造升级卡牌特效(放大入场+星光+飞向牌组)
// 用法: npx tsx scripts/test_batch13.ts [url]
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
    if (ev(`window.__sts.getState().run?.screen`) === 'neow') break
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
    const r = st.run
    if (!r || r.screen !== 'map') return 'notmap'
    st.chooseNode(r.map.startNodes[0])
    return 'ok'
  })()`)
  for (let i = 0; i < 12; i++) {
    if (ev(`window.__sts.getState().run?.screen`) === 'combat') break
    await sleep(700)
  }
  // 等战斗DOM真正挂载（第十五批房间过渡黑幕1.1s后才切屏），手牌出现为准
  for (let i = 0; i < 14; i++) {
    if (Number(ev(`document.querySelectorAll('.sts-hand-card').length`)) >= 5) break
    await sleep(400)
  }
  await sleep(400)
  check('进入战斗', ev(`window.__sts.getState().run?.screen`) === 'combat')

  // ===== ⑦ 战斗开始状态栏滑入（原版 NCreatureStateDisplay：上方20px + 随机延迟1.3-1.7s） =====
  const stateIn = evJson(`(() => {
    const els = [...document.querySelectorAll('div')].filter(e => (e.style.animation || '').includes('sts-state-in'))
    if (!els.length) return { found: 0 }
    const s = els[0].style.animation
    const times = s.match(/[\\d.]+s/g) || []
    return { found: els.length, anim: s, delay: times.length >= 2 ? parseFloat(times[1]) : -1 }
  })()`)
  check('⑦状态栏滑入动画存在', stateIn.found >= 1, JSON.stringify(stateIn).slice(0, 200))
  check('⑦滑入延迟1.3-1.7s(战斗开始错峰)', stateIn.delay >= 1.25 && stateIn.delay <= 1.75, `delay=${stateIn.delay} anim=${(stateIn.anim || '').slice(0, 80)}`)

  // ===== ① 意图图标浮动（原版 NIntent：sin·10+8px 错峰浮动） =====
  const bob = evJson(`(() => {
    const el = document.querySelector('.sts-intent-bob')
    if (!el) return { found: false }
    const cs = getComputedStyle(el)
    return { found: true, name: cs.animationName, dur: cs.animationDuration }
  })()`)
  check('①意图浮动类存在', bob.found === true)
  check('①意图浮动动画sts-intent-bob', bob.name === 'sts-intent-bob', `name=${bob.name}`)

  // ===== ⑤ 有格挡时血条变蓝（注入 block=9 → 填充蓝+浅蓝外框+深蓝描边数字） =====
  const firstEnemyUid = ev(`window.__sts.getState().run?.combat?.enemies.find(e => !e.dying && e.hp > 0)?.uid`)
  ev(`(() => {
    const st = window.__sts.getState()
    const r = JSON.parse(JSON.stringify(st.run))
    const e = r.combat.enemies.find(x => !x.dying && x.hp > 0)
    e.block = 9
    window.__sts.setState({ run: r })
    return 'ok'
  })()`)
  await sleep(700)
  const blueBar = evJson(`(() => {
    const el = document.querySelector('.sts-hpbar-fill')
    const outer = document.querySelector('.sts-hpbar-outer')
    if (!el) return { found: false }
    const cs = getComputedStyle(el)
    return { found: true, bg: (cs.backgroundImage || '') + (cs.backgroundColor || ''), shadow: getComputedStyle(outer).boxShadow }
  })()`)
  check('⑤有格挡血条填充变蓝', blueBar.found && /3b6fa3|59, ?111, ?163/i.test(blueBar.bg + ''), JSON.stringify(blueBar).slice(0, 150))
  check('⑤血条浅蓝外框', blueBar.found && /178, ?224, ?255|b2e0ff/i.test(blueBar.shadow + ''), `shadow=${(blueBar.shadow || '').slice(0, 60)}`)

  // ===== ⑥ 格挡破碎（block 9→0 → 盾牌两半飞散） =====
  ev(`(() => {
    const st = window.__sts.getState()
    const r = JSON.parse(JSON.stringify(st.run))
    const e = r.combat.enemies.find(x => !x.dying && x.hp > 0)
    e.block = 0
    window.__sts.setState({ run: r })
    return 'ok'
  })()`)
  await sleep(400)
  const bb = evJson(`(() => {
    const l = document.querySelectorAll('.sts-bb-left').length
    const r = document.querySelectorAll('.sts-bb-right').length
    const el = document.querySelector('.sts-bb-left')
    let name = ''
    if (el) name = getComputedStyle(el).animationName
    return { l, r, name }
  })()`)
  check('⑥格挡破碎两半出现', bb.l >= 1 && bb.r >= 1, JSON.stringify(bb))
  check('⑥破碎动画sts-bb-left/right', bb.name === 'sts-bb-left', `name=${bb.name}`)

  // ===== ③ 状态图标获得闪光（注入易伤 → 图标闪光） =====
  ev(`(() => {
    const st = window.__sts.getState()
    const r = JSON.parse(JSON.stringify(st.run))
    const e = r.combat.enemies.find(x => !x.dying && x.hp > 0)
    e.statuses.vulnerable = 2
    window.__sts.setState({ run: r })
    return 'ok'
  })()`)
  await sleep(600)
  const flash = evJson(`(() => {
    const el = document.querySelector('.sts-power-flash')
    if (!el) return { found: false }
    const cs = getComputedStyle(el)
    return { found: true, name: cs.animationName, dur: cs.animationDuration }
  })()`)
  check('③状态获得闪光元素', flash.found === true)
  check('③闪光动画sts-power-flash≈0.95s', flash.name === 'sts-power-flash' && Math.abs(parseFloat(flash.dur) - 0.95) < 0.05, `name=${flash.name} dur=${flash.dur}`)

  // ===== ② 浮动伤害数字物理（注入 dmg fx → WAAPI 21关键帧/2000ms/红→奶油） =====
  ev(`(() => {
    const st = window.__sts.getState()
    const uid = ${JSON.stringify(firstEnemyUid)}
    window.__sts.setState({ fxList: [...st.fxList, { kind: 'dmg', target: uid, value: 7, id: 990001, ts: Date.now() }] })
    return 'ok'
  })()`)
  await sleep(500)
  const floatNum = evJson(`(() => {
    const el = [...document.querySelectorAll('.sts-float')].find(e => e.textContent.trim() === '7')
    if (!el) return { found: false }
    const anims = el.getAnimations()
    const a = anims.find(x => x.effect.getTiming().duration === 2000) || anims[0]
    let kf = []
    try { kf = a.effect.getKeyframes() } catch (e) {}
    const inner = el.firstElementChild
    let innerColor = false
    try { innerColor = (inner.getAnimations()[0]?.effect.getKeyframes() || []).some(f => String(f.color).includes('247, 43, 20') || String(f.color).includes('247,43,20')) } catch (e) {}
    return { found: true, n: anims.length, dur: a ? a.effect.getTiming().duration : -1, frames: kf.length, kf2: kf[2] ? (kf[2].transform || '') : '', innerColor }
  })()`)
  check('②伤害数字出现', floatNum.found === true, JSON.stringify(floatNum).slice(0, 150))
  check('②伤害数字WAAPI动画时长2000ms', floatNum.dur === 2000, `dur=${floatNum.dur}`)
  check('②伤害数字21关键帧(重力弧线采样)', floatNum.frames === 21, `frames=${floatNum.frames}`)
  check('②关键帧含scale与位移', /scale/.test(floatNum.kf2 || ''), `kf2=${(floatNum.kf2 || '').slice(0, 60)}`)
  check('②伤害数字红→奶油内层变色', floatNum.innerColor === true)

  // ===== ④ 意图四重爆发（注入 intentBurst fx → DOM 四副本；随后真实验证引擎在敌人回合推送） =====
  ev(`(() => {
    const st = window.__sts.getState()
    const uid = ${JSON.stringify(firstEnemyUid)}
    window.__sts.setState({ fxList: [...st.fxList, { kind: 'intentBurst', target: uid, value: 0, text: 'attack', id: 990002, ts: Date.now() }] })
    return 'ok'
  })()`)
  await sleep(400)
  const burst = evJson(`(() => {
    const els = [...document.querySelectorAll('.sts-intent-burst')]
    let playing = 0
    els.forEach(e => { if (getComputedStyle(e).animationName === 'sts-intent-burst') playing++ })
    return { n: els.length, playing }
  })()`)
  check('④意图爆发四副本渲染', burst.n === 4, `n=${burst.n}`)
  check('④爆发动画播放中', burst.playing >= 1, `playing=${burst.playing}`)
  // 等注入的 fx 被移除（1.9s），再结束回合验证引擎真实推送
  await sleep(2200)
  ev(`window.__sts.getState().endTurn()`)
  let engineBurst = false
  for (let i = 0; i < 50; i++) {
    const n = ev(`window.__sts.getState().fxList.filter(f => f.kind === 'intentBurst' && f.id !== 990002).length`)
    if (Number(n) > 0) { engineBurst = true; break }
    await sleep(150)
  }
  check('④引擎敌人行动推送intentBurst', engineBurst === true)
  for (let i = 0; i < 30; i++) {
    if (ev(`window.__sts.getState().run?.combat?.phase`) === 'player') break
    await sleep(400)
  }
  await sleep(600)

  // ===== ⑧ 锻造升级卡牌特效 =====
  ev(`(() => {
    const st = window.__sts.getState()
    const r = JSON.parse(JSON.stringify(st.run))
    r.screen = 'rest'
    if (r.combat) r.combat = null
    window.__sts.setState({ run: r })
    return 'ok'
  })()`)
  await sleep(700)
  ev(`window.__sts.getState().restAction('smith')`)
  await sleep(700)
  const selKind = ev(`window.__sts.getState().select?.kind`)
  check('⑧锻造选牌打开', selKind === 'restSmith', `kind=${selKind}`)
  const pickUid = ev(`window.__sts.getState().select?.cardUids?.[0]`)
  ev(`window.__sts.getState().resolveSelect(${JSON.stringify(pickUid)})`)
  await sleep(800)
  const up1 = evJson(`(() => {
    const ov = document.querySelector('.upgrade-vfx-overlay')
    const card = document.querySelector('.upgrade-vfx-overlay .up-card')
    const star = document.querySelector('.upgrade-vfx-overlay .sts-upgrade-star')
    const st = window.__sts.getState()
    return JSON.stringify({ ov: !!ov, card: !!card, star: !!star, anim: card ? card.style.animation : '', fx: !!st.upgradeFx })
  })()`)
  check('⑧升级特效覆盖层出现', up1.ov === true, JSON.stringify(up1).slice(0, 150))
  check('⑧升级卡+星光渲染', up1.card === true && up1.star === true)
  check('⑧入场动画sts-upgrade-in', /sts-upgrade-in/.test(up1.anim || ''), `anim=${up1.anim}`)
  await sleep(1600)
  const up2 = evJson(`(() => {
    const card = document.querySelector('.upgrade-vfx-overlay .up-card')
    if (!card) return { gone: true }
    return { gone: false, anim: card.style.animation }
  })()`)
  check('⑧1.75s后飞向牌组动画', up2.gone === true || /sts-upgrade-fly/.test(up2.anim || ''), JSON.stringify(up2).slice(0, 120))

  console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
  if (fail > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
