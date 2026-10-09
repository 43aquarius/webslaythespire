// 复现第十六批单文件版 ③药水获得入场动画 失败
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

async function main() {
  execFileSync('agent-browser', ['open', 'file:///home/z/my-project/download/slay-the-spire-standalone.html'], { encoding: 'utf-8', timeout: 60000 })
  await sleep(3000)
  for (let i = 0; i < 15; i++) { if (ev(`typeof window.__sts === 'function'`) === true) break; await sleep(1000) }
  console.log('store就绪:', ev(`typeof window.__sts === 'function'`) === true)

  // 进地图（同测试流程）
  ev(`window.__sts.getState().startRun('ironclad')`)
  await sleep(500)
  for (let i = 0; i < 14; i++) {
    const sc = ev(`window.__sts.getState().run?.screen`)
    if (sc === 'neow' || sc === 'map') break
    await sleep(700)
  }
  for (let i = 0; i < 12; i++) {
    const j = evJson(`(() => { const g = window.__sts.getState(); return JSON.stringify({ screen: g.run?.screen, sel: g.select ? g.select.kind : null, uids: g.select?.cardUids?.slice(0,2) }) })()`)
    if (j.screen === 'map' && !j.sel) break
    if (j.screen === 'neow') ev(`window.__sts.getState().chooseNeow(1)`)
    if (j.sel && Array.isArray(j.uids) && j.uids.length) ev(`window.__sts.getState().resolveSelect(${JSON.stringify(j.uids[0])})`)
    await sleep(700)
  }
  await sleep(2600)
  console.log('screen:', ev(`window.__sts.getState().run?.screen`))

  // 关键检查：地图界面 #hud-potions 是否存在
  const pre = evJson(`(() => {
    const row = document.getElementById('hud-potions')
    return { exists: !!row, html: row ? row.innerHTML.slice(0, 200) : null, parent: row ? row.parentElement.className : null, visible: row ? row.getBoundingClientRect().height : 0 }
  })()`)
  console.log('变更前 #hud-potions:', JSON.stringify(pre))

  // 复刻 ① gold + ② deck（保持与测试完全相同的序列）
  evJson(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.players[0].gold += 800; window.__sts.setState({ run: r }); return { ok: true } })()`)
  await sleep(2000)
  evJson(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.players[0].deck.push({ uid: 'test_deck_1', id: 'strike', upgraded: 0 }); window.__sts.setState({ run: r }); return { ok: true } })()`)
  await sleep(300)

  // ③ 药水变更
  evJson(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.potions[0] = 'firePotion'; r.players[0].potions = r.potions; window.__sts.setState({ run: r }); return { ok: true, potions: r.potions } })()`)
  await sleep(80)
  const t80 = evJson(`(() => {
    const el = document.querySelector('#hud-potions .sts-pot-in')
    const row = document.getElementById('hud-potions')
    return { at: '80ms', found: !!el, rowHtml: row ? row.innerHTML.slice(0, 300) : null }
  })()`)
  console.log('T+80ms:', JSON.stringify(t80).slice(0, 400))
  await sleep(300)
  const t380 = evJson(`(() => {
    const el = document.querySelector('#hud-potions .sts-pot-in')
    const row = document.getElementById('hud-potions')
    return { at: '380ms', found: !!el, rowHtml: row ? row.innerHTML.slice(0, 300) : null }
  })()`)
  console.log('T+380ms:', JSON.stringify(t380).slice(0, 400))

  // 检查 80ms~380ms 之间是否发生重渲染导致 class 被移除：监听 setHtml
  const again = evJson(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.potions[1] = 'blockPotion'; r.players[0].potions = r.potions; window.__sts.setState({ run: r }); return { ok: true } })()`)
  await sleep(80)
  const t2 = evJson(`(() => {
    const els = document.querySelectorAll('#hud-potions .sts-pot-in')
    const row = document.getElementById('hud-potions')
    return { found: els.length, rowHtml: row ? row.innerHTML.slice(0, 400) : null }
  })()`)
  console.log('第二药水后80ms (期望2个pot-in):', JSON.stringify(t2).slice(0, 500))
}
main().catch(e => { console.error(e); process.exit(1) })
