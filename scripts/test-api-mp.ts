// /api/mp HTTP 轮询中转协议集成测试（对本地 dev 服务器）
// 覆盖：ping / create / rooms / join / relay双向 / poll双向 / leave / room-gone / 倒序加入校验
const BASE = process.env.MP_BASE || 'http://localhost:3000/api/mp'

let passed = 0, failed = 0
function ok(cond: boolean, name: string, extra = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else { failed++; console.log(`  ✗ ${name} ${extra}`) }
}

async function post(body: object, timeoutMs = 8000): Promise<any> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(BASE, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: ctrl.signal,
    })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    return await res.json()
  } finally { clearTimeout(timer) }
}

async function main() {
  console.log(`测试目标: ${BASE}`)

  // 1. ping
  const ping = await post({ t: 'ping' })
  ok(ping.ok === true && ping.pong === true, 'ping')

  // 2. create
  const created = await post({ t: 'create', name: '房主甲' })
  ok(created.ok === true && /^[A-Z2-9]{4}$/.test(created.code), 'create 返回 4 位房间码', JSON.stringify(created))
  const code = created.code

  // 3. rooms（大厅应列出该房间）
  const rooms1 = await post({ t: 'rooms' })
  const mine = (rooms1.rooms || []).find((r: any) => r.code === code)
  ok(!!mine && mine.host === '房主甲' && mine.status === 'open', 'rooms 列出新房间', JSON.stringify(rooms1))

  // 4. join（客机加入）
  const joined = await post({ t: 'join', code, name: '客机乙' })
  ok(joined.ok === true && joined.host === '房主甲', 'join 成功并返回房主昵称', JSON.stringify(joined))

  // 5. 房主 poll 应收到 peer 消息
  const hostPoll1 = await post({ t: 'poll', code, role: 'host' })
  ok(hostPoll1.ok && hostPoll1.msgs.some((m: any) => m.t === 'peer' && m.name === '客机乙'), '房主 poll 收到 peer', JSON.stringify(hostPoll1))

  // 6. 客机 relay → 房主 poll 收到（hello）
  await post({ t: 'relay', code, role: 'guest', payload: { t: 'hello', name: '客机乙' } })
  const hostPoll2 = await post({ t: 'poll', code, role: 'host' })
  ok(hostPoll2.msgs.some((m: any) => m.t === 'relay' && m.payload?.t === 'hello'), '客机→房主 relay 送达', JSON.stringify(hostPoll2))

  // 7. 房主 relay → 客机 poll 收到（welcome）
  await post({ t: 'relay', code, role: 'host', payload: { t: 'welcome', hostName: '房主甲' } })
  const guestPoll1 = await post({ t: 'poll', code, role: 'guest' })
  ok(guestPoll1.msgs.some((m: any) => m.t === 'relay' && m.payload?.t === 'welcome'), '房主→客机 relay 送达', JSON.stringify(guestPoll1))

  // 8. 排他性：客机 poll 后信箱已清空（不应重复收到）
  const guestPoll2 = await post({ t: 'poll', code, role: 'guest' })
  ok(guestPoll2.ok && guestPoll2.msgs.length === 0, 'poll 取走后信箱清空', JSON.stringify(guestPoll2))

  // 9. rooms：房间已满
  const rooms2 = await post({ t: 'rooms' })
  const mine2 = (rooms2.rooms || []).find((r: any) => r.code === code)
  ok(mine2 && mine2.status === 'full' && mine2.guests === 1, 'rooms 满员状态', JSON.stringify(mine2))

  // 10. 第三人加入被拒
  const third = await post({ t: 'join', code, name: '第三人' })
  ok(third.ok === false, '第三人加入被拒', JSON.stringify(third))

  // 11. 错误房间码加入被拒
  const bad = await post({ t: 'join', code: 'ZZZZ', name: '路人' })
  ok(bad.ok === false, '不存在的房间码被拒', JSON.stringify(bad))

  // 12. 客机 leave → 房主 poll 收到 peer-left，房间重新开放
  await post({ t: 'leave', code, role: 'guest' })
  const hostPoll3 = await post({ t: 'poll', code, role: 'host' })
  ok(hostPoll3.msgs.some((m: any) => m.t === 'peer-left'), '客机离开后房主收到 peer-left', JSON.stringify(hostPoll3))
  const rooms3 = await post({ t: 'rooms' })
  const mine3 = (rooms3.rooms || []).find((r: any) => r.code === code)
  ok(mine3 && mine3.status === 'open', '客机离开后房间重新开放', JSON.stringify(mine3))

  // 13. 房主 leave → 房间销毁 → 客机视角（如有滞留者）poll 得到 peer-left
  //     先让一个新客机加入，再让房主离开
  const rejoin = await post({ t: 'join', code, name: '新客机' })
  ok(rejoin.ok === true, '房间重新开放后可再加入', JSON.stringify(rejoin))
  await post({ t: 'leave', code, role: 'host' })
  const guestPoll3 = await post({ t: 'poll', code, role: 'guest' })
  ok(guestPoll3.ok && guestPoll3.msgs.some((m: any) => m.t === 'peer-left' && m.reason === '房间已关闭'), '房主离开后客机 poll 得到 peer-left(房间已关闭)', JSON.stringify(guestPoll3))
  const rooms4 = await post({ t: 'rooms' })
  ok(!(rooms4.rooms || []).some((r: any) => r.code === code), '房主离开后房间从列表移除', JSON.stringify(rooms4))

  // 14. 大容量 relay（快照可能上百KB）
  const bigCreated = await post({ t: 'create', name: '大房主' })
  const bigCode = bigCreated.code
  await post({ t: 'join', code: bigCode, name: '大客机' })
  const bigPayload = { t: 'snap', run: { pad: 'x'.repeat(180000) }, select: null, busy: false, endBanner: null, toast: null }
  const t0 = Date.now()
  const bigSend = await post({ t: 'relay', code: bigCode, role: 'host', payload: bigPayload }, 20000)
  ok(bigSend.ok === true, `180KB 快照 relay 发送成功 (${Date.now() - t0}ms)`, JSON.stringify(bigSend))
  const bigPoll = await post({ t: 'poll', code: bigCode, role: 'guest' }, 20000)
  ok(bigPoll.msgs.some((m: any) => m.t === 'relay' && m.payload?.run?.pad?.length === 180000), '180KB 快照完整送达')
  await post({ t: 'leave', code: bigCode, role: 'host' })
  await post({ t: 'leave', code: bigCode, role: 'guest' })

  // 15. OPTIONS 预检（CORS：跨域 standalone 版本需要）
  const opt = await fetch(BASE, { method: 'OPTIONS' })
  ok(opt.status === 204 && (opt.headers.get('access-control-allow-origin') === '*' || opt.headers.get('Access-Control-Allow-Origin') === '*'), 'OPTIONS 预检 204 + CORS *', `status=${opt.status} cors=${opt.headers.get('access-control-allow-origin')}`)

  console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('测试异常:', e); process.exit(1) })
