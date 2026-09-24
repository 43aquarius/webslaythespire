// 地图生成分析：找出所有结构性 bug
import { execSync } from 'child_process'

const code = execSync('cat src/game/map.ts', { cwd: '/home/z/my-project' }).toString()

// 用 esbuild 快速转译 + 执行
import { build } from 'esbuild'
import { writeFileSync } from 'fs'
writeFileSync('/tmp/map_src.ts', code)
await build({
  entryPoints: ['/tmp/map_src.ts'],
  bundle: true,
  format: 'esm',
  outfile: '/tmp/map_gen.mjs',
  external: [],
})
const { generateMap, MAP_ROWS, MAP_COLS } = await import('/tmp/map_gen.mjs')

const W = 1100, H = 1450 // 保持

function analyze(seed) {
  const map = generateMap(seed)
  const nodes = Object.values(map.nodes)
  const issues = []

  // 1. 不可达节点（从起点 BFS）
  const seen = new Set(map.startNodes)
  const q = [...map.startNodes]
  while (q.length) {
    const id = q.shift()
    const n = map.nodes[id]
    if (!n) continue
    for (const e of n.edges) if (!seen.has(e)) { seen.add(e); q.push(e) }
  }
  const unreachable = nodes.filter(n => !seen.has(n.id))
  if (unreachable.length) issues.push(`不可达节点 ${unreachable.length} 个: ${unreachable.map(n => n.id).join(',')}`)

  // 2. 边指向不存在的节点
  const badEdges = nodes.filter(n => n.edges.some(e => !map.nodes[e]))
  if (badEdges.length) issues.push(`悬空边: ${badEdges.map(n => n.id).join(',')}`)

  // 3. 同一行同列重复节点（不该有，用 id 作 key 天然去重）
  // 4. 节点重叠（同 row 相邻 col 距离 < 节点尺寸）
  // 节点尺寸 48-56px，colW = 1100/8 = 137.5，同行相邻节点不会重叠

  // 5. 边交叉检测（几何相交，不含共享端点）
  const segs = []
  for (const n of nodes) for (const e of n.edges) {
    const t = map.nodes[e]
    if (t) segs.push({ a: n, b: t, key: `${n.id}-${e}` })
  }
  const crossings = []
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const s1 = segs[i], s2 = segs[j]
    if (s1.a.id === s2.a.id || s1.a.id === s2.b.id || s1.b.id === s2.a.id || s1.b.id === s2.b.id) continue
    // 相邻行的边才可能相交
    if (Math.abs(s1.a.row - s2.a.row) > 1) continue
    if (segsIntersect(s1.a, s1.b, s2.a, s2.b)) crossings.push(`${s1.key} ✕ ${s2.key}`)
  }
  if (crossings.length) issues.push(`边交叉 ${crossings.length} 处: ${crossings.slice(0, 5).join(' | ')}`)

  // 6. 边穿过中间节点（A(r,c1)->B(r+1,c3) 穿过 (r+1,c2) 或 (r,c2) 附近）
  const passThrough = []
  for (const s of segs) {
    const dc = Math.abs(s.a.col - s.b.col)
    if (dc < 2) continue
    const lo = Math.min(s.a.col, s.b.col), hi = Math.max(s.a.col, s.b.col)
    for (const n of nodes) {
      if (n.id === s.a.id || n.id === s.b.id) continue
      // 检查同行和下一行的中间列节点是否离线段很近
      if (n.row === s.a.row || n.row === s.b.row) {
        if (n.col > lo && n.col < hi) {
          const d = distToSegment(n, s.a, s.b)
          if (d < 26) passThrough.push(`${s.key} 穿过 ${n.id}(距离${d.toFixed(0)}px)`)
        }
      }
    }
  }
  if (passThrough.length) issues.push(`边穿过节点 ${passThrough.length} 处: ${passThrough.slice(0, 5).join(' | ')}`)

  // 7. 穿过行的边（跨度太大：A 与 B 隔了 >=2 列但中间列在本行有节点）
  // 8. 起始节点数量
  const startCount = map.startNodes.length
  if (startCount < 3) issues.push(`起始节点过少: ${startCount}`)
  if (startCount > 6) issues.push(`起始节点过多: ${startCount}`)

  // 9. 每行节点数
  const rowCount = {}
  for (const n of nodes) rowCount[n.row] = (rowCount[n.row] || 0) + 1
  // StS 每行 2-6 节点
  for (let r = 0; r <= 15; r++) {
    if (r < 15 && (rowCount[r] || 0) > 6) issues.push(`第${r}行节点过多: ${rowCount[r]}`)
  }

  // 10. 孤立子图：从起点能到，但从该节点无法到 Boss
  const bossId = map.bossNodeId
  const revAdj = {}
  for (const n of nodes) for (const e of n.edges) (revAdj[e] ??= []).push(n.id)
  // 从 boss 反向 BFS
  const toBoss = new Set([bossId])
  const q2 = [bossId]
  while (q2.length) {
    const id = q2.shift()
    for (const p of revAdj[id] || []) if (!toBoss.has(p)) { toBoss.add(p); q2.push(p) }
  }
  const deadEnd = nodes.filter(n => !toBoss.has(n.id))
  if (deadEnd.length) issues.push(`无法到达Boss的节点 ${deadEnd.length} 个: ${deadEnd.map(n => n.id).join(',')}`)

  // 11. 节点分布统计（rest/shop/elite 数量）
  const typeCount = {}
  for (const n of nodes) typeCount[n.type] = (typeCount[n.type] || 0) + 1
  if (!issues.length) issues.push('OK')

  return { seed, issues, typeCount, totalNodes: nodes.length, startCount, rowCount }
}

function segsIntersect(p1, p2, p3, p4) {
  function d(a, b, c) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) }
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}
function distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const px = a.x + t * dx, py = a.y + t * dy
  return Math.hypot(p.x - px, p.y - py)
}

let totalIssues = 0
const seeds = Array.from({ length: 200 }, (_, i) => 1000 + i * 7)
for (const seed of seeds) {
  const r = analyze(seed)
  if (r.issues[0] !== 'OK') {
    totalIssues++
    if (totalIssues <= 8) {
      console.log(`\n=== seed ${seed} (${r.totalNodes}节点, 起始${r.startCount}) ===`)
      r.issues.forEach(i => console.log('  - ' + i))
    }
  }
}
console.log(`\n${seeds.length} 个种子中 ${totalIssues} 个存在问题`)

// 打印一个典型地图的每行节点分布
const sample = analyze(1000 + 7 * 3)
console.log('\n样例每行节点数:', JSON.stringify(sample.rowCount))
console.log('样例类型分布:', JSON.stringify(sample.typeCount))
