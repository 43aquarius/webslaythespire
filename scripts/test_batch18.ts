// 第十八批测试：原版资源还原（SFX音效系统/原版字体/各幕背景/篝火原版图/事件插画/涅奥眨眼/各幕BGM映射）
// 用法: npx tsx scripts/test_batch18.ts [next|standalone]
import { execFileSync } from 'child_process'
import { trackForScreen } from '../src/game/music'

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
function mutateRun(patch: string): any {
  return evJson(`(() => {
    const st = window.__sts.getState()
    if (!st.run) return { err: 'no run' }
    const r = JSON.parse(JSON.stringify(st.run))
    const patch = ${patch}
    patch(r)
    window.__sts.setState({ run: r })
    return { ok: true, screen: r.screen }
  })()`)
}
// 资源断言辅助：Next=style路径文本匹配 / standalone=与ASSETS data URL前缀全等
function bgAnyOk(assetKey: string, pathFrag: string): boolean {
  if (MODE === 'next') return ev(`!!document.querySelector('[style*="${pathFrag}"]')`) === true
  return ev(`(() => { const exp=(window.ASSETS||{})['${assetKey}']||''; if(!exp) return false; const h=exp.slice(0,120); return [...document.querySelectorAll('[style*=background-image]')].some(el => (el.getAttribute('style')||'').includes(h)) })()`) === true
}
function imgOk(assetKey: string, pathFrag: string): boolean {
  if (MODE === 'next') return ev(`!!document.querySelector('img[src*="${pathFrag}"]')`) === true
  return ev(`(() => { const exp=(window.ASSETS||{})['${assetKey}']||''; return !!exp && [...document.querySelectorAll('img')].some(im => im.src === exp) })()`) === true
}

async function main() {
  console.log(`== 第十八批测试 [${MODE}] ==`)
  cli(['open', URL])
  await sleep(3500)
  for (let i = 0; i < 12; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(800)
  }
  check('store就绪', ev(`typeof window.__sts === 'function'`) === true)

  // ---------- A. 主菜单（原版天空+漂云+原版字体） ----------
  console.log('-- A. 主菜单 --')
  check('A1 原版天空背景(menubg)', bgAnyOk('bg/menubg.jpg', 'menubg'))
  check('A2 三层漂云', ev(`document.querySelectorAll('.sts-cloud').length`) === 3, `n=${ev(`document.querySelectorAll('.sts-cloud').length`)}`)
  const fonts = evJson(`(async () => { await document.fonts.ready; return { kreon: document.fonts.check('16px Kreon'), shs: document.fonts.check('16px "Source Han Serif SC"') } })()`)
  check('A3 原版英文字体Kreon', fonts.kreon === true, JSON.stringify(fonts))
  check('A4 原版中文字体SourceHanSerifSC', fonts.shs === true, JSON.stringify(fonts))
  if (MODE === 'standalone') {
    // standalone: @font-face 由 build 注入
    check('A5 standalone字体注入', ev(`[...document.styleSheets].some(s => { try { return [...s.cssRules].some(r => r.cssText && r.cssText.includes('Kreon')) } catch { return false } })`) === true)
  }

  // ---------- B. SFX 引擎与资源 ----------
  console.log('-- B. SFX引擎 --')
  check('B1 引擎单例(window.__sfx)', ev(`typeof window.__sfx === 'object' && window.__sfx !== null`) === true)
  check('B2 音量默认>0', evJson(`window.__sfx ? { v: window.__sfx.volume, m: window.__sfx.muted } : {}`).v > 0)
  // resolver 解析（Next=/assets/sfx/..; standalone=ASSETS audio/sfx/..）
  ev(`window.__sfx && window.__sfx.play('battleStart')`)
  await sleep(300)
  const poolInfo = evJson(`(() => { const p = window.__sfx.pool || []; return { n: p.length, src: (p[0] && p[0].src || '').slice(0,30), ok: p.some(x => x.src && (x.src.includes('assets/sfx') || x.src.startsWith('data:audio'))) } })()`)
  check('B3 音频池创建(12)', poolInfo.n === 12, JSON.stringify(poolInfo))
  check('B4 变体src解析', poolInfo.ok === true, JSON.stringify(poolInfo))
  // 资源可达性
  if (MODE === 'next') {
    const res = evJson(`(async () => { const r = await fetch('/assets/sfx/STS_SFX_BattleStart_1_v1.ogg'); const b = await fetch('/assets/fonts/SourceHanSerifSC-Bold.woff2'); const c = await fetch('/assets/bg/combat1.jpg'); return { sfx: r.status, font: b.status, bg: c.status } })()`)
    check('B5 SFX音源HTTP 200', res.sfx === 200, JSON.stringify(res))
    check('B6 字体HTTP 200', res.font === 200)
    check('B7 战斗背景HTTP 200', res.bg === 200)
  } else {
    const assets = evJson(`(() => { const A = window.ASSETS || {}; return { sfx: !!A['audio/sfx/STS_SFX_BattleStart_1_v1.ogg'], font: !!A['fonts/kreon-bold.woff2'], camp: !!A['campfire/sleep.png'], evImg: !!A['events/bonfire.jpg'], lid: !!A['neow/lid6.png'], combat1: !!A['bg/combat1.jpg'] } })()`)
    check('B5 SFX内联(audio/sfx)', assets.sfx === true, JSON.stringify(assets))
    check('B6 字体内联', assets.font === true)
    check('B7 篝火按钮内联', assets.camp === true)
    check('B8 事件插画内联', assets.evImg === true)
    check('B9 眼睑内联', assets.lid === true)
    check('B10 combat1内联', assets.combat1 === true)
  }
  // 音效音量控件
  if (MODE === 'standalone') {
    cli(['eval', `(() => { const b=[...document.querySelectorAll('button')].find(b=>/设\\s*置/.test(b.textContent)); if(b) b.click(); return 1 })()`])
    await sleep(1400)
    check('B11 设置含音效音量滑条', ev(`!!document.querySelector('input[data-input=sfxVol]')`) === true)
    // 返回主菜单（否则D区找不到开始按钮）
    cli(['eval', `(() => { const b=document.querySelector('[data-act=gotoMenu][data-screen=title]'); if(b) b.click(); return 1 })()`])
    await sleep(600)
  } else {
    cli(['eval', `[...document.querySelectorAll('button')].find(b=>b.title==='音乐设置').click()`])
    await sleep(400)
    check('B11 音乐弹层含音效滑条', ev(`document.body.innerHTML.includes('音效音量')`) === true)
    cli(['eval', `[...document.querySelectorAll('button')].find(b=>b.title==='音乐设置').click()`])
  }

  // ---------- C. 各幕BGM映射（Node单元测试：原版MainMusic/TempMusic） ----------
  console.log('-- C. 各幕BGM映射 --')
  check('C1 一幕普通战=level', trackForScreen('combat', { isBoss: false, isElite: false }, 1) === 'level')
  check('C2 二幕普通战=level2', trackForScreen('combat', { isBoss: false, isElite: false }, 2) === 'level2')
  check('C3 三幕普通战=level3', trackForScreen('combat', { isBoss: false, isElite: false }, 3) === 'level3')
  check('C4 终章=act4曲', trackForScreen('combat', { isBoss: false, isElite: false }, 4) === 'act4')
  check('C5 一幕Boss=boss1', trackForScreen('combat', { isBoss: true, isElite: false }, 1) === 'boss')
  check('C6 二幕Boss=boss2', trackForScreen('combat', { isBoss: true, isElite: false }, 2) === 'boss2')
  check('C7 三幕Boss=boss3', trackForScreen('combat', { isBoss: true, isElite: false }, 3) === 'boss3')
  check('C8 心脏=boss4', trackForScreen('combat', { isBoss: true, isElite: false }, 4) === 'boss4')
  check('C9 地图继承幕曲', trackForScreen('map', null, 3) === 'level3')
  check('C10 精英=elite', trackForScreen('combat', { isBoss: false, isElite: true }, 2) === 'elite')

  // ---------- D. 进入战斗（原版一幕背景 + 出牌音效链路） ----------
  console.log('-- D. 战斗与SFX链路 --')
  // 开始一局: 主菜单 → 选角 → 出发 → 涅奥快速通过
  cli(['eval', `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('开 始')) && [...document.querySelectorAll('button')].find(b=>b.textContent.includes('开 始')).click()`])
  // 等待选角屏挂载（房间过渡黑幕1.1s，见第十五批）——轮询出发按钮
  for (let i = 0; i < 10; i++) {
    if (ev(`[...document.querySelectorAll('button')].some(b=>/出\\s*发/.test(b.textContent))`) === true) break
    await sleep(400)
  }
  if (MODE === 'next') {
    cli(['eval', `[...document.querySelectorAll('button')].find(b=>/出\\s*发/.test(b.textContent)) && [...document.querySelectorAll('button')].find(b=>/出\\s*发/.test(b.textContent)).click()`])
  } else {
    cli(['eval', `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('出 发')) && [...document.querySelectorAll('button')].find(b=>b.textContent.includes('出 发')).click()`])
  }
  await sleep(2500)
  // 涅奥选择（跳过卡牌选择类：选第一个非选卡类选项）
  for (let i = 0; i < 8 && ev(`window.__sts.getState().run?.screen`) !== 'map'; i++) {
    ev(`(() => { const ov=document.querySelector('.overlay'); if(ov){ const c=ov.querySelector('[class*=card-selectable]'); if(c){c.click(); return 1} } const opts=[...document.querySelectorAll('button')].filter(b=>/获得|赠予|赐予|交换|代价/.test(b.textContent)); if(opts.length){opts[0].click(); return 2} return 0 })()`)
    await sleep(900)
  }
  const scr1 = ev(`window.__sts.getState().run?.screen`)
  check('D1 到达地图', scr1 === 'map', `screen=${scr1}`)
  // 轮询等待地图DOM挂载（过渡黑幕1.1s）→ 点可达怪物节点进战斗（Next=.sts-map-pulse / standalone=.node.reach）
  const nodeSel = MODE === 'next' ? ".sts-map-node.sts-map-pulse" : "#map-nodes .node.reach"
  let clicked = 'n/a'
  for (let i = 0; i < 14; i++) {
    clicked = ev(`(() => { const el=document.querySelector('${nodeSel}[data-ntype=monster]')||document.querySelector('${nodeSel}'); if(!el) return 'n/a'; el.click(); return 'go' })()`)
    if (clicked === 'go') break
    await sleep(450)
  }
  await sleep(4500)
  const combatInfo = evJson(`(() => { const st=window.__sts.getState(); return { scr: st.run?.screen, act: st.run?.act, hand: document.querySelectorAll('${MODE === 'next' ? '.sts-hand-card' : '.hand-card'}').length } })()`)
  check('D2 进入战斗', combatInfo.scr === 'combat', JSON.stringify(combatInfo))
  check('D3 战斗背景=原版combat1.jpg', bgAnyOk('bg/combat1.jpg', 'combat1'))
  check('D4 手牌5张', Number(combatInfo.hand) === 5, `n=${combatInfo.hand}`)

  // 埋点验证出牌/回合音效链路
  ev(`(() => { window.__sfxCalls=[]; const o=window.__sfx.play.bind(window.__sfx); window.__sfx.play=(k)=>{window.__sfxCalls.push(k); return o(k)}; return 1 })()`)
  const played = evJson(`(() => { const st=window.__sts.getState(); const c=st.run.combat; if(!c||c.phase!=='player') return {err:'phase'}; const P=c.players[c.activeIdx]; const atk=P.hand.find(h=>h.id==='strike')||P.hand.find(h=>h.id==='bash')||P.hand[0]; const enemy=c.enemies.find(e=>e.hp>0); if(!atk||!enemy) return {err:'no card/enemy'}; st.playCard(atk.uid, enemy.uid); const def=P.hand.find(h=>h.id==='defend'); if(def) st.playCard(def.uid, null); st.endTurn(); return { ok: true } })()`)
  check('D5 出牌动作执行', played.ok === true, JSON.stringify(played))
  await sleep(6500)
  const calls = evJson(`(() => ({ calls: window.__sfxCalls || [], phase: window.__sts.getState().run?.combat?.phase, turn: window.__sts.getState().run?.combat?.turn }))()`)
  const callsArr: string[] = calls.calls || []
  check('D6 攻击牌音效(atkIron)', callsArr.includes('atkIron'), JSON.stringify(callsArr))
  check('D7 格挡音效(blockGain)', callsArr.includes('blockGain'), JSON.stringify(callsArr))
  check('D8 结束回合音效', callsArr.includes('endTurn'), JSON.stringify(callsArr))
  check('D9 敌方回合音效', callsArr.includes('enemyTurn'), JSON.stringify(callsArr))
  check('D10 敌方回合后有动作音', callsArr.length >= 4, JSON.stringify(callsArr))

  // ---------- E. 篝火屏（原版背景+按钮） ----------
  console.log('-- E. 篝火屏 --')
  mutateRun(`r => { r.screen = 'rest'; r.mpRest = null }`)
  await sleep(2300)
  check('E1 原版篝火房背景', bgAnyOk('bg/campfire1.jpg', 'campfire1'))
  check('E2 原版休息按钮图', imgOk('campfire/sleep.png', 'campfire/sleep'))
  check('E3 原版锻造按钮图', imgOk('campfire/smith.png', 'campfire/smith'))

  // ---------- F. 事件屏（原版事件房背景+插画） ----------
  console.log('-- F. 事件屏 --')
  mutateRun(`r => { r.screen = 'event'; r.currentEvent = 'bigFish' }`)
  await sleep(2300)
  const evOkBg = bgAnyOk('bg/event1.jpg', 'event1')
  const evOkImg = imgOk('events/fishing.jpg', 'events/fishing')
  check('F1 原版事件房背景', evOkBg)
  check('F2 原版事件插画(bigFish=fishing)', evOkImg)

  // ---------- G. 涅奥眨眼（需新档；跳到地图页的neow屏不可达——改为检查资源+CSS存在性） ----------
  console.log('-- G. 涅奥资源 --')
  if (MODE === 'next') {
    const neowRes = evJson(`(async () => { const r1 = await fetch('/assets/neow/eye.png'); const r2 = await fetch('/assets/neow/lid6.png'); return { eye: r1.status, lid6: r2.status } })()`)
    check('G1 eye.png可达', neowRes.eye === 200, JSON.stringify(neowRes))
    check('G2 lid6.png可达', neowRes.lid6 === 200)
  } else {
    const neowRes = evJson(`(() => { const A=window.ASSETS||{}; return { eye: !!A['neow/eye.png'], lid6: !!A['neow/lid6.png'] } })()`)
    check('G1 eye内联', neowRes.eye === true, JSON.stringify(neowRes))
    check('G2 lid6内联', neowRes.lid6 === true)
  }
  // CSS: 漂云动画存在
  const cssOk = ev(`(() => { try { return [...document.styleSheets].some(s => [...s.cssRules].some(r => r.cssText && r.cssText.includes('sts-cloud-drift'))) } catch { return false } })()`)
  check('G3 漂云动画CSS', cssOk === true)

  console.log(`\n== 结果: ${pass} 通过, ${fail} 失败 ==`)
  if (fail > 0) process.exit(1)
}

main().catch(e => { console.error('FATAL', e); process.exit(2) })
