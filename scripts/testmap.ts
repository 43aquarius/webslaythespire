import { generateMap } from '../src/game/map'
let totalBranch = 0, minBranch = 99, nodes = 0
for (let seed = 1; seed <= 30; seed++) {
  const m = generateMap(seed)
  const starts = m.startNodes.length
  if (starts < minBranch) minBranch = starts
  totalBranch += starts
  nodes += Object.keys(m.nodes).length
  // 检查 boss 可达性
  const reach14 = Object.values(m.nodes).filter(n => n.row === 13 && n.edges.length > 0).length
  const row13 = Object.values(m.nodes).filter(n => n.row === 13).length
  if (reach14 !== row13) console.log('seed', seed, 'row13 connection missing', reach14, row13)
  // 每行节点数
  for (let r = 0; r < 14; r++) {
    const cnt = Object.values(m.nodes).filter(n => n.row === r).length
    if (cnt < 2) console.log('seed', seed, 'row', r, 'only', cnt, 'nodes')
  }
}
console.log('avg start nodes:', (totalBranch / 30).toFixed(2), 'min:', minBranch, 'avg total nodes:', (nodes / 30).toFixed(1))
// 抽查一个 seed 的类型分布
const m = generateMap(42)
const types: Record<string, number> = {}
Object.values(m.nodes).forEach(n => { types[n.type] = (types[n.type] || 0) + 1 })
console.log('type distribution seed42:', types)
