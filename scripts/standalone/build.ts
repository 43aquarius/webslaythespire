// 单文件版构建脚本
// 1. esbuild 打包游戏逻辑（含 zustand 垫片替换）
// 2. 注入素材 manifest
// 3. 组装最终 HTML
import { build } from 'esbuild'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'

const ROOT = '/home/z/my-project'
const SA = `${ROOT}/scripts/standalone`

async function main() {
  // 1. 打包 JS（game 模块 + store + ui）
  await build({
    entryPoints: [`${SA}/entry.ts`],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    minify: true,
    alias: { zustand: `${SA}/zustandShim.ts` },
    outfile: `${SA}/bundle.js`,
    legalComments: 'none',
    logLevel: 'warning',
  })
  console.log('✓ JS 打包完成')

  // 2. 素材 manifest
  const assets = readFileSync(`${SA}/assets.json`, 'utf-8')
  console.log('✓ 素材清单读取完成')

  // 3. CSS
  const css = readFileSync(`${SA}/style.css`, 'utf-8')

  // 4. 组装 HTML
  const js = readFileSync(`${SA}/bundle.js`, 'utf-8')
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>杀戮尖塔 Web - Slay the Spire 单文件版</title>
<style>
${css}
</style>
</head>
<body>
<div id="app"></div>
<div id="fx-layer"></div>
<div id="toast"></div>
<script>
window.ASSETS = ${assets};
</script>
<script>
${js}
</script>
<script>
// Toast 渲染
(function () {
  const el = document.getElementById('toast')
  let last = null
  setInterval(() => {
    const t = window.__sts && window.__sts.getState().toast
    if (t !== last) {
      last = t
      el.innerHTML = t ? '<div class="sts-panel">' + t + '</div>' : ''
    }
  }, 120)
})()
</script>
</body>
</html>`

  const out1 = `${ROOT}/download/slay-the-spire-standalone.html`
  mkdirSync(`${ROOT}/download`, { recursive: true })
  writeFileSync(out1, html)
  console.log(`✓ 单文件版已生成: ${out1} (${(html.length / 1024 / 1024).toFixed(2)} MB)`)

  // 同时复制到仓库根目录
  const out2 = `${ROOT}/slay-the-spire-standalone.html`
  writeFileSync(out2, html)
  console.log(`✓ 仓库副本: ${out2}`)
}

main().catch(e => { console.error(e); process.exit(1) })
