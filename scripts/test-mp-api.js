#!/usr/bin/env bun
// /api/mp 联机中转回归测试(17 项断言) — 重建自 v1.8 协议(route.ts)
const BASE = process.env.MP_BASE || 'http://localhost:3000/api/mp'
let pass = 0, fail = 0
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${detail}`) }
}
const post = async (body) => {
  const r = await fetch(BASE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return { status: r.status, json: await r.json().catch(() => null) }
}

const main = async () => {
  console.log(`== /api/mp 回归测试 (${BASE}) ==`)

  // 1. ping
  let r = await post({ t: 'ping' })
  ok('ping → ok+pong+rooms', r.json?.ok === true && r.json?.pong === true && typeof r.json?.rooms === 'number')

  // 2. 未知动作
  r = await post({ t: 'nope' })
  ok('unknown action → 400 unknown-action', r.status === 400 && r.json?.error === 'unknown-action')

  // 3. 坏 JSON
  const raw = await fetch(BASE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' })
  ok('bad json → 400 bad-request', raw.status === 400 && (await raw.json())?.error === 'bad-request')

  // 4. 创建房间
  r = await post({ t: 'create', name: '房主甲' })
  const code = r.json?.code
  ok('create → ok + 4位code', r.json?.ok === true && typeof code === 'string' && code.length === 4, JSON.stringify(r.json))

  // 5. 大厅列表
  r = await post({ t: 'rooms' })
  const entry = (r.json?.rooms || []).find(x => x.code === code)
  ok('rooms → 新房间在列(open/房主名)', !!entry && entry.status === 'open' && entry.host === '房主甲', JSON.stringify(r.json?.rooms))

  // 6. 加入不存在的房间
  r = await post({ t: 'join', code: 'ZZZZ', name: '客' })
  ok('join 不存在房间 → 房间不存在', r.json?.ok === false && r.json?.error === '房间不存在或已关闭')

  // 7. 正常加入
  r = await post({ t: 'join', code, name: '客机乙' })
  ok('join → ok + 返回房主名', r.json?.ok === true && r.json?.host === '房主甲', JSON.stringify(r.json))

  // 8. 房间已满
  r = await post({ t: 'join', code, name: '第三人' })
  ok('join 已满 → 房间已满', r.json?.ok === false && r.json?.error === '房间已满（双人合作）')

  // 9. 房主收到 peer 通知
  r = await post({ t: 'poll', code, role: 'host' })
  const peerMsg = (r.json?.msgs || []).find(m => m.t === 'peer')
  ok('host poll → peer 通知(含客机名)', !!peerMsg && peerMsg.name === '客机乙', JSON.stringify(r.json))

  // 10. 客机 relay
  r = await post({ t: 'relay', code, role: 'guest', payload: { act: 'play', card: 0 } })
  ok('guest relay → ok', r.json?.ok === true)

  // 11. 房主收到中转消息
  r = await post({ t: 'poll', code, role: 'host' })
  const relayMsg = (r.json?.msgs || []).find(m => m.t === 'relay')
  ok('host poll → relay 载荷', !!relayMsg && relayMsg.payload?.act === 'play', JSON.stringify(r.json?.msgs))

  // 12. 信箱取走即空
  r = await post({ t: 'poll', code, role: 'host' })
  ok('host 二次 poll → 空信箱', r.json?.ok === true && Array.isArray(r.json?.msgs) && r.json.msgs.length === 0, JSON.stringify(r.json))

  // 13. 房主 relay → 客机收到
  await post({ t: 'relay', code, role: 'host', payload: { snap: 'v1' } })
  r = await post({ t: 'poll', code, role: 'guest' })
  const gMsgs = r.json?.msgs || []
  ok('guest poll → relay 载荷', gMsgs.some(m => m.t === 'relay' && m.payload?.snap === 'v1'), JSON.stringify(gMsgs))

  // 14. 客机离开 → 房主收到 peer-left
  await post({ t: 'leave', code, role: 'guest' })
  r = await post({ t: 'poll', code, role: 'host' })
  ok('guest leave → host 收到 peer-left', (r.json?.msgs || []).some(m => m.t === 'peer-left'), JSON.stringify(r.json?.msgs))

  // 15. 重新加入(房间恢复 open)
  r = await post({ t: 'join', code, name: '客机丙' })
  const rooms1 = await post({ t: 'rooms' })
  const e1 = (rooms1.json?.rooms || []).find(x => x.code === code)
  ok('rejoin → ok 且大厅 full/guests=1', r.json?.ok === true && e1?.status === 'full' && e1?.guests === 1, JSON.stringify(e1))

  // 16. 房主离开 → 房间销毁, 客机收到关闭通知
  await post({ t: 'leave', code, role: 'host' })
  r = await post({ t: 'poll', code, role: 'guest' })
  ok('host leave → guest peer-left / 房间已关闭', (r.json?.msgs || []).some(m => m.t === 'peer-left'), JSON.stringify(r.json?.msgs))

  // 17. 房间销毁后 poll → 等价 peer-left; 大厅无此房
  r = await post({ t: 'poll', code, role: 'guest' })
  const rooms2 = await post({ t: 'rooms' })
  ok('房间销毁后 poll → 房间已关闭 且大厅除名', (r.json?.msgs || []).some(m => m.t === 'peer-left') && !(rooms2.json?.rooms || []).some(x => x.code === code), JSON.stringify(r.json))

  console.log(`\n结果: ${pass}/17 通过, ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}
main()
