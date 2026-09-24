// ============ StS 式地图生成算法（对齐原版结构） ============
// 原版第一幕：16 层 —— 第 1 层(lay 0)战斗、第 9 层(row 8)宝箱、
// 第 15 层(row 14)篝火、第 16 层 Boss；其余层随机（5 层后可出精英/篝火）。
// 规则：6 条路径向上爬；边不允许交叉；步进限制 ±1/0（垂直边永不相交，
// 且不会从节点中间穿过）；所有 row14 节点直连 Boss。
import { GameMap, MapNode, NodeType } from './types'

export const MAP_ROWS = 16       // 0-13 随机层, 8 宝箱, 14 篝火, 15 Boss
export const MAP_COLS = 7
export const TREASURE_ROW = 8
export const REST_ROW = 14
export const BOSS_ROW = 15

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

// 两条边是否几何相交（同一行间隙内的两条边）
// new: (c -> d)，old: (a -> b)；相交 iff 一条向右一条向左且列区间重叠
function edgesCross(c: number, d: number, a: number, b: number): boolean {
  return (c < a && d > b) || (c > a && d < b)
}

export function generateMap(seed: number): GameMap {
  const rng = mulberry32(seed)
  const nodes: Record<string, MapNode> = {}
  const mkId = (row: number, col: number) => `r${row}c${col}`

  // 已有的行间隙边：edgesBetween[r] = Set<"c>d">
  const edgesBetween: Array<Set<number>> = []
  for (let r = 0; r < REST_ROW; r++) edgesBetween.push(new Set())

  const addEdge = (row: number, fromCol: number, toCol: number) => {
    const key = fromCol * 100 + toCol
    if (!edgesBetween[row].has(key)) edgesBetween[row].add(key)
  }
  const wouldCross = (row: number, fromCol: number, toCol: number): boolean => {
    for (const key of edgesBetween[row]) {
      const a = Math.floor(key / 100), b = key % 100
      if (edgesCross(fromCol, toCol, a, b)) return true
    }
    return false
  }

  // ---- 1. 生成 6 条路径（row 0 -> row 14），步进 ±1/0，禁止交叉 ----
  const pathCount = 6
  const paths: number[][] = []
  // 前 3 条路径从互不相同的列出发（保证起始节点 >= 3，对齐原版）
  const startOrder = Array.from({ length: MAP_COLS }, (_, i) => i)
  for (let i = startOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[startOrder[i], startOrder[j]] = [startOrder[j], startOrder[i]]
  }
  for (let p = 0; p < pathCount; p++) {
    const path: number[] = [p < 3 ? startOrder[p] : Math.floor(rng() * MAP_COLS)]
    for (let row = 1; row <= REST_ROW; row++) {
      const cur = path[row - 1]
      // 随机选择步进：-1 / 0 / +1（带边界钳制）
      const roll = rng()
      let step = 0
      if (roll < 0.38) step = -1
      else if (roll > 0.62) step = 1
      let next = Math.max(0, Math.min(MAP_COLS - 1, cur + step))
      if (next !== cur && wouldCross(row - 1, cur, next)) {
        // 会与已有边交叉 → 回退为垂直步进（垂直边永不相交，安全）
        next = cur
      }
      path.push(next)
      addEdge(row - 1, cur, next)
    }
    paths.push(path)
  }

  // ---- 2. 依据路径落点建节点（天然去重） ----
  const rowCols: Array<Set<number>> = []
  for (let row = 0; row <= REST_ROW; row++) rowCols.push(new Set())
  for (const p of paths) p.forEach((col, row) => rowCols[row].add(col))

  for (let row = 0; row <= REST_ROW; row++) {
    rowCols[row].forEach(col => {
      const id = mkId(row, col)
      nodes[id] = { id, row, col, type: 'monster', edges: [], x: 0, y: 0 }
    })
  }

  // ---- 3. 建边：路径的每一步 + 合并多父节点 ----
  const edgeSet = new Set<string>() // "fromId>toId"
  const addNodeEdge = (fromId: string, toId: string) => {
    const key = `${fromId}>${toId}`
    if (!edgeSet.has(key) && nodes[fromId] && nodes[toId]) {
      edgeSet.add(key)
      nodes[fromId].edges.push(toId)
    }
  }
  for (const p of paths) {
    for (let row = 0; row < REST_ROW; row++) {
      addNodeEdge(mkId(row, p[row]), mkId(row + 1, p[row + 1]))
    }
  }

  // Boss 节点与连线
  const bossId = mkId(BOSS_ROW, 3)
  nodes[bossId] = { id: bossId, row: BOSS_ROW, col: 3, type: 'boss', edges: [], x: 0, y: 0 }
  for (const col of rowCols[REST_ROW]) {
    nodes[mkId(REST_ROW, col)].edges.push(bossId)
  }

  // ---- 4. 节点类型 ----
  // 固定行
  for (const col of rowCols[0]) nodes[mkId(0, col)].type = 'monster'
  for (const col of rowCols[TREASURE_ROW]) nodes[mkId(TREASURE_ROW, col)].type = 'treasure'
  for (const col of rowCols[REST_ROW]) nodes[mkId(REST_ROW, col)].type = 'rest'

  // 随机行权重（近似原版）：战斗 45% / 事件 22% / 精英 16%(row>=5) / 篝火 12%(row>=5) / 商店 5%
  const parentOf = (row: number, col: number): MapNode[] =>
    Object.values(nodes).filter(n => n.row === row - 1 && n.edges.includes(mkId(row, col)))

  const randomType = (row: number, parents: MapNode[]): NodeType => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const roll = rng()
      let t: NodeType
      if (roll < 0.45) t = 'monster'
      else if (roll < 0.67) t = 'event'
      else if (roll < 0.83) t = row >= 5 ? 'elite' : 'monster'
      else if (roll < 0.95) t = row >= 5 ? 'rest' : 'event'
      else t = 'shop'
      // 原版约束：路径上不与父节点连续同类（战斗/事件可以连续）
      if (t === 'elite' || t === 'shop' || t === 'rest') {
        if (parents.some(p => p.type === t)) continue
      }
      return t
    }
    return 'monster'
  }

  for (let row = 1; row < REST_ROW; row++) {
    if (row === TREASURE_ROW) continue
    rowCols[row].forEach(col => {
      nodes[mkId(row, col)].type = randomType(row, parentOf(row, col))
    })
  }

  // 保底：若全图没有精英（概率极低），强制放一个
  const hasElite = Object.values(nodes).some(n => n.type === 'elite')
  if (!hasElite) {
    const candidates = Object.values(nodes).filter(n => n.row >= 6 && n.row <= 12 && n.type === 'monster')
    if (candidates.length > 0) candidates[Math.floor(rng() * candidates.length)].type = 'elite'
  }

  // ---- 5. 坐标（Boss 在顶部，row 0 在底部） ----
  const width = 1100
  const height = 1450
  const colW = width / (MAP_COLS + 1)
  const rowH = height / (MAP_ROWS + 0.5)
  Object.values(nodes).forEach(node => {
    node.x = (node.col + 1) * colW - colW / 2
    node.y = height - (node.row + 1) * rowH + rowH / 2
  })

  const startNodes = [...rowCols[0]].map(col => mkId(0, col))
  return { nodes, startNodes, bossNodeId: bossId }
}

// 可达节点（从当前节点出发）
export function reachableNodes(map: GameMap, currentNodeId: string | null): string[] {
  if (!currentNodeId) return map.startNodes
  const node = map.nodes[currentNodeId]
  if (!node) return []
  return node.edges
}

// ============ 第四幕：固定结构（篝火 → 精英 → 篝火 → Boss） ============
export function generateAct4Map(seed: number): GameMap {
  void seed
  const nodes: Record<string, MapNode> = {}
  const mk = (id: string, row: number, col: number, type: NodeType): MapNode => {
    const n: MapNode = { id, row, col, type, edges: [], x: 0, y: 0 }
    nodes[id] = n
    return n
  }
  const rest1 = mk('a4r0', 0, 3, 'rest')
  const elite = mk('a4r1', 1, 3, 'elite')
  const rest2 = mk('a4r2', 2, 3, 'rest')
  const boss = mk('a4r3', 3, 3, 'boss')
  rest1.edges.push(elite.id)
  elite.edges.push(rest2.id)
  rest2.edges.push(boss.id)
  const width = 1100, height = 1450
  const rowH = height / 4.5
  Object.values(nodes).forEach(n => {
    n.x = width / 2
    n.y = height - (n.row + 1) * rowH + rowH / 2
  })
  return { nodes, startNodes: [rest1.id], bossNodeId: boss.id }
}
