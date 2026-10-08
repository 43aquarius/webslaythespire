// 调试 INSP_CHECK eval 失败原因
import { execFileSync } from 'child_process'

const INSP_CHECK = `(() => {
  const root = document.querySelector('.sts-inspect-backdrop')?.parentElement
  if (!root) return { exists: false }
  const card = root.querySelector('.sts-inspect-card-in, [class*=sts-inspect-nav]')
  const arrows = [...root.querySelectorAll('.sts-inspect-arrow')]
  const tick = root.querySelector('.sts-inspect-tick')
  const counter = [...root.querySelectorAll('div')].map(d => d.textContent).find(t => /^[0-9]+ \/ [0-9]+$/.test(t || '')) || ''
  const stage = document.querySelector('[data-stage]')
  const scale = stage ? stage.getBoundingClientRect().width / 1600 : 1
  return {
    exists: true,
    backstop: getComputedStyle(document.querySelector('.sts-inspect-backdrop')).backgroundColor,
    arrows: arrows.length, arrowSvg: arrows[0] ? arrows[0].querySelector('svg') !== null : false,
    tick: tick !== null, counter,
    cardAnimCls: card ? card.className : '',
    bigCardW: card ? card.getBoundingClientRect().width / scale : 0,
  }
})()`

console.log('--- 代码长度:', INSP_CHECK.length)
try {
  const out = execFileSync('agent-browser', ['eval', INSP_CHECK, '--json'], { encoding: 'utf-8', timeout: 60000 })
  console.log('OK:', out.slice(0, 300))
} catch (e: any) {
  console.log('FAIL:', (e.stdout || e.message || '').slice(0, 500))
}

// 分段定位
const parts = [
  `document.querySelector('.sts-inspect-backdrop')?.parentElement ? 1 : 2`,
  `(() => { const root = document.querySelector('.sts-inspect-backdrop')?.parentElement; if (!root) return { exists: false }; return { exists: true } })()`,
  `(() => { const t = '1 / 10'; return [...document.querySelectorAll('div')].map(d => d.textContent).find(x => /^[0-9]+ \\/ [0-9]+$/.test(x || '')) || 'none' } )()`,
  `(() => {
    const root = document.querySelector('.sts-inspect-backdrop')?.parentElement
    if (!root) return { exists: false }
    const card = root.querySelector('.sts-inspect-card-in, [class*=sts-inspect-nav]')
    return { cls: card ? card.className : '' }
  })()`,
]
for (let i = 0; i < parts.length; i++) {
  try {
    const out = execFileSync('agent-browser', ['eval', parts[i], '--json'], { encoding: 'utf-8', timeout: 30000 })
    console.log(`part${i} OK:`, out.slice(0, 150))
  } catch (e: any) {
    console.log(`part${i} FAIL:`, (e.stdout || e.message || '').slice(0, 300))
  }
}
