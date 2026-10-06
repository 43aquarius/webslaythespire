// 第十批修复验证：①卡面艺术图与边框同盒对齐 ②Boss可点击性
// 用法: bun run scripts/test_batch10.ts [url]
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
  if (r !== null && typeof r === 'object') return r   // agent-browser 已解析为对象
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
  await sleep(1500)

  // ===== 开局：ironclad → 涅奥槽4(Boss交换) =====
  ev(`window.__sts.getState().startRun('ironclad')`)
  // 等涅奥屏就绪
  for (let i = 0; i < 10; i++) {
    const s = ev(`window.__sts.getState().run?.screen`)
    if (s === 'neow') break
    await sleep(700)
  }
  ev(`window.__sts.getState().chooseNeow(3)`)
  // 涅奥槽4有随机Boss遗物交换过程，轮询等待进入地图屏
  for (let i = 0; i < 12; i++) {
    const scr = evJson(`(() => { const g = window.__sts.getState(); return JSON.stringify({ screen: g.run?.screen, select: g.select ? g.select.kind : null }) })()`)
    if (scr.screen === 'map' && !scr.select) break
    if (scr.select) {
      const uids = evJson(`window.__sts.getState().select?.cardUids?.slice(0,3)`)
      if (Array.isArray(uids) && uids.length) {
        ev(`window.__sts.getState().resolveSelect(${JSON.stringify(uids[0])})`)
      }
    }
    await sleep(800)
  }

  // ===== 强制直达Boss =====
  const bossNav = evJson(`(() => {
    const st = window.__sts.getState()
    if (!st.run) return JSON.stringify({ err: 'no run, screen=' + st.screen })
    if (st.select) return JSON.stringify({ needSelect: st.select.kind })
    const bossId = st.run.map.bossNodeId
    st.run.map.startNodes.push(bossId)
    window.__sts.setState({ run: { ...st.run } })
    return JSON.stringify({ bossId, startNodes: st.run.map.startNodes })
  })()`)
  if (bossNav.needSelect) {
    // 涅奥槽4可能触发遗物选择(交换)
    const uids = evJson(`window.__sts.getState().select?.cardUids?.slice(0,3)`)
    if (Array.isArray(uids) && uids.length) {
      ev(`window.__sts.getState().resolveSelect(${JSON.stringify(uids[0])})`)
      await sleep(600)
    }
    ev(`(() => {
      const st = window.__sts.getState()
      const bossId = st.run.map.bossNodeId
      st.run.map.startNodes.push(bossId)
      window.__sts.setState({ run: { ...st.run } })
      return 'ok'
    })()`)
  }
  await sleep(400)
  const bossId: string = bossNav.bossId || ev(`window.__sts.getState().run?.map?.bossNodeId`)
  console.log('boss节点:', bossId)
  // 等 busy 清除后选节点（过场动画期间 chooseNode 会被 busy 守卫吞掉），失败重试
  let combatStarted = false
  for (let i = 0; i < 10 && !combatStarted; i++) {
    await sleep(600)
    ev(`window.__sts.getState().chooseNode(${JSON.stringify(bossId)})`)
    await sleep(1200)
    combatStarted = ev(`!!window.__sts.getState().run?.combat`) === true
  }
  await sleep(1500)

  // ===== 战斗状态 =====
  const st1 = evJson(`(() => {
    const g = window.__sts.getState()
    const r = g.run
    if (!r || !r.combat) return JSON.stringify({ err: 'no combat', screen: g.screen })
    return JSON.stringify({
      screen: r.screen, phase: r.combat.phase,
      enemies: r.combat.enemies.map(e => ({ id: e.id, hp: e.hp, dying: e.dying, uid: e.uid })),
      hand: r.combat.players[0].hand.map(c => ({ uid: c.uid, id: c.id })),
    })
  })()`)
  console.log('战斗状态:', JSON.stringify(st1).slice(0, 300))
  check('Boss战斗已开始', Array.isArray(st1.enemies) && st1.enemies.length >= 1, JSON.stringify(st1).slice(0, 150))
  const boss = st1.enemies?.[0]
  check('敌人是Boss级(高血量)', !!boss && boss.hp >= 140, boss ? `${boss.id}:${boss.hp}` : '无')

  await sleep(1500)  // 等入场动画

  // ===== 测试1: 卡面艺术图与边框同盒(数学级对齐断言) =====
  const align = evJson(`(() => {
    const card = document.querySelector('.sts-card .sts-canvas-box')
    if (!card) return { err: 'no canvas-box' }
    const layers = [...card.querySelectorAll(':scope > img.sts-canvas-layer')]
    const rectOf = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } }
    const art = layers.find(i => (i.src || '').includes('/cardart/'))
    const frame = layers.find(i => (i.src || '').includes('frame'))
    if (!art || !frame) return { err: 'layer missing', n: layers.length, srcs: layers.map(i => i.src.split('/').slice(-2).join('/')) }
    const ra = rectOf(art), rf = rectOf(frame)
    return {
      layerCount: layers.length,
      artSrc: art.src.split('/').pop(),
      same: ra.x === rf.x && ra.y === rf.y && ra.w === rf.w && ra.h === rf.h,
      ra, rf,
      artNatural: art.naturalWidth + 'x' + art.naturalHeight,
      artLoaded: art.complete && art.naturalWidth > 0,
    }
  })()`)
  console.log('对齐检测:', JSON.stringify(align).slice(0, 400))
  check('艺术图是画布图层(clayer)', align.artSrc?.endsWith('.webp') === true, String(align.artSrc))
  check('艺术图已加载(512画布)', align.artLoaded === true && align.artNatural === '512x512', String(align.artNatural))
  check('艺术图与边框矩形完全相同(数学对齐)', align.same === true,
    `art(${align.ra?.x?.toFixed?.(1)},${align.ra?.y?.toFixed?.(1)},${align.ra?.w?.toFixed?.(1)},${align.ra?.h?.toFixed?.(1)}) vs frame(${align.rf?.x?.toFixed?.(1)},${align.rf?.y?.toFixed?.(1)},${align.rf?.w?.toFixed?.(1)},${align.rf?.h?.toFixed?.(1)})`)

  // ===== 测试2: 选中攻击牌 → Boss可点击性 =====
  const strike = st1.hand?.find(c => c.id === 'strike') || st1.hand?.[0]
  check('手牌非空', !!strike, '无手牌')
  ev(`window.__sts.setState({ selectedCardUid: ${JSON.stringify(strike.uid)} })`)
  await sleep(400)

  const targetable = ev(`!!document.querySelector('.sts-targetable') && !!document.querySelector('.sts-targetable img')`)
  check('Boss红框提示(targetable)', targetable === true)

  // 命中测试: 意图区 / Boss头部 / Boss身体 (修复前这些点命中的是TopHud)
  const hits = evJson(`(() => {
    const enemy = document.querySelector('.sts-targetable')
    if (!enemy) return { err: 'no enemy' }
    const r = enemy.getBoundingClientRect()
    const cx = r.x + r.width / 2
    const pts = {
      intent: { x: cx, y: r.top + 25 },          // 意图图标区(顶部118..168)
      head: { x: cx, y: r.top + 60 + 40 },       // Boss头部(精灵图顶部)
      body: { x: cx, y: r.top + 60 + 180 },      // Boss身体中部
      name: { x: cx, y: r.bottom - 30 },         // 名字/血条区
    }
    const out = {}
    for (const [k, p] of Object.entries(pts)) {
      const el = document.elementFromPoint(p.x, p.y)
      const inEnemy = el ? !!el.closest('.sts-targetable') : false
      const inTopHud = el ? !!el.closest('.top-hud, [class*="top-0"]') && !!el.closest('[class*="z-40"]') : false
      out[k] = {
        hit: el ? (el.tagName + '.' + String(el.className).split(' ').slice(0,2).join('.')) : 'null',
        inEnemy,
        topHudRect: (() => {
          // TopHud的实际盒子(是否覆盖该点)
          const hud = document.querySelector('[class*="top-0"][class*="z-40"]')
          if (!hud) return null
          const hr = hud.getBoundingClientRect()
          return { covers: p.x >= hr.x && p.x <= hr.right && p.y >= hr.y && p.y <= hr.bottom, h: hr.height }
        })(),
      }
    }
    out.enemyRect = { top: r.top, bottom: r.bottom, h: r.height }
    return out
  })()`)
  console.log('命中测试:', JSON.stringify(hits).slice(0, 600))
  if (!hits.err) {
    check('意图区点击命中Boss', hits.intent?.inEnemy === true, `${hits.intent?.hit} TopHud覆盖=${hits.intent?.topHudRect?.covers} HUD高${hits.intent?.topHudRect?.h}`)
    check('Boss头部点击命中Boss', hits.head?.inEnemy === true, `${hits.head?.hit}`)
    check('Boss身体点击命中Boss', hits.body?.inEnemy === true, `${hits.body?.hit}`)
    check('Boss名字区点击命中Boss', hits.name?.inEnemy === true, `${hits.name?.hit}`)
  } else {
    check('命中测试可执行', false, hits.err)
  }

  // ===== 测试3: 真实点击Boss头部 → 出牌成功 =====
  const playResult = evJson(`(() => {
    const enemy = document.querySelector('.sts-targetable')
    if (!enemy) return { err: 'no enemy' }
    const r = enemy.getBoundingClientRect()
    const head = document.elementFromPoint(r.x + r.width / 2, r.top + 60 + 40)
    if (!head) return { err: 'no element at head' }
    head.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.x + r.width / 2, clientY: r.top + 100 }))
    return { clicked: head.tagName, cls: String(head.className).slice(0, 40) }
  })()`)
  await sleep(900)
  const after = evJson(`(() => {
    const g = window.__sts.getState()
    return {
      selectedCleared: g.selectedCardUid === null,
      hand: g.run?.combat?.players[0]?.hand?.length,
      energy: g.run?.combat?.players[0]?.energy,
      busy: g.busy,
      bossHp: g.run?.combat?.enemies?.[0]?.hp,
    }
  })()`)
  console.log('点击出牌:', JSON.stringify(playResult), '→', JSON.stringify(after))
  check('点击Boss头部成功出牌', after.selectedCleared === true && after.energy !== undefined, JSON.stringify(after))
  const playedOk = after.selectedCleared === true
  if (playedOk) {
    check('Boss受到伤害(出牌生效)', after.bossHp < (boss?.hp ?? 999), `${after.bossHp} < ${boss?.hp}`)
  }

  // ===== 测试4: 选中提示横幅不挡点击 =====
  const hint = evJson(`(() => {
    const g = window.__sts.getState()
    const card = g.run?.combat?.players[0]?.hand?.[0]
    if (!card) return { err: 'no card' }
    window.__sts.setState({ selectedCardUid: card.uid })
    return 'set'
  })()`)
  await sleep(400)
  const hintTest = evJson(`(() => {
    // 找到底部350px的提示条
    const hints = [...document.querySelectorAll('div')].filter(d => {
      const s = getComputedStyle(d)
      return s.position === 'absolute' && d.textContent.includes('选择目标') || d.textContent.includes('点击敌人打出')
    })
    const h = hints[hints.length - 1]
    if (!h) return { err: 'hint not found' }
    const r = h.getBoundingClientRect()
    const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return {
      hintRect: { x: r.x, y: r.y, w: r.width, h: r.height },
      pe: getComputedStyle(h).pointerEvents,
      elementAtCenter: el ? el.tagName + '.' + String(el.className).split(' ')[0] : 'null',
      isHintItself: el === h || h.contains(el),
    }
  })()`)
  console.log('提示横幅:', JSON.stringify(hintTest).slice(0, 300))
  if (!hintTest.err) {
    check('提示横幅pointer-events:none', hintTest.pe === 'none', hintTest.pe)
    check('提示横幅不拦截点击', hintTest.isHintItself === false, hintTest.elementAtCenter)
  }

  // ===== 测试5: HUD交互元素仍可用(穿透不误伤) =====
  const hudOk = evJson(`(() => {
    const hud = document.querySelector('[class*="top-0"][class*="z-40"]')
    if (!hud) return { err: 'no hud' }
    const pe = getComputedStyle(hud).pointerEvents
    // 药水行/遗物行应恢复 auto
    const relic = hud.querySelector('.sts-relic') || hud.querySelector('[class*="relic"]')
    const relicPe = relic ? getComputedStyle(relic.closest('div[class*="pointer"]') || relic).pointerEvents : 'no-relic'
    const btn = hud.querySelector('button')
    const btnPe = btn ? getComputedStyle(btn).pointerEvents : 'no-btn'
    return { hudPe: pe, relicPe, btnPe }
  })()`)
  console.log('HUD交互:', JSON.stringify(hudOk))
  check('TopHud容器穿透(pe:none)', hudOk.hudPe === 'none', String(hudOk.hudPe))
  check('牌组按钮仍可点击(pe:auto)', hudOk.btnPe === 'auto', String(hudOk.btnPe))

  // ===== 测试6: 截图(VLM视觉核验用) =====
  execFileSync('agent-browser', ['screenshot', '/home/z/my-project/scripts/batch10_combat.png'], { encoding: 'utf-8', timeout: 60000 })
  console.log('截图: scripts/batch10_combat.png')

  // ===== 测试7: 卡牌放大视图(牌组弹窗, 大尺寸下对齐) =====
  ev(`window.__sts.getState().openPile('deck')`)
  await sleep(800)
  const deckAlign = evJson(`(() => {
    const card = document.querySelector('.overlay .sts-card .sts-canvas-box, .sel-cards .sts-card .sts-canvas-box, [class*="pile"] .sts-card .sts-canvas-box') || document.querySelector('.sts-card .sts-canvas-box')
    if (!card) return { err: 'no card in overlay' }
    const layers = [...card.querySelectorAll(':scope > img.sts-canvas-layer')]
    const rectOf = el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(v => Math.round(v * 100) / 100) }
    const art = layers.find(i => (i.src || '').includes('/cardart/'))
    const frame = layers.find(i => (i.src || '').includes('frame'))
    if (!art || !frame) return { err: 'layers' }
    const ra = rectOf(art), rf = rectOf(frame)
    return { same: ra.every((v, i) => Math.abs(v - rf[i]) < 0.01), ra, rf, w: rf[2] }
  })()`)
  console.log('弹窗卡牌对齐:', JSON.stringify(deckAlign).slice(0, 300))
  check('放大视图艺术图边框仍完全同盒', deckAlign.same === true, JSON.stringify(deckAlign).slice(0, 200))
  execFileSync('agent-browser', ['screenshot', '/home/z/my-project/scripts/batch10_deck.png'], { encoding: 'utf-8', timeout: 60000 })
  console.log('截图: scripts/batch10_deck.png')
  ev(`window.__sts.getState().closePile && window.__sts.getState().closePile()`)

  console.log(`\n== 结果: ${pass} 通过, ${fail} 失败 ==`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error('FATAL', e); process.exit(1) })
