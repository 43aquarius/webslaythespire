// 第三十批测试：检视屏 PC 原版化（SingleCardViewPopup 复刻）
// 素材（scv 36张框架 + scvart 225张高清插画）+ 1024画布大卡 DOM + 布局字号 +
// 升级查看（原版语义：默认false/翻页保留/诅咒状态隐藏）+ 翻页箭头 + tips + 关闭
// 用法: npx tsx scripts/test_batch30.ts [next|standalone]
import { execFileSync } from 'child_process'
import { mkdirSync } from 'fs'

const MODE = (process.argv[2] === 'standalone') ? 'standalone' : 'next'
const URL = MODE === 'next' ? 'http://localhost:3000/' : 'file:///home/z/my-project/download/slay-the-spire-standalone.html'
const SHOT = '/home/z/my-project/scripts/study/batch30'
mkdirSync(SHOT, { recursive: true })
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
  try { return JSON.parse(r) } catch { return { err: String(r).slice(0, 400) } }
}
let pass = 0, fail = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${detail}`) }
}
async function waitFor(expr: string, tries = 14, ms = 500): Promise<any> {
  for (let i = 0; i < tries; i++) {
    const v = ev(expr)
    if (v && v !== 'null' && v !== 'undefined' && v !== false) return v
    await sleep(ms)
  }
  return null
}

// 素材断言按模式分（next=HTTP / standalone=ASSETS data URI 全等）
const SRC = (key: string) => MODE === 'next'
  ? `(document.querySelector('[data-scv="${key}"]')||{}).src || ''`
  : `(() => { const el = document.querySelector('[data-scv="${key}"]'); const A = window.ASSETS || {}; return (el && A['REPLACE_KEY'] && el.src === A['REPLACE_KEY']) ? el.src : (el ? '' : 'MISSING_EL') })()`

async function main() {
  console.log(`== 第三十批测试 [${MODE}] ==`)
  cli(['open', URL])
  await sleep(3500)
  for (let i = 0; i < 15; i++) {
    if (ev(`typeof window.__sts === 'function'`) === true) break
    await sleep(800)
  }
  check('store就绪', ev(`typeof window.__sts === 'function'`) === true)

  // ===== A. 素材资产 =====
  console.log('-- A. 素材 --')
  const SCV_FILES = ['bgAttackRed', 'bgSkillRed', 'bgPowerRed', 'bgSkillCurse', 'bgSkillColorless',
    'bgAttackBlue', 'bgSkillGreen', 'bgPowerPurple',
    'frameAttackCommon', 'frameSkillUncommon', 'framePowerRare',
    'bannerCommon', 'bannerRare', 'orbRed', 'orbGreen', 'orbBlue', 'orbPurple', 'orbColorless',
    'arrow', 'checkbox', 'tick']
  // scvart 抽样：普通卡 + 全部 16 张特殊映射卡
  const ART_SAMPLE = ['strike', 'bash', 'defend', 'regret', 'injury', 'doubt', 'wound', 'dazed', 'burn', 'slimed', 'void',
    'thunderclap', 'dropkick', 'cripplingCloud', 'sweepBeam', 'hyperbeam', 'multiCast', 'consecration', 'crushJoint']
  if (MODE === 'next') {
    const res = evJson(`(async () => { const out = {}; for (const k of ${JSON.stringify(SCV_FILES)}) { const r = await fetch('/assets/scv/' + k + '.webp'); out[k] = r.status } for (const k of ${JSON.stringify(ART_SAMPLE)}) { const r = await fetch('/assets/scvart/' + k + '.webp'); out['art/' + k] = r.status } return out })()`)
    const bad = Object.entries(res).filter(([, s]) => s !== 200)
    check(`A1 scv框架21张+插画抽样19张 HTTP 200`, bad.length === 0, JSON.stringify(bad.slice(0, 5)))
  } else {
    const res = evJson(`(() => { const A = window.ASSETS || {}; const out = {}; for (const k of ${JSON.stringify(SCV_FILES)}) out[k] = !!A['scv/' + k + '.webp']; for (const k of ${JSON.stringify(ART_SAMPLE)}) out['art/' + k] = !!A['scvart/' + k + '.webp']; return out })()`)
    const bad = Object.entries(res).filter(([, v]) => v !== true)
    check(`A1 scv框架21张+插画抽样19张 内联`, bad.length === 0, JSON.stringify(bad.slice(0, 5)))
  }
  // webp 魔法头（抽验 next 版 HTTP body；standalone data URI 前缀）
  if (MODE === 'next') {
    const head = evJson(`(async () => { const r = await fetch('/assets/scv/bgSkillRed.webp'); const b = new Uint8Array(await r.arrayBuffer()); return [b[0], b[1]] })()`)
    check('A2 webp 魔法头 RIFF', Array.isArray(head) && head[0] === 82 && head[1] === 73, JSON.stringify(head))
  } else {
    const head = ev(`(() => { const s = (window.ASSETS||{})['scv/bgSkillRed.webp']||''; return s.slice(0,30) })()`)
    check('A2 data URI image/webp', typeof head === 'string' && head.startsWith('data:image/webp;base64,UklGR'), String(head).slice(0, 40))
  }

  // ===== B. 检视屏打开与结构 =====
  console.log('-- B. 打开与结构 --')
  ev(`window.__sts.getState().startRun('ironclad')`)
  await waitFor(`!!window.__sts.getState().run`)
  // 注入测试牌组：strike / bash / regret(诅咒) / offering(消耗)
  ev(`(() => { const st = window.__sts.getState(); const r = JSON.parse(JSON.stringify(st.run)); r.deck = [
    {uid:'t30a', id:'strike', upgraded:0}, {uid:'t30b', id:'bash', upgraded:0},
    {uid:'t30c', id:'regret', upgraded:0}, {uid:'t30d', id:'offering', upgraded:0}];
    if (r.players?.[0]) r.players[0].deck = r.deck;
    r.screen = 'map'; window.__sts.setState({ run: r }); return 'ok' })()`)
  ev(`window.__sts.getState().openPile('deck')`)
  await waitFor(`!!document.querySelector('[title*="检视"]')`)
  check('B1 牌堆网格出现', ev(`!!document.querySelector('[title*="检视"]')`) === true)
  // 点击第一张卡（strike）
  cli(['click', '[title*="检视"]'])
  await waitFor(`!!document.querySelector('.scv-backdrop')`)
  check('B2 检视层打开（背板+大卡）', ev(`!!document.querySelector('.scv-backdrop') && !!document.querySelector('.scv-card')`) === true)
  const structure = evJson(`(() => {
    const q = (s) => document.querySelector(s)
    const card = q('.scv-card')
    // offsetWidth 是无变换布局尺寸（getBoundingClientRect 含舞台 scale —— 第二十五批教训）
    const w = card.offsetWidth, h = card.offsetHeight
    return {
      w, h,
      bg: !!q('[data-scv=bg]'), art: !!q('[data-scv=art]'), frame: !!q('[data-scv=frame]'),
      banner: !!q('[data-scv=banner]'), orb: !!q('[data-scv=orb]'),
      name: (q('[data-scv=name]')||{}).textContent, type: (q('[data-scv=type]')||{}).textContent,
      cost: (q('[data-scv=cost]')||{}).textContent,
      artLoaded: (q('[data-scv=art]')||{}).naturalWidth > 0,
    }
  })()`)
  check('B3 大卡 1024画布 853×853', structure.w === 853 && structure.h === 853, JSON.stringify({ w: structure.w, h: structure.h }))
  check('B4 图层齐全(bg/art/frame/banner/orb)', structure.bg && structure.art && structure.frame && structure.banner && structure.orb, JSON.stringify(structure))
  check('B5 高清插画加载成功', structure.artLoaded === true, JSON.stringify(structure))
  check('B6 strike 名称/类型/费用', structure.name === '打击' && structure.type === '攻击' && structure.cost === '1', JSON.stringify(structure))
  // 素材映射：strike = red attack common
  const bgSrc = ev(`(${SRC('bg')})`.replace(/REPLACE_KEY/g, "scv/bgAttackRed.webp"))
  const frameSrc = ev(`(${SRC('frame')})`.replace(/REPLACE_KEY/g, "scv/frameAttackCommon.webp"))
  check('B7 bg=bgAttackRed (red/attack)', typeof bgSrc === 'string' && bgSrc.length > 10, String(bgSrc).slice(0, 60))
  check('B8 frame=frameAttackCommon (starter→common)', typeof frameSrc === 'string' && frameSrc.length > 10, String(frameSrc).slice(0, 60))

  // ===== C. 布局与字号（原版 46/48/34/76 ×5/6） =====
  console.log('-- C. 布局与字号 --')
  const layout = evJson(`(() => {
    const q = (s) => document.querySelector(s)
    const gs = (el) => el ? getComputedStyle(el) : null
    const name = gs(q('[data-scv=name]')), type = gs(q('[data-scv=type] .sts-body')), desc = gs(q('[data-scv=desc]')), cost = gs(q('[data-scv=cost]'))
    const nr = q('[data-scv=name]') ? q('[data-scv=name]').getBoundingClientRect() : null
    const tr = q('[data-scv=type]') ? q('[data-scv=type]').getBoundingClientRect() : null
    const card = q('.scv-card') ? q('.scv-card').getBoundingClientRect() : null
    return {
      nameFs: name ? parseFloat(name.fontSize) : 0, nameColor: name ? name.color : '',
      typeFs: type ? parseFloat(type.fontSize) : 0, typeColor: type ? type.color : '',
      descFs: desc ? parseFloat(desc.fontSize) : 0, descLhPx: desc ? parseFloat(desc.lineHeight) : 0,
      costFs: cost ? parseFloat(cost.fontSize) : 0,
      nameTopPct: (nr && card) ? ((nr.top - card.top) / card.height) * 100 : -1, typeTopPct: (tr && card) ? ((tr.top - card.top) / card.height) * 100 : -1,
      descText: (q('[data-scv=desc]')||{}).textContent,
    }
  })()`)
  check('C1 卡名字号 38±1（46×5/6）', layout.nameFs >= 37 && layout.nameFs <= 39.5, String(layout.nameFs))
  check('C2 卡名 CREAM #fff6e2', layout.nameColor === 'rgb(255, 246, 226)', layout.nameColor)
  check('C3 类型行字号 28±1（34×5/6）', layout.typeFs >= 27 && layout.typeFs <= 29.5, String(layout.typeFs))
  check('C4 类型行 #595959', layout.typeColor === 'rgb(89, 89, 89)', layout.typeColor)
  check('C5 描述字号 40±1（48×5/6）行距比~1.07', layout.descFs >= 39 && layout.descFs <= 41 && Math.abs(layout.descLhPx / layout.descFs - 1.07) < 0.02, JSON.stringify({ fs: layout.descFs, lh: layout.descLhPx }))
  check('C6 能量数字字号 63±1.5（76×5/6）', layout.costFs >= 61.5 && layout.costFs <= 65, String(layout.costFs))
  check('C7 卡名@17%（banner带）类型行@53.9%（插画窗底缘）', Math.abs(layout.nameTopPct - 14.6) < 1.5 && Math.abs(layout.typeTopPct - 53.5) < 1.5, JSON.stringify({ n: layout.nameTopPct.toFixed(1), t: layout.typeTopPct.toFixed(1) }))
  check('C8 描述数值（strike 6 伤害）', (layout.descText || '').includes('6'), layout.descText)

  // ===== D. 升级查看（原版 isViewingUpgrade 语义） =====
  console.log('-- D. 升级查看 --')
  check('D1 默认未勾选（卡名非绿）', ev(`getComputedStyle(document.querySelector('[data-scv=name]')).color`) === 'rgb(255, 246, 226)')
  check('D2 升级按钮存在（strike 可升级）', ev(`!!document.querySelector('.scv-upgrade-toggle')`) === true)
  cli(['click', '.scv-upgrade-toggle'])
  await sleep(600)
  const upgraded = evJson(`(() => {
    const q = (s) => document.querySelector(s)
    return {
      nameColor: getComputedStyle(q('[data-scv=name]')).color,
      descText: (q('[data-scv=desc]')||{}).textContent,
      greenSeg: !!q('[data-scv=desc] span[style*="color"]'),
      greenColor: q('[data-scv=desc] span[style*="color"]') ? getComputedStyle(q('[data-scv=desc] span[style*="color"]')).color : '',
      tick: !!q('.scv-tick-img'),
    }
  })()`)
  check('D3 勾选后卡名绿 #7fff00', upgraded.nameColor === 'rgb(127, 255, 0)', upgraded.nameColor)
  check('D4 升级数值显示（strike 9）+ 绿色 span', (upgraded.descText || '').includes('9') && upgraded.greenSeg && upgraded.greenColor === 'rgb(127, 255, 0)', JSON.stringify(upgraded))
  check('D5 TICK 图出现', upgraded.tick === true)

  // ===== E. 翻页箭头（原版 POPUP_ARROW；翻页保留 isViewingUpgrade） =====
  console.log('-- E. 翻页 --')
  const arrows0 = evJson(`(() => { const l = document.querySelectorAll('.scv-arrow:not(.scv-arrow-next)').length; const r = document.querySelectorAll('.scv-arrow-next').length; const el = document.querySelector('.scv-arrow img'); return { left: l, right: r, arrowImgLoaded: el ? el.naturalWidth > 0 : false } })()`)
  check('E1 首卡：无左箭头/有右箭头/素材加载', arrows0.left === 0 && arrows0.right === 1 && arrows0.arrowImgLoaded, JSON.stringify(arrows0))
  cli(['click', '.scv-arrow-next'])
  await sleep(700)
  const page2 = evJson(`(() => { const name = document.querySelector('[data-scv=name]'); return {
    name: name.textContent, nameColor: getComputedStyle(name).color,
    left: document.querySelectorAll('.scv-arrow:not(.scv-arrow-next)').length,
    desc: document.querySelector('[data-scv=desc]').textContent } })()`)
  check('E2 翻到 bash', page2.name === '痛击', page2.name)
  check('E3 翻页保留勾选（卡名仍绿，原版 tmp 传递）', page2.nameColor === 'rgb(127, 255, 0)', page2.nameColor)
  check('E4 bash 升级数值 10（8+2）绿', (page2.desc || '').includes('10'), page2.desc)
  // 翻到 regret（诅咒卡）
  cli(['click', '.scv-arrow-next'])
  await sleep(700)
  const regretState = evJson(`(() => { const q = (s) => document.querySelector(s); return {
    name: q('[data-scv=name]').textContent,
    toggle: !!q('.scv-upgrade-toggle'),
    bg: (q('[data-scv=bg]').src || '').slice(0, 300),
    orb: !!q('[data-scv=orb]') } })()`)
  check('E5 regret 诅咒卡无升级按钮（allowUpgradePreview）', regretState.name === '懊悔' && regretState.toggle === false, JSON.stringify({ name: regretState.name, toggle: regretState.toggle }))
  const isCurseBg = MODE === 'next'
    ? (regretState.bg || '').includes('bgSkillCurse')
    : (regretState.bg || '') !== '' && ev(`(() => { const el = document.querySelector('[data-scv=bg]'); return el && el.src === ((window.ASSETS||{})['scv/bgSkillCurse.webp']||'') })()`) === true
  check('E6 诅咒底板 bgSkillCurse', isCurseBg, regretState.bg.slice(0, 80))
  check('E7 诅咒卡无能量球（cost -99）', regretState.orb === false)
  // 翻到 offering（消耗 → tips）
  cli(['click', '.scv-arrow-next'])
  await sleep(700)
  const tipsState = evJson(`(() => { const q = (s) => document.querySelector(s); return {
    name: q('[data-scv=name]').textContent,
    tips: !!q('.scv-tips'), tipCount: document.querySelectorAll('.scv-tip').length,
    tipText: q('.scv-tip') ? q('.scv-tip').textContent.slice(0, 40) : '' } })()`)
  check('E8 offering 关键词 tips 出现（消耗）', tipsState.name === '献祭' && tipsState.tips && tipsState.tipCount >= 1, JSON.stringify(tipsState))

  // ===== F. 关闭（点击背板 + Esc） =====
  console.log('-- F. 关闭 --')
  ev(`document.querySelector('.scv-backdrop').click()`)
  await sleep(500)
  check('F1 点击背板关闭', ev(`!document.querySelector('.scv-backdrop') && !!document.querySelector('[title*="检视"]')`) === true)
  ev(`document.querySelector('[title*="检视"]').click()`)
  await waitFor(`!!document.querySelector('.scv-backdrop')`)
  ev(`(() => { const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }); window.dispatchEvent(e); return 'ok' })()`)
  await sleep(500)
  const escClosed = MODE === 'next'
    ? ev(`!document.querySelector('.scv-backdrop')`)
    : ev(`!document.querySelector('.scv-backdrop')`)
  check('F2 Esc 关闭（重开后）', escClosed === true)

  // ===== G. 截图存档 =====
  ev(`document.querySelector('[title*="检视"]').click()`)
  await waitFor(`!!document.querySelector('.scv-backdrop')`)
  ev(`document.querySelector('.scv-upgrade-toggle').click()`)
  await sleep(800)
  cli(['screenshot', `${SHOT}/scv_${MODE}.png`])
  console.log(`  截图: ${SHOT}/scv_${MODE}.png`)

  console.log(`\n== 结果: ${pass} 通过, ${fail} 失败 ==`)
  if (fail > 0) process.exit(1)
}

main().catch(e => { console.error('FATAL', e); process.exit(1) })
