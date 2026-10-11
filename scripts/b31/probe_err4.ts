import { execFileSync } from 'child_process'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
function cli(args: string[]) { return execFileSync('agent-browser', args, { encoding: 'utf8', timeout: 90000 }) }
async function main() {
  try { cli(['close']) } catch {}
  cli(['open', 'about:blank'])
  try { cli(['console', '--clear']) } catch {}
  cli(['open', 'http://localhost:3100/'])
  await sleep(7000)
  console.log('=== console ===')
  console.log(cli(['console']).slice(0, 4000))
  execFileSync('agent-browser', ['close'], { encoding: 'utf8' })
}
main()
