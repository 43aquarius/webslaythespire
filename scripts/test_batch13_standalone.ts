// 第十三批单文件版验证：意图浮动/浮动数字物理/格挡变蓝+破碎/状态闪光/滑入/升级特效/意图爆发
import { execFileSync } from 'child_process'

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
  execFileSync('agent-browser', ['open', 'file:///home/z/my-project/download/slay-the-spire-standalone.html'], { encoding: 'utf-8', timeout: 60000 })
  await sleep(3500)
  for (let i = 0; i < 12; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(800)
  }
  check('store就绪', ev(`typeof window.__sts === 'function'`) === true)

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
  ev(`(() => { const st = window.__sts.getState(); const r = st.run; if (r && r.screen === 'map') { st.chooseNode(r.map.startNodes[0]); return 'ok' } return 'notmap' })()`)
  for (let i = 0; i < 12; i++) {
    if (ev(`window.__sts.getState().run?.screen`) === 'combat') break
    await sleep(700)
  }
  await sleep(1000)
  check('进入战斗', ev(`window.__sts.getState().run?.screen`) === 'combat')

  // ===== ⑦ 状态栏滑入 =====
  const stateIn = evJson(`(() => {
    const els = [...document.querySelectorAll('.enemy-info')].filter(e => (e.style.animation || '').includes('sts-state-in'))
    if (!els.length) return { found: 0 }
    const s = els[0].style.animation
    const times = s.match(/[\\d.]+s/g) || []
    return { found: els.length, anim: s, delay: times.length >= 2 ? parseFloat(times[1]) : -1 }
  })()`)
  check('⑦状态栏滑入动画', stateIn.found >= 1, JSON.stringify(stateIn).slice(0, 150))
  check('⑦滑入延迟1.3-1.7s', stateIn.delay >= 1.25 && stateIn.delay <= 1.75, `delay=${stateIn.delay}`)

  // ===== ① 意图浮动 =====
  const bob = evJson(`(() => {
    const el = document.querySelector('.intent-bob')
    if (!el) return { found: false }
    const cs = getComputedStyle(el)
    return { found: true, name: cs.animationName, dur: cs.animationDuration }
  })()`)
  check('①意图浮动存在', bob.found === true)
  check('①浮动动画名', /intent-bob|sts-intent-bob/.test(bob.name || ''), `name=${bob.name}`)

  // ===== ⑤ 有格挡血条变蓝（注入） =====
  const firstUid = ev(`window.__sts.getState().run?.combat?.enemies.find(e => !e.dying && e.hp > 0)?.uid`)
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); const e = r.combat.enemies.find(x => !x.dying && x.hp > 0); e.block = 9; window.__sts.setState({ run: r }); return 'ok' })()`)
  await sleep(700)
  const blueBar = evJson(`(() => {
    const el = document.querySelector('.enemy .hpbar-fill')
    const outer = document.querySelector('.enemy .hpbar-outer')
    if (!el) return { found: false }
    const cs = getComputedStyle(el)
    return { found: true, bg: (cs.backgroundImage || '') + (cs.backgroundColor || ''), shadow: getComputedStyle(outer).boxShadow }
  })()`)
  check('⑤有格挡血条变蓝', blueBar.found && /3b6fa3|59, ?111, ?163/i.test(blueBar.bg + ''), JSON.stringify(blueBar).slice(0, 150))
  check('⑤血条浅蓝外框', blueBar.found && /178, ?224, ?255|b2e0ff/i.test(blueBar.shadow + ''), `shadow=${(blueBar.shadow || '').slice(0, 60)}`)

  // ===== ⑥ 格挡破碎 =====
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); const e = r.combat.enemies.find(x => !x.dying && x.hp > 0); e.block = 0; window.__sts.setState({ run: r }); return 'ok' })()`)
  await sleep(400)
  const bb = evJson(`(() => {
    const l = document.querySelectorAll('.bb-break .bb-l').length
    const r = document.querySelectorAll('.bb-break .bb-r').length
    const el = document.querySelector('.bb-break .bb-l')
    return { l, r, name: el ? getComputedStyle(el).animationName : '' }
  })()`)
  check('⑥格挡破碎两半出现', bb.l >= 1 && bb.r >= 1, JSON.stringify(bb))
  check('⑥破碎动画名', bb.name === 'sts-bb-left', `name=${bb.name}`)

  // ===== ③ 状态获得闪光（注入易伤） =====
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); const e = r.combat.enemies.find(x => !x.dying && x.hp > 0); e.statuses.vulnerable = 2; window.__sts.setState({ run: r }); return 'ok' })()`)
  await sleep(600)
  const flash = evJson(`(() => {
    const el = document.querySelector('.status-badge.power-flash')
    if (!el) return { found: false }
    const cs = getComputedStyle(el)
    return { found: true, name: cs.animationName, dur: cs.animationDuration }
  })()`)
  check('③状态获得闪光', flash.found === true)
  check('③闪光动画≈0.95s', flash.name === 'sts-power-flash' && Math.abs(parseFloat(flash.dur) - 0.95) < 0.05, `name=${flash.name} dur=${flash.dur}`)

  // ===== ② 浮动伤害数字物理（注入 dmg fx） =====
  ev(`(() => { const st = window.__sts.getState(); window.__sts.setState({ fxList: [...st.fxList, { kind: 'dmg', target: ${JSON.stringify(firstUid)}, value: 7, id: 990011, ts: Date.now() }] }); return 'ok' })()`)
  await sleep(500)
  const floatNum = evJson(`(() => {
    const el = [...document.querySelectorAll('.fx-float')].find(e => e.textContent.trim() === '7')
    if (!el) return { found: false }
    const anims = el.getAnimations()
    const a = anims.find(x => x.effect.getTiming().duration === 2000) || anims[0]
    let kf = []
    try { kf = a.effect.getKeyframes() } catch (e) {}
    const inner = el.firstElementChild
    let innerColor = false
    try { innerColor = (inner.getAnimations()[0]?.effect.getKeyframes() || []).some(f => String(f.color).includes('247')) } catch (e) {}
    return { found: true, dur: a ? a.effect.getTiming().duration : -1, frames: kf.length, innerColor }
  })()`)
  check('②伤害数字出现', floatNum.found === true, JSON.stringify(floatNum).slice(0, 120))
  check('②WAAPI 2000ms', floatNum.dur === 2000, `dur=${floatNum.dur}`)
  check('②21关键帧弧线', floatNum.frames === 21, `frames=${floatNum.frames}`)
  check('②红→奶油内层变色', floatNum.innerColor === true)

  // ===== ④ 意图爆发（注入 intentBurst fx） =====
  ev(`(() => { const st = window.__sts.getState(); window.__sts.setState({ fxList: [...st.fxList, { kind: 'intentBurst', target: ${JSON.stringify(firstUid)}, value: 0, text: 'attack', id: 990012, ts: Date.now() }] }); return 'ok' })()`)
  await sleep(400)
  const burst = evJson(`(() => {
    const els = [...document.querySelectorAll('.intent-burst')]
    let playing = 0
    els.forEach(e => { if (getComputedStyle(e).animationName === 'sts-intent-burst') playing++ })
    const sizes = els.map(e => e.offsetWidth)
    return { n: els.length, playing, sizes: sizes.join(',') }
  })()`)
  check('④意图爆发四副本', burst.n === 4, `n=${burst.n}`)
  check('④爆发动画播放', burst.playing >= 1, `playing=${burst.playing}`)
  check('④爆发副本44px', (burst.sizes || '').split(',').every(s => Number(s) === 44), `sizes=${burst.sizes}`)
  // 引擎真实推送：结束回合（单文件版 renderNewFx 即时移除 fx → 改为轮询 DOM 爆发副本）
  await sleep(2000)
  const etRet = ev(`(() => { try { window.__sts.getState().endTurn(); return 'called' } catch(e) { return 'ERR:'+e.message } })()`)
  console.log('  endTurn返回:', etRet)
  let engineBurst = false
  let dbgPhase = ''
  for (let i = 0; i < 50; i++) {
    const j = evJson(`(() => JSON.stringify({ w: document.querySelectorAll('.intent-burst-wrap').length, ph: window.__sts.getState().run?.combat?.phase, busy: window.__sts.getState().busy }) )()`)
    dbgPhase = j.ph || ''
    if (Number(j.w) > 0) { engineBurst = true; break }
    await sleep(150)
  }
  check('④引擎敌人行动推送intentBurst', engineBurst === true, `phase=${dbgPhase}`)
  for (let i = 0; i < 30; i++) {
    if (ev(`window.__sts.getState().run?.combat?.phase`) === 'player') break
    await sleep(400)
  }
  await sleep(600)

  // ===== ⑧ 锻造升级特效 =====
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.screen = 'rest'; if (r.combat) r.combat = null; window.__sts.setState({ run: r }); return 'ok' })()`)
  await sleep(800)
  ev(`window.__sts.getState().restAction('smith')`)
  await sleep(700)
  const selKind = ev(`window.__sts.getState().select?.kind`)
  check('⑧锻造选牌打开', selKind === 'restSmith', `kind=${selKind}`)
  const pickUid = ev(`window.__sts.getState().select?.cardUids?.[0]`)
  ev(`window.__sts.getState().resolveSelect(${JSON.stringify(pickUid)})`)
  await sleep(900)
  const up1 = evJson(`(() => {
    const ov = document.querySelector('.upgrade-vfx')
    const card = document.querySelector('.upgrade-vfx .up-card')
    const star = document.querySelector('.upgrade-vfx .up-star')
    return JSON.stringify({ ov: !!ov, card: !!card, star: !!star, anim: card ? getComputedStyle(card).animationName : '', w: card ? card.offsetWidth : 0 })
  })()`)
  check('⑧升级特效出现', up1.ov === true && up1.card === true, JSON.stringify(up1).slice(0, 150))
  check('⑧星光渲染', up1.star === true)
  check('⑧入场动画sts-upgrade-in', /sts-upgrade-in/.test(up1.anim || ''), `anim=${up1.anim}`)
  await sleep(1600)
  const up2 = evJson(`(() => {
    const el = document.querySelector('.upgrade-vfx')
    if (!el) return { gone: true }
    return { gone: false, flying: el.classList.contains('flying') }
  })()`)
  check('⑧2s后飞向牌组(flying类)', up2.gone === true || up2.flying === true, JSON.stringify(up2).slice(0, 100))

  console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
  if (fail > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
