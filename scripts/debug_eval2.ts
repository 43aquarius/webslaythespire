// 二分定位 INSP_CHECK 中的问题行
import { execFileSync } from 'child_process'

const LINES = [
  `(() => {`,
  `  const root = document.querySelector('.sts-inspect-backdrop')?.parentElement`,
  `  if (!root) return { exists: false }`,
  `  const card = root.querySelector('.sts-inspect-card-in, [class*=sts-inspect-nav]')`,
  `  const arrows = [...root.querySelectorAll('.sts-inspect-arrow')]`,
  `  const tick = root.querySelector('.sts-inspect-tick')`,
  `  const counter = [...root.querySelectorAll('div')].map(d => d.textContent).find(t => /^[0-9]+ \\/ [0-9]+$/.test(t || '')) || ''`,
  `  const stage = document.querySelector('[data-stage]')`,
  `  const scale = stage ? stage.getBoundingClientRect().width / 1600 : 1`,
  `  return {`,
  `    exists: true,`,
  `    backstop: getComputedStyle(document.querySelector('.sts-inspect-backdrop')).backgroundColor,`,
  `    arrows: arrows.length, arrowSvg: arrows[0] ? arrows[0].querySelector('svg') !== null : false,`,
  `    tick: tick !== null, counter,`,
  `    cardAnimCls: card ? card.className : '',`,
  `    bigCardW: card ? card.getBoundingClientRect().width / scale : 0,`,
  `  }`,
  `})()`,
]

function tryEval(code: string): boolean {
  try {
    const out = execFileSync('agent-browser', ['eval', code, '--json'], { encoding: 'utf-8', timeout: 30000 })
    return !/SyntaxError/.test(out)
  } catch (e: any) {
    return !/SyntaxError/.test(e.stdout || e.message || '')
  }
}

// 逐行累加：找到第一个导致失败的行
let acc = ''
for (let i = 0; i < LINES.length; i++) {
  const candidate = acc + LINES[i] + (i === LINES.length - 1 ? '' : '\n')
  // 包一层 try-catch 防运行时错误干扰判断——只测语法：用 new Function
  const syntaxOnly = `try { new Function(${JSON.stringify(candidate)}) } catch (e) { 'SYNERR:' + e.message }`
  const ok = tryEval(syntaxOnly)
  if (!ok) {
    console.log(`行${i + 1} 引发语法错误:`, LINES[i].slice(0, 80))
    break
  }
  acc = candidate
  console.log(`行${i + 1} OK`)
}
