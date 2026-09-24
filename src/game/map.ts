// ============ StS 式地图生成算法 ============
import { GameMap, MapNode, NodeType } from './types'

export const MAP_ROWS = 17       // 0-13 随机层, 14 宝箱, 15 篝火, 16 Boss
export const MAP_COLS = 7

// RNG (可播种)
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// StS 权重表（近似原版）
function nodeTypeForRow(row: number, rng: () => number, lastOnPath: MapNode | null): NodeType {
  if (row === 0) return 'monster'
  if (row === 14) return 'treasure'
  if (row === 15) return 'rest'
  if (row === 16) return 'boss'

  const roll = rng()
  if (row <= 3) {
    // 前几层：无精英
    if (roll < 0.45) return 'monster'
    if (roll < 0.85) return 'event'
    if (roll < 0.95) return 'shop'
    return 'treasure'
  }
  // 4-13 层
  if (roll < 0.40) return 'monster'
  if (roll < 0.70) return 'event'
  if (roll < 0.90) return 'elite'
  if (roll < 0.95) return 'shop'
  return 'treasure'
}

// 约束：避免连续同类型（路径上）
function adjustType(type: NodeType, parent: MapNode | null): NodeType {
  if (!parent) return type
  if (type === parent.type) {
    // 简单避让
    if (type === 'elite' || type === 'shop' || type === 'treasure' || type === 'rest') return 'monster'
    if (type === 'monster') return 'event'
    if (type === 'event') return 'monster'
  }
  return type
}

export function generateMap(seed: number): GameMap {
  const rng = mulberry32(seed)
  const nodes: Record<string, MapNode> = {}

  const mkId = (row: number, col: number) => `r${row}c${col}`

  // 生成路径（模拟 StS：6 条路径从底部向上爬）
  const pathCount = 6
  const paths: number[][] = []   // 每条路径: [row0 的列, row1 的列, ...]
  for (let p = 0; p < pathCount; p++) {
    const path: number[] = []
    let col = Math.floor(rng() * MAP_COLS)
    path.push(col)
    for (let row = 1; row < 14; row++) {
      // 随机 -1/0/+1 偏移
      const r = rng()
      if (r < 0.35) col = Math.max(0, col - 1)
      else if (r < 0.70) col = col
      else col = Math.min(MAP_COLS - 1, col + 1)
      path.push(col)
    }
    paths.push(path)
  }

  // 收集每行的节点（去重）
  const rowCols: Set<number>[] = []
  for (let row = 0; row < 14; row++) {
    rowCols[row] = new Set()
    paths.forEach(p => rowCols[row].add(p[row]))
  }

  // 创建节点
  for (let row = 0; row < 14; row++) {
    rowCols[row].forEach(col => {
      const id = mkId(row, col)
      nodes[id] = {
        id, row, col, type: 'monster', edges: [],
        x: 0, y: 0,
      }
    })
  }

  // 宝箱/篝火/Boss 行（单行）
  for (let col = 0; col < MAP_COLS; col++) {
    const tId = mkId(14, col)
    nodes[tId] = { id: tId, row: 14, col, type: 'treasure', edges: [], x: 0, y: 0 }
    const rId = mkId(15, col)
    nodes[rId] = { id: rId, row: 15, col, type: 'rest', edges: [], x: 0, y: 0 }
  }
  const bossId = mkId(16, 3)
  nodes[bossId] = { id: bossId, row: 16, col: 3, type: 'boss', edges: [], x: 0, y: 0 }

  // 连接边：row13 → row14 (treasure), row14 → row15 (rest), row15 → boss
  // 13 层每个节点连到最近的 14 层节点
  rowCols[13].forEach(col => {
    const from = nodes[mkId(13, col)]
    // 连接到 14 行：优先同列，否则最近
    const target = nearestCol(rowCols, 14, col, rng)
    from.edges.push(mkId(14, target))
  })
  // 14→15, 15→16
  for (let col = 0; col < MAP_COLS; col++) {
    nodes[mkId(14, col)].edges.push(mkId(15, col))
  }
  for (let col = 0; col < MAP_COLS; col++) {
    nodes[mkId(15, col)].edges.push(bossId)
  }

  // 路径连接 row N → N+1（基于路径走向）
  for (let row = 0; row < 13; row++) {
    paths.forEach(path => {
      const fromCol = path[row]
      const toCol = path[row + 1]
      const from = nodes[mkId(row, fromCol)]
      const toId = mkId(row + 1, toCol)
      if (!from.edges.includes(toId)) from.edges.push(toId)
      // StS 路径交叉规则：允许连接相邻列的节点（简化：额外连接 toCol±0 已覆盖）
    })
  }

  // 分配节点类型
  for (let row = 0; row < 14; row++) {
    rowCols[row].forEach(col => {
      const node = nodes[mkId(row, col)]
      let type = nodeTypeForRow(row, rng, null)
      // 避免与父节点同类型连续
      const parents = Object.values(nodes).filter(n => n.row === row - 1 && n.edges.includes(node.id))
      for (const p of parents) {
        type = adjustType(type, p)
      }
      node.type = type
    })
  }

  // 保证第 4+ 行至少有 1 个精英；若无则强制替换一个怪节点
  const eliteCount = Object.values(nodes).filter(n => n.row >= 4 && n.row <= 13 && n.type === 'elite').length
  if (eliteCount === 0) {
    const candidates = Object.values(nodes).filter(n => n.row >= 5 && n.row <= 10 && n.type === 'monster')
    if (candidates.length > 0) {
      candidates[Math.floor(rng() * candidates.length)].type = 'elite'
    }
  }

  // 计算坐标（像素）— 上层在下（StS 地图从下往上走，我们渲染为 Boss 在顶部）
  const width = 1100
  const height = 1450
  const colW = width / (MAP_COLS + 1)
  const rowH = height / (MAP_ROWS + 0.5)
  Object.values(nodes).forEach(node => {
    node.x = (node.col + 1) * colW - colW / 2
    // row 0 在底部
    node.y = height - (node.row + 1) * rowH + rowH / 2
  })

  // 起始节点 = row 0 全部
  const startNodes = [...rowCols[0]].map(col => mkId(0, col))

  return { nodes, startNodes, bossNodeId: bossId }
}

function nearestCol(rowCols: Set<number>[], row: number, col: number, rng: () => number): number {
  const cols = [...rowCols[row] ?? []]
  if (cols.length === 0) return col
  cols.sort((a, b) => Math.abs(a - col) - Math.abs(b - col))
  const best = cols[0]
  return best
}

// 可达节点（从当前节点出发）
export function reachableNodes(map: GameMap, currentNodeId: string | null): string[] {
  if (!currentNodeId) return map.startNodes
  const node = map.nodes[currentNodeId]
  if (!node) return []
  return node.edges
}
