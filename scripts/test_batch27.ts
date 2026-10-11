// 第二十七批测试：敌人 idle 原版动画 WebP（资产层 + 战斗 DOM + 动画运行证据 + 旧模拟浮动弃用）
// 断言基准：反编译 java loadAnimation/setAnimation 权威映射（50 Spine 动画 + bronzeOrb/hexaghost 原版静态）
// 用法: npx tsx scripts/test_batch27.ts [next|standalone]
import { execFileSync } from 'child_process'
import * as fs from 'fs'

const MODE = (process.argv[2] === 'standalone') ? 'standalone' : 'next'
const URL = MODE === 'next' ? 'http://localhost:3000/' : 'file:///home/z/my-project/download/slay-the-spire-standalone.html'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
function cli(args: string[]): string {
  try { return execFileSync('agent-browser', args, { encoding: 'utf-8', timeout: 60000 }) }
  catch (e: any) { return 'ERR:' + (e.stdout || e.message || '').slice(0, 200) }
}
function ev(code: string): any {
  try {
    const out = execFileSync('agent-browser', ['eval', code, '--json'], { encoding: 'utf-8', timeout: 60000 })
    const j = JSON.parse(out)
    return j?.data?.result ?? j?.data ?? ''
  } catch (e: any) { return 'ERR:' + (e.stdout || e.message || '').slice(0, 300) }
}
function evJson(code: string): any {
  const r = ev(code)
  if (r !== null && typeof r === 'object') return r
  try { return JSON.parse(r) } catch { return { err: String(r).slice(0, 500) } }
}
let pass = 0, fail = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${detail}`) }
}
const ENEMIES = [
  'acidslimeM', 'acidslimeS', 'awakenedOne', 'blueSlaver', 'bookOfStabbing', 'bronzeAutomaton',
  'bronzeOrb', 'byrd', 'centurion', 'chosen', 'corruptHeart', 'cultist', 'dagger', 'darkling',
  'deca', 'donu', 'fatGremlin', 'fungibeast', 'giantHead', 'greenlouse', 'gremlinLeader',
  'gremlinWizard', 'guardian', 'hexaghost', 'jawworm', 'lagavulin', 'madGremlin', 'mystic',
  'nemesis', 'nob', 'orbWalker', 'redSlaver', 'redlouse', 'reptomancer', 'repulsor', 'sentry',
  'shieldGremlin', 'slimeboss', 'sneakyGremlin', 'sphericGuardian', 'spikeSlimeM', 'spikeSlimeS',
  'spiker', 'spireGrowth', 'spireShield', 'spireSpear', 'taskmaster', 'theChamp', 'theCollector',
  'timeEater', 'transient', 'writhingMass',
]
const STATIC = ['bronzeOrb', 'hexaghost']  // 原版无动画（AbstractMonster 静态 img）
const ENEMY_IMG = MODE === 'next'
  ? `[...document.querySelectorAll('img')].filter(i => (i.src||'').includes('enemies/'))`
  : `[...document.querySelectorAll('.sprite img')].filter(i => (i.src||'').startsWith('data:image/webp'))`

async function main() {
  console.log(`== 第二十七批测试 [${MODE}] ==`)
  cli(['open', URL])
  await sleep(3500)
  for (let i = 0; i < 12; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(800)
  }
  check('store就绪', ev(`typeof window.__sts === 'function'`) === true)

  // ===== A. 资产层 =====
  console.log('-- A. 资产层（52 敌 WebP） --')
  if (MODE === 'next') {
    const r = evJson(`(async () => {
      const names = ${JSON.stringify(ENEMIES)}
      const out = { ok: 0, bad: [], anim: 0, staticOk: 0, png404: null }
      for (const n of names) {
        const res = await fetch('/assets/enemies/' + n + '.webp')
        if (!res.ok) { out.bad.push(n); continue }
        const ct = res.headers.get('content-type') || ''
        if (!ct.includes('image/webp')) { out.bad.push(n + ':mime:' + ct); continue }
        const buf = new Uint8Array(await res.arrayBuffer())
        const head = String.fromCharCode(...buf.slice(0, 4)) + String.fromCharCode(...buf.slice(8, 12))
        if (head !== 'RIFFWEBP') { out.bad.push(n + ':head'); continue }
        out.ok++
        let hasAnim = false
        for (let i = 0; i < buf.length - 4; i++) {
          if (buf[i] === 65 && buf[i+1] === 78 && buf[i+2] === 73 && buf[i+3] === 77) { hasAnim = true; break }
        }
        if (hasAnim && !${JSON.stringify(STATIC)}.includes(n)) out.anim++
      }
      const png = await fetch('/assets/enemies/cultist.png')
      out.png404 = !png.ok
      return out
    })()`)
    check('A1 52 WebP 可达且 MIME/RIFF/WEBP 头正确', r.ok === 52, JSON.stringify(r.bad || r.err || '').slice(0, 200))
    check('A2 50 个含 ANIM 动图 chunk', r.anim === 50, `anim=${r.anim}`)
    check('A3 旧静态 png 已 404', r.png404 === true)
  } else {
    const r = evJson(`(() => {
      const names = ${JSON.stringify(ENEMIES)}
      const out = { ok: 0, bad: [], anim: 0, pngKeys: 0 }
      for (const n of names) {
        const v = window.ASSETS && window.ASSETS['enemies/' + n + '.webp']
        if (!v || !v.startsWith('data:image/webp;base64,') || v.length < 200) { out.bad.push(n); continue }
        out.ok++
        if (!${JSON.stringify(STATIC)}.includes(n)) {
          const bin = atob(v.split(',')[1])
          if (bin.includes('ANIM') && bin.includes('ANMF')) out.anim++
        }
      }
      out.pngKeys = Object.keys(window.ASSETS || {}).filter(k => k.startsWith('enemies/') && k.endsWith('.png')).length
      return out
    })()`)
    check('A1 52 WebP 内联键 data:image/webp', r.ok === 52, JSON.stringify(r.bad || r.err || '').slice(0, 200))
    check('A2 50 个含 ANIM/ANMF 动图 chunk', r.anim === 50, `anim=${r.anim}`)
    check('A3 旧静态 png 键已清零', r.pngKeys === 0, `pngKeys=${r.pngKeys}`)
  }

  // ===== B. 战斗 DOM =====
  console.log('-- B. 战斗内敌人精灵图 --')
  ev(`(() => { const g = window.__sts.getState(); g.startRun('ironclad'); const r = JSON.parse(JSON.stringify(g.getState().run)); r.screen = 'map'; window.__sts.setState({ run: r }); return 'ok' })()`)
  await sleep(2400)
  const entered = ev(`(() => {
    const g = window.__sts.getState(), r = g.run
    const reach = r.currentNodeId ? r.map.nodes[r.currentNodeId].edges : r.map.startNodes
    const n = reach.map(id => r.map.nodes[id]).find(n => n.type === 'monster') || reach.map(id => r.map.nodes[id]).find(n => n.type !== 'boss')
    if (!n) return 'nonode'
    g.chooseNode(n.id)
    return 'ok'
  })()`)
  check('B0 进入战斗', String(entered).startsWith('ok'), String(entered))
  let imgsReady = false
  const readySel = MODE === 'next'
    ? `document.querySelectorAll('img').length > 0 && [...document.querySelectorAll('img')].some(i => (i.src||'').includes('enemies/'))`
    : `document.querySelectorAll('.sprite img').length > 0`
  for (let i = 0; i < 10; i++) {
    imgsReady = ev(readySel) === true
    if (imgsReady) break
    await sleep(400)
  }
  check('B0b 敌人图挂载', imgsReady)
  const b = evJson(`(() => {
    const imgs = ${ENEMY_IMG}
    const webp = imgs.filter(i => ${MODE === 'next' ? "i.src.endsWith('.webp')" : "i.src.startsWith('data:image/webp')"}).length
    const png = imgs.filter(i => i.src.endsWith('.png')).length
    const loaded = imgs.filter(i => i.naturalWidth > 0 && i.complete).length
    const bob = document.querySelectorAll('.idle-bob, .sts-idle-bob').length
    let animName = ''
    if (imgs[0]) {
      const cs = getComputedStyle(imgs[0])
      animName = cs.animationName
    }
    return { total: imgs.length, webp, png, loaded, bob, animName }
  })()`)
  check('B1 敌人 img 全部 .webp 引用', b.total > 0 && b.webp === b.total, JSON.stringify(b).slice(0, 150))
  check('B2 旧 .png 引用清零', b.png === 0)
  check('B3 图片全部加载成功(naturalWidth>0)', b.loaded === b.total, `loaded=${b.loaded}/${b.total}`)
  check('B4 CSS 模拟浮动(idle-bob)已移除', b.bob === 0 && !String(b.animName).includes('bob'), `bob=${b.bob} anim=${b.animName}`)

  // ===== C. 动画运行证据（双 screenshot 精确裁剪首敌 sprite bbox 像素对比；headless 下 drawImage 不取动图新帧，截图渲染会推进） =====
  console.log('-- C. 动画播放证据 --')
  const box = evJson(`(() => {
    const imgs = ${ENEMY_IMG}
    if (!imgs.length) return null
    const r = imgs[0].getBoundingClientRect()
    return { x: Math.max(0, Math.floor(r.x)), y: Math.max(0, Math.floor(r.y)),
             w: Math.ceil(r.width), h: Math.ceil(r.height) }
  })()`)
  check('C0 首敌精灵 bbox 获取', box && box.w > 20 && box.h > 20, JSON.stringify(box).slice(0, 100))
  fs.mkdirSync('/tmp/anim_pilot', { recursive: true })  // 沙箱重启后 /tmp 清空，截图目录需自建
  cli(['screenshot', '/tmp/anim_pilot/t27_a.png'])
  await sleep(1100)
  cli(['screenshot', '/tmp/anim_pilot/t27_b.png'])
  const cropPy = `
from PIL import Image
import numpy as np, json
box = json.loads(r'''${JSON.stringify(box)}''')
a = np.asarray(Image.open('/tmp/anim_pilot/t27_a.png').convert('RGB'), dtype=np.int16)
b = np.asarray(Image.open('/tmp/anim_pilot/t27_b.png').convert('RGB'), dtype=np.int16)
H, W = a.shape[:2]
x0, y0 = max(0, box['x']), max(0, box['y'])
x1, y1 = min(W, box['x'] + box['w']), min(H, box['y'] + box['h'])
ra = a[y0:y1, x0:x1]; rb = b[y0:y1, x0:x1]
d = np.abs(ra - rb).max(axis=2)
print(int((d > 10).sum()))
`
  const cDiff = ((): any => {
    try {
      const out = execFileSync('python3', ['-c', cropPy], { encoding: 'utf-8' })
      return { changed: parseInt(out.trim(), 10), px: (box?.w || 0) * (box?.h || 0) }
    } catch (e: any) { return { err: (e.stdout || e.message || '').slice(0, 200) } }
  })()
  check('C1 首敌精灵 bbox 双时刻像素变化（动画播放中）', typeof cDiff.changed === 'number' && cDiff.changed > 200, JSON.stringify(cDiff).slice(0, 200))
  const c3 = evJson(`(() => {
    const imgs = ${ENEMY_IMG}
    return { n: imgs.length, webp: imgs.filter(i => ${MODE === 'next' ? "i.src.endsWith('.webp')" : "i.src.startsWith('data:image/webp')"}).length }
  })()`)
  check('C3 战斗内敌人仍为 webp 引用', c3.n > 0 && c3.webp === c3.n, JSON.stringify(c3).slice(0, 100))

  console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
  if (fail > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
