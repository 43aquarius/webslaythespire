// Next.js版浏览器测试：主菜单还原/角色选择bug/死亡怪红框/涅奥
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

let pass = 0, fail = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${detail}`) }
}

async function main() {
  console.log('== 打开 Next.js 版 ==')
  execFileSync('agent-browser', ['open', 'http://localhost:3000/'], { encoding: 'utf-8', timeout: 60000 })
  // 等待 React hydration（dev 冷编译时较慢）
  for (let i = 0; i < 20; i++) {
    const ready = ev(`typeof window.__sts === 'function' && !!document.querySelector('.menu-item')`)
    if (ready === true) break
    await sleep(1000)
  }
  await sleep(2500)

  // 1. 主菜单
  const m = ev(`(() => {
    const logo = document.querySelector('.menu-logo')
    const btns = [...document.querySelectorAll('.menu-item')].map(b => b.textContent.trim().replace(/\\s+/g, ''))
    const gh = document.querySelector('a[href*="github.com"]')
    return JSON.stringify({
      logoOk: logo && logo.complete && logo.naturalWidth > 100,
      btns,
      ghHref: gh ? gh.href : null,
    })
  })()`)
  console.log('主菜单:', m)
  const mj = JSON.parse(m)
  check('主菜单Logo渲染', mj.logoOk)
  check('主菜单6按钮', mj.btns.length === 6, mj.btns.join(','))
  check('GitHub链接正确', mj.ghHref === 'https://github.com/43aquarius/webslaythespire', `${mj.ghHref}`)

  // 2. 竖屏提示不存在（桌面）
  check('无竖屏提示', ev(`document.querySelector('.sts-rotate-phone') === null && !document.body.textContent.includes('请横屏游玩')`) === true)

  // 3. 角色选择：开始冒险→点4角色→仍在角色选择→返回→再进
  ev(`[...document.querySelectorAll('button')].find(b => b.textContent.replace(/\\s+/g, '').includes('开始冒险')).click()`)
  await sleep(600)
  check('进入角色选择', ev(`!!document.querySelector('.char-stand')`) === true)
  ev(`(() => { [...document.querySelectorAll('.char-stand')].forEach(c => c.click()) })()`)
  await sleep(500)
  check('点4角色仍停留角色选择', ev(`!!document.querySelector('.char-stand')`) === true)
  ev(`[...document.querySelectorAll('button')].find(b => b.textContent.replace(/\\s+/g, '') === '返回').click()`)
  await sleep(500)
  check('返回主菜单', ev(`!!document.querySelector('.menu-item')`) === true)
  ev(`[...document.querySelectorAll('button')].find(b => b.textContent.replace(/\\s+/g, '').includes('开始冒险')).click()`)
  await sleep(500)
  check('再次开始冒险正常', ev(`!!document.querySelector('.char-stand')`) === true)

  // 4. 出发 → 涅奥
  ev(`(() => { const g = window.__sts.getState(); g.selectCharacter('ironclad'); g.startRun(); })()`)
  await sleep(800)
  const nw = ev(`(() => {
    const g = window.__sts.getState()
    const opts = g.run?.neow?.options ?? []
    return JSON.stringify({ screen: g.run?.screen, n: opts.length, eff: opts.map(o => o.effect) })
  })()`)
  console.log('涅奥:', nw)
  const nwj = JSON.parse(nw)
  check('涅奥四槽', nwj.n === 4, nw)
  check('第四槽Boss交换', nwj.eff[3] === 'bossSwap', nw)

  // 5. 选槽2（非选牌类）进地图
  ev(`window.__sts.getState().chooseNeow(1)`)
  await sleep(900)
  const scr1 = ev(`window.__sts.getState().run.screen`)
  console.log('选槽2后界面:', scr1)

  // 6. 战斗测试死亡怪红框
  ev(`window.__sts.getState().chooseNode(window.__sts.getState().run.map.startNodes[0])`)
  await sleep(600)
  let st = ev(`window.__sts.getState().run.screen`)
  let guard = 0
  while (st !== 'combat' && guard++ < 8) { await sleep(600); st = ev(`window.__sts.getState().run.screen`) }
  check('进入战斗', st === 'combat', String(st))
  await sleep(1500)

  const prep = ev(`(() => {
    const g = window.__sts.getState()
    const c = g.run.combat
    if (c.enemies.length < 2) return 'SINGLE'
    c.enemies[1].hp = 0; c.enemies[1].dying = true
    window.__sts.setState({ run: { ...g.run } })
    return 'OK'
  })()`)
  if (prep === 'OK') {
    await sleep(300)
    // 选中攻击卡
    ev(`(() => {
      const g = window.__sts.getState()
      const c = g.run.combat
      const atk = c.players[c.activeIdx].hand.find(h => ['strike', 'bash'].includes(h.id))
      if (atk) g.clickCard(atk.uid)
    })()`)
    await sleep(500)
    const fr = ev(`(() => {
      const els = [...document.querySelectorAll('.sts-targetable, .enemy')]
      const all = [...(document.querySelectorAll('[class*=\"targetable\"]'))]
      return JSON.stringify({
        targetableCount: document.querySelectorAll('.sts-targetable').length,
        dyingEls: [...document.querySelectorAll('.sts-dying')].length,
      })
    })()`)
    console.log('红框检查:', fr)
    const frj = JSON.parse(fr)
    // 双怪一只死：targetable 应只有1个（活怪），dying元素存在但无targetable类
    check('死亡怪无红框', frj.targetableCount === 1 && frj.dyingEls >= 1, fr)
    ev(`window.__sts.getState().cancelSelection()`)
  } else {
    console.log('  (单怪遭遇跳过红框测试)')
  }

  execFileSync('agent-browser', ['screenshot', '/tmp/nextjs_menu.png'], { encoding: 'utf-8' })
  console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
