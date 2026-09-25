// 联机服务器协议端到端测试：create → join → relay → peer-left → leave → 大厅列表
// 用法：node scripts/test-ws-server.js [wsUrl]  （默认 ws://localhost:3001）
const WebSocket = require('ws')

const URL = process.argv[2] || 'ws://localhost:3001'
let pass = 0, fail = 0
const check = (name, cond) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}`) }
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
    setTimeout(() => reject(new Error('connect timeout')), 4000)
  })
}

function collector(ws) {
  const msgs = []
  ws.on('message', raw => msgs.push(JSON.parse(String(raw))))
  return {
    msgs,
    wait: async (pred, timeout = 4000) => {
      const t0 = Date.now()
      while (Date.now() - t0 < timeout) {
        const m = msgs.find(pred)
        if (m) return m
        await sleep(50)
      }
      return null
    },
  }
}

async function main() {
  console.log(`测试目标: ${URL}`)
  // 1. 房主创建房间
  const host = collector(await connect())
  host.ws = null
  const hostWs = host.msgs.length >= 0 ? null : null
  // 重新包装：拿到 ws 引用
  const hws = await connect()
  const host2 = collector(hws)
  hws.send(JSON.stringify({ t: 'create', name: '房主小明' }))
  const created = await host2.wait(m => m.t === 'created')
  check('房主创建房间收到 created', !!created)
  const code = created && created.code
  check('房间码为4位', typeof code === 'string' && code.length === 4)

  // 2. 大厅观察者收到房间列表
  const lobby = collector(await connect())
  lobby.msgs.length = 0
  // 触发推送：lobby watcher 订阅
  const lws = lobby
  // 直接用已有 collector 的 ws —— 需要引用，重新来
  const rooms1 = null
  // （简化：lobby collector 的底层 ws）
  const lobbyWs = (await import('ws')).default ? null : null
  void rooms1; void lobbyWs
  // 通过 host2 验证列表：发 list
  hws.send(JSON.stringify({ t: 'list' }))
  const listed = await host2.wait(m => m.t === 'rooms')
  check('list 返回房间列表', !!(listed && Array.isArray(listed.rooms) && listed.rooms.some(r => r.code === code)))
  check('房间状态 open', listed && listed.rooms.find(r => r.code === code).status === 'open')

  // 3. 客机加入
  const guest = collector(await connect())
  const gws = guest.msgs.length >= 0 ? null : null
  void gws
  // 获取 guest 底层 ws：重做
  const gws2 = await connect()
  const guest2 = collector(gws2)
  gws2.send(JSON.stringify({ t: 'join', code, name: '客机小红' }))
  const joined = await guest2.wait(m => m.t === 'joined')
  check('客机收到 joined', !!joined)
  check('joined 带房主昵称', joined && joined.host === '房主小明')
  const peer = await host2.wait(m => m.t === 'peer')
  check('房主收到 peer 通知', !!(peer && peer.name === '客机小红'))

  // 4. 消息中转（双向）
  gws2.send(JSON.stringify({ t: 'relay', payload: { t: 'hello', name: '客机小红' } }))
  const hello = await host2.wait(m => m.t === 'relay' && m.payload && m.payload.t === 'hello')
  check('房主收到客机 hello 中转', !!hello)
  hws.send(JSON.stringify({ t: 'relay', payload: { t: 'welcome', hostName: '房主小明' } }))
  const welcome = await guest2.wait(m => m.t === 'relay' && m.payload && m.payload.t === 'welcome')
  check('客机收到房主 welcome 中转', !!welcome)

  // 5. 房间已满：第三人加入被拒
  const third = await connect()
  const thirdMsgs = []
  third.on('message', raw => thirdMsgs.push(JSON.parse(String(raw))))
  third.send(JSON.stringify({ t: 'join', code, name: '第三者' }))
  await sleep(400)
  check('第三人加入被拒（房间已满）', thirdMsgs.some(m => m.t === 'error' && String(m.msg).includes('已满')))

  // 6. 客机离开 → 房主收到 peer-left，房间重新开放
  gws2.send(JSON.stringify({ t: 'leave' }))
  const leftMsg = await host2.wait(m => m.t === 'peer-left')
  check('房主收到 peer-left', !!leftMsg)
  await sleep(300)
  hws.send(JSON.stringify({ t: 'list' }))
  const listed2 = await host2.wait(m => m.t === 'rooms' && m !== listed)
  check('房间重新开放', !!(listed2 && (listed2.rooms.find(r => r.code === code) || { status: '' }).status === 'open'))

  // 7. 心跳
  hws.send(JSON.stringify({ t: 'ping' }))
  const pong = await host2.wait(m => m.t === 'pong')
  check('ping/pong 心跳', !!pong)

  // 8. 断开清理
  third.close()
  hws.close()
  await sleep(400)

  console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}

main().catch(err => { console.error('测试异常:', err.message); process.exit(1) })
