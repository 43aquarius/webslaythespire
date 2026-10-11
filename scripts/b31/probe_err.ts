import { execFileSync } from 'child_process'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
function cli(args: string[]) { return execFileSync('agent-browser', args, { encoding: 'utf8', timeout: 90000 }) }
async function main() {
  try { cli(['close']) } catch {}
  cli(['open', 'http://localhost:3100/'])
  await sleep(7000)
  console.log('=== errors ===')
  console.log(cli(['errors']).slice(0, 2500))
  execFileSync('agent-browser', ['close'], { encoding: 'utf8' })
}
main()
