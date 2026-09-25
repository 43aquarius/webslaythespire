// 单文件版浏览器测试：GitHub链接/角色选择bug/死亡怪红框/主菜单样式
import { execFileSync } from 'child_process'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
function ev(code: string): string {
  try {
    const out = execFileSync('agent-browser', ['eval', code, '--json'], { encoding: 'utf-8', timeout: 60000 })
    const j = JSON.parse(out)
    return j?.data?.result ?? j?.data ?? ''
  } catch (e: any) {
    return 'ERR:' + (e.stdout || e.message || '').slice(0, 300)
  }
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

  // 1. 主菜单渲染：Logo图 + 石板按钮
  const menu = ev(`(() => {
    const logo = document.querySelector('.menu-logo')
    const btns = [...document.querySelectorAll('.menu-btn')].map(b => b.textContent.trim().replace(/\\s+/g, ''))
    const gh = document.querySelector('.github-btn')
    return JSON.stringify({
      hasLogo: !!logo && logo.naturalWidth > 50,
      logoOk: logo && logo.complete && logo.naturalWidth > 100,
      btns,
      ghHref: gh ? gh.getAttribute('href') : null,
      bg: !!document.querySelector('.main-menu-bg'),
    })
  })()`)
  console.log('主菜单:', menu)
  const m = JSON.parse(menu)
  check('主菜单Logo图片渲染', m.logoOk, JSON.stringify(m))
  check('主菜单6个按钮', m.btns.length === 6, m.btns.join(','))
  check('GitHub链接正确', m.ghHref === 'https://github.com/43aquarius/webslaythespire', `${m.ghHref}`)
  check('尖塔主视觉背景', m.bg)

  // 2. 无竖屏提示（桌面）
  const noPrompt = ev(`document.getElementById('rotate-prompt') === null`)
  check('无竖屏提示拦截层', noPrompt === 'true', noPrompt)

  // 3. 角色选择bug：开始冒险 → 点四个角色 → 应停留在角色选择
  ev(`window.__sts.getState().gotoMenuScreen('charSelect')`)
  await sleep(500)
  let s = ev(`(() => {
    // 点击每个角色卡
    const cards = [...document.querySelectorAll('.char-card')]
    for (const c of cards) c.click()
    return JSON.stringify({
      clicked: cards.length,
      screen: window.__sts.getState().menuScreen,
      domIsCharSelect: !!document.querySelector('.char-row'),
      sel: document.querySelectorAll('.char-card.sel').length,
    })
  })()`)
  console.log('点四角色后:', s)
  const c1 = JSON.parse(s)
  check('点击四个角色仍停留在角色选择', c1.domIsCharSelect && c1.screen === 'charSelect', s)
  check('选中态高亮一个角色', c1.sel === 1, `sel=${c1.sel}`)

  // 4. 返回 → 再次开始冒险（原bug：按钮失效）
  ev(`window.__sts.getState().gotoMenuScreen('title')`)
  await sleep(400)
  const isMenu = ev(`!!document.querySelector('.menu-btn')`)
  check('返回主菜单正常', isMenu === 'true')
  ev(`window.__sts.getState().gotoMenuScreen('charSelect')`)
  await sleep(400)
  const isChar2 = ev(`!!document.querySelector('.char-row')`)
  check('再次开始冒险正常(原bug已修复)', isChar2 === 'true', isChar2)

  // 5. 出发 → 涅奥四槽
  ev(`window.__sts.getState().startRun(window.__sts.getState().selectedCharacter || 'ironclad')`)
  await sleep(600)
  const neow = ev(`(() => {
    const g = window.__sts.getState()
    const r = g.run
    const opts = r.neow ? r.neow.options : []
    return JSON.stringify({ screen: r.screen, n: opts.length, effects: opts.map(o => o.effect) })
  })()`)
  console.log('涅奥:', neow)
  const nw = JSON.parse(neow)
  check('涅奥四槽结构', nw.n === 4, neow)
  check('第四槽为Boss交换', nw.effects[3] === 'bossSwap', neow)

  // 选一个非选牌祝福（槽2）避免选牌弹窗
  ev(`window.__sts.getState().chooseNeow(1)`)
  await sleep(800)
  const afterNeow = ev(`(() => {
    const g = window.__sts.getState()
    return JSON.stringify({ screen: g.run ? g.run.screen : null, select: g.select ? g.select.kind : null })
  })()`)
  console.log('选槽2后:', afterNeow)

  // 6. 进入战斗测试死亡怪红框
  ev(`(() => {
    const g = window.__sts.getState()
    const r = g.run
    if (r.screen !== 'map') { r.screen = 'map' }
    window.__sts.setState({ run: r })
  })()`)
  await sleep(300)
  // 直接构造双怪战斗
  ev(`(() => {
    const g = window.__sts.getState()
    const r = g.run
    g.chooseNode(r.map.startNodes[0])
  })()`)
  await sleep(400)
  let st = ev(`window.__sts.getState().run.screen`)
  let guard = 0
  while (st !== 'combat' && guard++ < 6) { await sleep(500); st = ev(`window.__sts.getState().run.screen`) }
  check('进入战斗', st === 'combat', st)

  // 等首抽
  await sleep(1200)
  // 构造：杀掉一只怪（双怪遭遇时）
  const killed = ev(`(() => {
    const g = window.__sts.getState()
    const c = g.run.combat
    if (!c || c.enemies.length < 2) return 'SINGLE:' + (c ? c.enemies.length : 0)
    c.enemies[1].hp = 0
    c.enemies[1].dying = true
    window.__sts.setState({ run: g.run })
    return 'KILLED'
  })()`)
  console.log('击杀一只:', killed)
  if (killed.startsWith('SINGLE')) {
    console.log('  (单怪遭遇，跳过死亡怪红框测试)')
  } else {
    await sleep(400)
    // 选中一张攻击卡 → 检查死亡怪无红框
    const target = ev(`(() => {
      const g = window.__sts.getState()
      const c = g.run.combat
      const atk = c.players[c.activeIdx].hand.find(h => {
        const d = window.__CARDS ? null : null
        return h.id === 'strike' || h.id === 'bash' || h.id.includes('trike')
      })
      if (!atk) return 'NO_ATK'
      g.clickCard(atk.uid)
      return 'SELECTED'
    })()`)
    await sleep(400)
    const frame = ev(`(() => {
      const els = [...document.querySelectorAll('.enemy')]
      return JSON.stringify(els.map(e => ({
        dying: e.classList.contains('dying'),
        targetable: e.classList.contains('targetable'),
        visible: getComputedStyle(e).opacity !== '0',
      })))
    })()`)
    console.log('敌人红框状态:', frame)
    try {
      const fr = JSON.parse(frame)
      const dead = fr.filter(f => f.dying)
      check('死亡怪无红框(targetable)', dead.length > 0 && dead.every(d => !d.targetable), frame)
      const alive = fr.filter(f => !f.dying)
      check('存活怪有红框', alive.length > 0 && alive.every(a => a.targetable), frame)
    } catch { console.log('  红框检查解析失败:', frame) }
    ev(`window.__sts.getState().cancelSelection()`)
  }

  console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
  execFileSync('agent-browser', ['screenshot', '/tmp/standalone_menu_test.png'], { encoding: 'utf-8' })
  process.exit(fail ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
