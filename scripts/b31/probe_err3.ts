import { execFileSync } from 'child_process'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
function cli(args: string[]) { return execFileSync('agent-browser', args, { encoding: 'utf8', timeout: 90000 }) }
function ev(code: string): any {
  try { return JSON.parse(cli(['eval', code])) } catch (e: any) { return { ERR: String(e.stdout || e.message).slice(0, 200) } }
}
async function main() {
  try { cli(['close']) } catch {}
  cli(['open', 'http://localhost:3100/'])
  await sleep(6000)
  // nextjs-portal 内的错误文本
  const out = ev(`(() => {
    const p = document.querySelector('nextjs-portal')
    let overlay = ''
    try { if (p && p.shadowRoot) overlay = p.shadowRoot.textContent || '' } catch (e) { overlay = 'shadow:' + e }
    return { portal: !!p, overlay: overlay.slice(0, 600), body: document.body.innerText.slice(0, 120) }
  })()`)
  console.log(JSON.stringify(out, null, 2).slice(0, 1500))
  execFileSync('agent-browser', ['close'], { encoding: 'utf8' })
}
main()
