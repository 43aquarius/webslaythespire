// 第十批单文件版验证：卡面艺术图同盒对齐 + Boss可点击 + HUD穿透
import { execFileSync } from 'child_process'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
function ev(code: string): any {
  try {
    const out = execFileSync('agent-browser', ['eval', code, '--json'], { encoding: 'utf-8', timeout: 60000 })
    const j = JSON.parse(out)
    return j?.data?.result ?? j?.data
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

  // 开局 → 涅奥槽4 → 直达Boss
  ev(`window.__sts.getState().startRun('ironclad')`)
  for (let i = 0; i < 10; i++) {
    if (ev(`window.__sts.getState().run?.screen`) === 'neow') break
    await sleep(700)
  }
  ev(`window.__sts.getState().chooseNeow(3)`)
  for (let i = 0; i < 12; i++) {
    const scr = evJson(`(() => { const g = window.__sts.getState(); return JSON.stringify({ s: g.run?.screen, sel: g.select ? g.select.kind : null }) })()`)
    if (scr.s === 'map' && !scr.sel) break
    if (scr.sel) {
      const uids = evJson(`window.__sts.getState().select?.cardUids?.slice(0,3)`)
      if (Array.isArray(uids) && uids.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(uids[0])})`)
    }
    await sleep(800)
  }
  const bossId = ev(`window.__sts.getState().run?.map?.bossNodeId`)
  console.log('boss节点:', bossId)
  // 注入：boss节点加入起始可达列表
  ev(`(() => { const st = window.__sts.getState(); st.run.map.startNodes.push(${JSON.stringify(bossId)}); window.__sts.setState({ run: { ...st.run } }); return 'ok' })()`)
  let started = false
  for (let i = 0; i < 10 && !started; i++) {
    await sleep(600)
    ev(`window.__sts.getState().chooseNode(${JSON.stringify(bossId)})`)
    await sleep(1200)
    started = ev(`!!window.__sts.getState().run?.combat`) === true
  }
  await sleep(1500)
  const st1 = evJson(`(() => { const g = window.__sts.getState(); const r = g.run; if (!r || !r.combat) return JSON.stringify({ err: 'no combat' }); return JSON.stringify({ screen: r.screen, enemies: r.combat.enemies.map(e => ({ id: e.id, hp: e.hp, uid: e.uid })), hand: r.combat.players[0].hand.map(c => ({ uid: c.uid, id: c.id })) }) })()`)
  console.log('战斗:', JSON.stringify(st1).slice(0, 200))
  check('Boss战斗已开始', Array.isArray(st1.enemies) && st1.enemies[0]?.hp >= 140, JSON.stringify(st1).slice(0, 120))
  await sleep(1200)

  // ===== 卡面对齐: .cbox 内 clayer 同矩形 =====
  const align = evJson(`(() => {
    const box = document.querySelector('.sts-card .cbox')
    if (!box) return { err: 'no cbox' }
    const layers = [...box.querySelectorAll(':scope > img.clayer')]
    const rect = el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(v => Math.round(v * 100) / 100) }
    // 单文件版素材是 data URL：唯一 webp MIME 的是艺术图；边框是第3个clayer(bg,art,frame,banner,orb)
    const art = layers.find(i => (i.src || '').startsWith('data:image/webp'))
    const frame = layers[2]
    if (!art || !frame) return { err: 'layer missing', n: layers.length, srcs: layers.map(i => (i.src || '').slice(0, 20)) }
    const ra = rect(art), rf = rect(frame)
    return { n: layers.length, isWebp: (art.src || '').startsWith('data:image/webp'), same: ra.every((v, i) => Math.abs(v - rf[i]) < 0.01), ra, rf, natural: art.naturalWidth + 'x' + art.naturalHeight, loaded: art.complete && art.naturalWidth > 0 }
  })()`)
  console.log('对齐:', JSON.stringify(align).slice(0, 350))
  check('艺术图为clayer同盒层(WebP)', align.isWebp === true, JSON.stringify(align).slice(0, 120))
  check('艺术图已加载(512画布)', align.loaded === true && align.natural === '512x512', String(align.natural))
  check('艺术图与边框矩形完全相同', align.same === true, `art(${align.ra}) frame(${align.rf})`)

  // ===== Boss点击 =====
  const strike = st1.hand?.find(c => c.id === 'strike') || st1.hand?.[0]
  ev(`window.__sts.setState({ selectedCardUid: ${JSON.stringify(strike.uid)} })`)
  await sleep(400)
  const hits = evJson(`(() => {
    const enemy = document.querySelector('.enemy.targetable')
    if (!enemy) return { err: 'no targetable enemy' }
    const r = enemy.getBoundingClientRect()
    const pts = { intent: { x: r.x + r.width / 2, y: r.top + 25 }, head: { x: r.x + r.width / 2, y: r.top + 100 }, body: { x: r.x + r.width / 2, y: r.top + 180 }, name: { x: r.x + r.width / 2, y: r.bottom - 25 } }
    const out = {}
    for (const [k, p] of Object.entries(pts)) {
      const el = document.elementFromPoint(p.x, p.y)
      out[k] = el ? !!el.closest('.enemy') : false
    }
    const hud = document.querySelector('.top-hud')
    out.hudPe = hud ? getComputedStyle(hud).pointerEvents : 'missing'
    const deckBtn = document.querySelector('.top-hud .deck-btn')
    out.btnPe = deckBtn ? getComputedStyle(deckBtn).pointerEvents : 'missing'
    const potRow = document.querySelector('.top-hud .pots-row')
    out.potPe = potRow ? getComputedStyle(potRow).pointerEvents : 'missing'
    const hint = [...document.querySelectorAll('.target-hint')].pop()
    out.hintPe = hint ? getComputedStyle(hint).pointerEvents : 'no-hint'
    return out
  })()`)
  console.log('命中:', JSON.stringify(hits))
  check('意图区命中Boss', hits.intent === true)
  check('Boss头部命中', hits.head === true)
  check('Boss身体命中', hits.body === true)
  check('名字区命中Boss', hits.name === true)
  check('TopHud穿透(pe:none)', hits.hudPe === 'none', String(hits.hudPe))
  check('牌组按钮可点(pe:auto)', hits.btnPe === 'auto', String(hits.btnPe))
  check('药水行可点(pe:auto)', hits.potPe === 'auto', String(hits.potPe))

  // 真实点击头部 → 出牌
  const before = evJson(`window.__sts.getState().run.combat.enemies[0].hp`)
  ev(`(() => { const e = document.querySelector('.enemy.targetable'); const r = e.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.top + 100); el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return 'ok' })()`)
  await sleep(1000)
  const after = evJson(`(() => { const g = window.__sts.getState(); return { sel: g.selectedCardUid, hp: g.run.combat.enemies[0].hp } })()`)
  console.log('点击出牌:', before, '→', JSON.stringify(after))
  check('点击Boss头部成功出牌', after.sel === null && after.hp < before, `${before}→${after.hp}`)

  // 截图
  execFileSync('agent-browser', ['screenshot', '/home/z/my-project/scripts/batch10_standalone.png'], { encoding: 'utf-8', timeout: 60000 })
  console.log('截图: scripts/batch10_standalone.png')

  console.log(`\n== 结果: ${pass} 通过, ${fail} 失败 ==`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error('FATAL', e); process.exit(1) })
