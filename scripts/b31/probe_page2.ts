import { execFileSync } from 'child_process'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
function cli(args: string[]) { return execFileSync('agent-browser', args, { encoding: 'utf8', timeout: 90000 }) }
function ev(code: string): any {
  try { return JSON.parse(cli(['eval', code])) } catch (e: any) { return { ERR: String(e.stdout || e.message).slice(0, 200) } }
}
async function main() {
  try { cli(['close']) } catch {}
  cli(['open', 'http://localhost:3100/'])
  await sleep(5000)
  for (let i = 0; i < 30; i++) {
    const r = ev(`(() => ({ ready: typeof window.__sts, body: document.body ? document.body.innerText.slice(0, 60) : null }))()`)
    if (r && r.ready === 'function') { console.log('READY ok'); break }
    if (i === 4 || i === 29) console.log('probe', i, JSON.stringify(r))
    await sleep(1000)
  }
  execFileSync('agent-browser', ['close'], { encoding: 'utf8' })
}
main()
