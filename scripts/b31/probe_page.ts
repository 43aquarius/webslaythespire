import { execFileSync } from 'child_process'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
function ev(code: string): any {
  try { return JSON.parse(execFileSync('agent-browser', ['eval', code], { encoding: 'utf8' })) } catch (e: any) { return { ERR: String(e.stdout || e.message).slice(0, 300) } }
}
async function main() {
  execFileSync('agent-browser', ['open', 'http://localhost:3100/'], { encoding: 'utf8', timeout: 60000 })
  await sleep(5000)
  for (let i = 0; i < 30; i++) {
    const r = ev(`(() => ({ ready: typeof window.__sts, title: document.title, body: document.body ? document.body.innerText.slice(0, 80) : null, hasErr: !!document.querySelector('nextjs-portal') }))()`)
    if (r && !r.ERR && r.ready === 'function') { console.log('READY', JSON.stringify(r)); break }
    if (i === 5 || i === 29) console.log('probe', i, JSON.stringify(r))
    await sleep(1000)
  }
  execFileSync('agent-browser', ['close'], { encoding: 'utf8' })
}
main()
