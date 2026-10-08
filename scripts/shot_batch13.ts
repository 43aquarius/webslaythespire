// 第十三批视觉截图：浮动伤害数字/蓝色血条/意图爆发/升级特效
import { execFileSync } from 'child_process'

const URL = process.argv[2] || 'http://localhost:3000/'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const OUT = '/home/z/my-project/scripts/study/batch13'

function ev(code: string): any {
  try {
    const out = execFileSync('agent-browser', ['eval', code, '--json'], { encoding: 'utf-8', timeout: 60000 })
    const j = JSON.parse(out)
    return j?.data?.result ?? j?.data ?? ''
  } catch (e: any) {
    return 'ERR:' + (e.stdout || e.message || '').slice(0, 300)
  }
}

async function main() {
  execFileSync('agent-browser', ['open', URL], { encoding: 'utf-8', timeout: 60000 })
  await sleep(3000)
  for (let i = 0; i < 15; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(1000)
  }
  // 开局进战斗
  ev(`window.__sts.getState().startRun('ironclad')`)
  await sleep(3500)
  ev(`window.__sts.getState().chooseNeow(1)`)
  for (let i = 0; i < 12; i++) {
    const s = ev(`window.__sts.getState().run?.screen`)
    if (s === 'map') break
    await sleep(800)
  }
  ev(`(() => { const st = window.__sts.getState(); const r = st.run; if (r && r.screen === 'map') { st.chooseNode(r.map.startNodes[0]); return 'ok' } return 'notmap' })()`)
  for (let i = 0; i < 12; i++) {
    if (ev(`window.__sts.getState().run?.screen`) === 'combat') break
    await sleep(700)
  }
  await sleep(2500) // 等状态栏滑入完成+意图浮动

  // === 截图1：战斗全景（意图浮动+状态栏+手牌） ===
  execFileSync('agent-browser', ['screenshot', `${OUT}/combat_full.png`], { encoding: 'utf-8', timeout: 60000 })

  // === 截图2：蓝色血条 + 浮动伤害数字（注入后立刻截图） ===
  const uid = ev(`window.__sts.getState().run?.combat?.enemies.find(e => !e.dying && e.hp > 0)?.uid`)
  ev(`(() => {
    const st = window.__sts.getState()
    const r = JSON.parse(JSON.stringify(st.run))
    const e = r.combat.enemies.find(x => !x.dying && x.hp > 0)
    e.block = 9
    window.__sts.setState({ run: r })
    return 'ok'
  })()`)
  await sleep(600)
  ev(`(() => {
    const st = window.__sts.getState()
    window.__sts.setState({ fxList: [...st.fxList, { kind: 'dmg', target: ${JSON.stringify(uid)}, value: 7, id: 990101, ts: Date.now() }] })
    return 'ok'
  })()`)
  await sleep(650) // 数字上升途中（红→奶油过渡中段）
  execFileSync('agent-browser', ['screenshot', `${OUT}/bluebar_damage.png`], { encoding: 'utf-8', timeout: 60000 })

  // === 截图3：意图爆发（撤格挡→爆发瞬间） ===
  ev(`(() => {
    const st = window.__sts.getState()
    const r = JSON.parse(JSON.stringify(st.run))
    const e = r.combat.enemies.find(x => !x.dying && x.hp > 0)
    e.block = 0
    window.__sts.setState({ run: r })
    return 'ok'
  })()`)
  await sleep(900)
  ev(`(() => {
    const st = window.__sts.getState()
    window.__sts.setState({ fxList: [...st.fxList, { kind: 'intentBurst', target: ${JSON.stringify(uid)}, value: 0, text: 'attack', id: 990102, ts: Date.now() }] })
    return 'ok'
  })()`)
  await sleep(750) // 四副本放大中
  execFileSync('agent-browser', ['screenshot', `${OUT}/intent_burst.png`], { encoding: 'utf-8', timeout: 60000 })

  // === 截图4：锻造升级特效（卡+星光） ===
  await sleep(1500)
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
  const pickUid = ev(`window.__sts.getState().select?.cardUids?.[0]`)
  ev(`window.__sts.getState().resolveSelect(${JSON.stringify(pickUid)})`)
  await sleep(900) // 卡牌放大完成+星光绽放中
  execFileSync('agent-browser', ['screenshot', `${OUT}/upgrade_fx.png`], { encoding: 'utf-8', timeout: 60000 })

  console.log('截图完成')
}

main().catch(e => { console.error(e); process.exit(1) })
