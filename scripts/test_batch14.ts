// 第十四批验证（sts2-web 研究第四批落地）：
// ①遗物获得闪光三副本(原版参数) ②可选卡牌涟漪描边 ③篝火休息去饱和+烟雾 ④武装升级预览(原卡→箭头→升级卡)
// 用法: npx tsx scripts/test_batch14.ts [url]
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

  // ===== 开一局进战斗 =====
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
  await sleep(1500)
  check('进入战斗', ev(`window.__sts.getState().run?.screen`) === 'combat')

  // ===== ① 遗物获得闪光（注入新遗物 → 三副本爆发） =====
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.players[0].relics.push('anchor'); window.__sts.setState({ run: r }); return 'ok' })()`)
  await sleep(600)
  const relicBurst = evJson(`(() => {
    const els = [...document.querySelectorAll('.sts-relic-burst')]
    let playing = 0
    els.forEach(e => { if (getComputedStyle(e).animationName === 'sts-relic-burst') playing++ })
    const delays = els.map(e => e.style.animationDelay)
    return { n: els.length, playing, delays: delays.join(',') }
  })()`)
  check('①遗物闪光三副本', relicBurst.n === 3, `n=${relicBurst.n}`)
  check('①闪光动画播放', relicBurst.playing === 3, `playing=${relicBurst.playing}`)
  check('①副本0.2s间隔', /0s,0.2s,0.4s/.test(relicBurst.delays || ''), `delays=${relicBurst.delays}`)
  await sleep(2500) // 等闪光结束

  // ===== ④ 武装升级预览 =====
  // 注入武装到手牌并打出
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.combat.players[0].hand.push({ uid: 'test_arm_1', id: 'armaments', upgraded: 0 }); window.__sts.setState({ run: r }); return 'ok' })()`)
  await sleep(500)
  ev(`window.__sts.getState().playCard('test_arm_1', null)`)
  await sleep(900)
  const selKind = ev(`window.__sts.getState().select?.kind`)
  check('④武装选牌打开', selKind === 'armaments', `kind=${selKind}`)

  // 选牌网格：涟漪描边
  const shimmer = evJson(`(() => {
    const els = [...document.querySelectorAll('.sts-card-selectable')]
    if (!els.length) return { n: 0 }
    const cs = getComputedStyle(els[0], '::after')
    return { n: els.length, name: cs.animationName, content: cs.content }
  })()`)
  check('②④可选卡涟漪类存在', shimmer.n >= 1, `n=${shimmer.n}`)
  check('②涟漪描边动画sts-shimmer-sweep', shimmer.name === 'sts-shimmer-sweep', `name=${shimmer.name} content=${shimmer.content}`)

  // 点击一张卡 → 升级预览
  const armUid = ev(`window.__sts.getState().select?.cardUids?.[0]`)
  ev(`(() => { const el = document.querySelector('.sts-card-selectable'); if (el) el.click(); return 'ok' })()`)
  await sleep(600)
  const pv = evJson(`(() => {
    const cards = document.querySelectorAll('.sts-up-preview-card')
    const arrows = [...document.querySelectorAll('[style*="sts-arrow-nudge"]')]
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('确认升级'))
    const titles = [...document.querySelectorAll('.sts-up-preview-card .card-name')].map(e => e.textContent.trim())
    const descs = [...document.querySelectorAll('.sts-up-preview-card .card-desc')].map(e => e.textContent.trim().slice(0, 30))
    return JSON.stringify({ cards: cards.length, arrows: arrows.length, btn: !!btn, titles: titles.join('|'), descs: descs.join('|') })
  })()`)
  check('④预览双卡布局', pv.cards === 2, JSON.stringify(pv).slice(0, 150))
  check('④三箭头', pv.arrows === 3, `arrows=${pv.arrows}`)
  check('④确认升级按钮', pv.btn === true)
  check('④升级后卡名相同', pv.titles.split('|')[0] === pv.titles.split('|')[1] && pv.titles.split('|')[0]?.length > 0, `titles=${pv.titles}`)
  check('④升级后描述变化(+)', (pv.descs.split('|')[1] || '').includes('+') || pv.descs.split('|')[0] !== pv.descs.split('|')[1], `descs=${pv.descs}`)

  // 确认升级 → 卡牌在手牌中变为已升级
  ev(`(() => { const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('确认升级')); if (btn) btn.click(); return 'ok' })()`)
  await sleep(800)
  const upRes = evJson(`(() => { const st = window.__sts.getState(); const c = st.run.combat.players[0].hand.find(x => x.uid === ${JSON.stringify(armUid)}); return JSON.stringify({ sel: st.select ? st.select.kind : null, up: c ? c.upgraded : -1 }) })()`)
  check('④确认后卡牌升级', upRes.sel === null && upRes.up >= 1, `sel=${upRes.sel} up=${upRes.up}`)

  // ===== ③ 篝火休息去饱和+烟雾 =====
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.screen = 'rest'; if (r.combat) r.combat = null; window.__sts.setState({ run: r }); return 'ok' })()`)
  // 等篝火屏DOM真正挂载（第十五批房间过渡黑幕1.1s后才切屏）
  for (let i = 0; i < 14; i++) {
    if (ev(`[...document.querySelectorAll('button')].some(b => b.textContent.includes('休息'))`) === true) break
    await sleep(400)
  }
  // 点击休息按钮
  ev(`(() => { const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('休息')); if (btn) btn.click(); return 'ok' })()`)
  await sleep(700)
  const rest = evJson(`(() => {
    const scr = document.querySelector('.sts-rest-desat')
    const puffs = document.querySelectorAll('.sts-smoke-puff').length
    const cs = scr ? getComputedStyle(scr) : null
    return JSON.stringify({ desat: !!scr, puffs, anim: cs ? cs.animationName : '', filter: cs ? cs.filter : '' })
  })()`)
  check('③休息去饱和动画类', rest.desat === true, JSON.stringify(rest).slice(0, 150))
  check('③去饱和动画播放中', rest.anim === 'sts-rest-desat', `anim=${rest.anim}`)
  check('③篝火烟雾升起', rest.puffs >= 3, `puffs=${rest.puffs}`)
  check('③滤镜生效(饱和度下降)', /saturate\((0\.[0-9]+|1)\)/.test(rest.filter || '') && !/saturate\(1\)/.test(rest.filter || ''), `filter=${rest.filter}`)
  // 等 2.2s 动画结束 → 自动回地图
  await sleep(2200)
  check('③休息后回到地图', ev(`window.__sts.getState().run?.screen`) === 'map', `screen=${ev('window.__sts.getState().run?.screen')}`)

  console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
  if (fail > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
