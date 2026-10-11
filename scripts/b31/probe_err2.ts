import { execFileSync } from 'child_process'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
function cli(args: string[]) { return execFileSync('agent-browser', args, { encoding: 'utf8', timeout: 90000 }) }
async function main() {
  try { cli(['close']) } catch {}
  cli(['open', 'http://localhost:3100/'])
  await sleep(2500)
  console.log('=== console(先抓) ===')
  console.log(cli(['console']).slice(0, 3000))
  await sleep(4000)
  console.log('=== console(后抓) ===')
  console.log(cli(['console', '--clear']).slice(0, 3000))
  execFileSync('agent-browser', ['close'], { encoding: 'utf8' })
}
main()
