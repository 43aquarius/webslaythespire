'use client'
// ============ 地图界面（顶部 HUD 与战斗一致，参照原版） ============
// 第五批还原（sts2-web map.tsx 逆向）：点状路径(22px间距+抖动+走过变深色1.2×) /
// 可达节点 sin 脉冲 / 悬停1.45×+白描边 / 按下0.9× / 选中 Back 弹回 /
// 选点墨迹逐点点亮(0.8s) / 玩家标记(X轴展开+弹性落地) / 图例悬停高亮同类节点
import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '@/store/gameStore'
import { MapNode } from '@/game/types'
import { Tip, TopHud } from './Shared'

const A = '/assets'

const NODE_ICON: Record<string, string> = {
  monster: 'monster', elite: 'elite', event: 'event', shop: 'shop',
  treasure: 'treasure', rest: 'rest', boss: 'boss',
}

const NODE_NAME: Record<string, string> = {
  monster: '普通敌人', elite: '精英敌人', event: '未知事件', shop: '商店',
  treasure: '宝箱', rest: '篝火', boss: 'BOSS',
}

const W = 1100, H = 1450

/** 确定性伪随机（同一朵点每次渲染抖动一致，不闪烁） */
const prand = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

interface Dot { x: number; y: number; edgeKey: string; idx: number }

/** 预计算全部路径圆点（原版 NMapScreen：每 22 单距一朵，随机抖动 ±3）+ 按边分组 */
function buildDots(nodes: Record<string, MapNode>): { dots: Dot[]; byEdge: Map<string, Dot[]> } {
  const dots: Dot[] = []
  const byEdge = new Map<string, Dot[]>()
  for (const node of Object.values(nodes)) {
    for (const toId of node.edges) {
      const to = nodes[toId]
      if (!to) continue
      const x1 = node.x, y1 = node.y, x2 = to.x, y2 = to.y
      const len = Math.hypot(x2 - x1, y2 - y1)
      const count = Math.floor(len / 22)
      const vx = (x2 - x1) / len, vy = (y2 - y1) / len
      const edgeKey = `${node.id}>${toId}`
      const list: Dot[] = []
      for (let i = 1; i <= count; i++) {
        const seed = node.id.length * 131 + toId.length * 977 + i * 37
        const d: Dot = {
          x: x1 + vx * i * 22 + (prand(seed) - 0.5) * 7,
          y: y1 + vy * i * 22 + (prand(seed + 0.5) - 0.5) * 7,
          edgeKey,
          idx: i,
        }
        dots.push(d); list.push(d)
      }
      byEdge.set(edgeKey, list)
    }
  }
  return { dots, byEdge }
}

export function MapScreen() {
  const run = useGame(s => s.run)
  const chooseNode = useGame(s => s.chooseNode)
  const net = useGame(s => s.net)
  const scrollRef = useRef<HTMLDivElement>(null)
  // 墨迹动画：选点后先逐点点亮 0.55s 再真正跳转（黑幕扫落时墨迹在幕下继续）
  const [inking, setInking] = useState<{ from: string; to: string } | null>(null)
  const inkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 点状路径预计算（hooks 须在早退 return 之前）
  const { dots, byEdge } = useMemo(
    () => run ? buildDots(run.map.nodes) : { dots: [] as Dot[], byEdge: new Map<string, Dot[]>() },
    [run?.map]
  )

  useEffect(() => () => { if (inkTimer.current) clearTimeout(inkTimer.current) }, [])

  // 自动滚动到当前节点
  useEffect(() => {
    if (!run || !scrollRef.current) return
    const cur = run.currentNodeId ? run.map.nodes[run.currentNodeId] : null
    const y = cur ? cur.y : 1380
    const el = scrollRef.current
    const target = Math.max(0, (el.scrollHeight * (y / 1450)) - el.clientHeight * 0.55)
    el.scrollTo({ top: target, behavior: 'smooth' })
  }, [run?.currentNodeId])

  if (!run) return null
  const map = run.map
  const reachable: string[] = run.currentNodeId
    ? (map.nodes[run.currentNodeId]?.edges ?? [])
    : map.startNodes

  const dotTraveled = (d: Dot) => {
    const [from, to] = d.edgeKey.split('>')
    return run.visitedNodes.includes(to) &&
      (run.currentNodeId === from || run.visitedNodes.includes(from))
  }
  // 墨迹边的每朵点延迟：0.55s 内逐朵点亮（原版 0.8s 全边，跳转前可见部分）
  const inkPer = (edgeKey: string) => {
    const n = byEdge.get(edgeKey)?.length ?? 1
    return Math.min(0.55 / Math.max(n, 1), 0.1)
  }

  // 选点：先墨迹点亮，0.55s 后真正跳转（与房间黑幕时序对齐）
  const pick = (nodeId: string) => {
    if (inking) return
    const from = run.currentNodeId ?? ''
    setInking({ from, to: nodeId })
    inkTimer.current = setTimeout(() => chooseNode(nodeId), 550)
  }

  const myIdx = run.players.length > 1 ? net.myIdx : 0
  const myChar = run.players[myIdx]?.character || 'ironclad'
  const curNode = run.currentNodeId ? map.nodes[run.currentNodeId] : null

  return (
    <div className="w-full h-full relative overflow-hidden select-none sts-screen-fade">
      {/* 顶部 HUD（原版：左上牌组+血条+层数，右上金币+药水+遗物） */}
      <TopHud floor={run.visitedNodes.length} />

      {/* 地图画布 */}
      <div ref={scrollRef} className="w-full h-full overflow-y-auto sts-scroll">
        <div className="relative mx-auto" style={{ width: '100%', maxWidth: 940, height: H }}>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${A}/bg/map.jpg)`,
              backgroundSize: '100% 100%',
              filter: 'brightness(0.85)',
            }}
          />
          {/* 路径圆点（原版 map_dot 点状路径，替代旧 SVG 虚线） */}
          <div className="absolute inset-0" style={{ zIndex: 5 }}>
            {dots.map(d => {
              const traveled = dotTraveled(d)
              const edgeKey = d.edgeKey
              const isInk = inking && edgeKey === `${inking.from}>${inking.to}`
              return (
                <div
                  key={edgeKey + d.idx}
                  className={`sts-map-dot ${traveled || isInk ? 'traveled' : ''}`}
                  style={{
                    left: `${(d.x / W) * 100}%`,
                    top: `${(d.y / H) * 100}%`,
                    ...(isInk ? { transitionDelay: `${(d.idx * inkPer(edgeKey)).toFixed(3)}s` } : {}),
                  }}
                />
              )
            })}
          </div>
          {/* 节点 */}
          {Object.values(map.nodes).map(node => (
            <MapNodeView
              key={node.id}
              node={node}
              isCurrent={run.currentNodeId === node.id}
              isReachable={reachable.includes(node.id)}
              visited={run.visitedNodes.includes(node.id)}
              selected={inking?.to === node.id}
              onPick={() => pick(node.id)}
            />
          ))}
          {/* 玩家标记（原版 NMapMarker：当前节点上方 35px，X 轴展开 + 弹性落地） */}
          {curNode && (
            <div
              key={`marker-${run.currentNodeId}`}
              className="sts-map-marker"
              style={{ left: `${(curNode.x / W) * 100}%`, top: `calc(${(curNode.y / H) * 100}% - 62px)` }}
            >
              <img src={`${A}/hero/${myChar}.png`} alt="" draggable={false} />
            </div>
          )}
          {/* 底部渐隐 */}
          <div className="absolute inset-x-0 bottom-0" style={{ height: 120, background: 'linear-gradient(0deg, rgba(8,5,3,0.8), transparent)', zIndex: 8 }} />
        </div>
      </div>

      {/* 图例（原版 map_legend：悬停高亮同类节点） */}
      <MapLegend />
    </div>
  )
}

/** 图例：悬停条目 → 同类节点放大 + 白描边（原版 S.highlight 机制） */
function MapLegend() {
  const [hot, setHot] = useState<string | null>(null)
  const items: [string, string][] = [
    ['event', '未知'], ['shop', '商店'], ['treasure', '宝箱'],
    ['rest', '篝火'], ['monster', '敌人'], ['elite', '精英'],
  ]
  return (
    <div className="sts-map-legend">
      <div className="lg-title">图 例</div>
      {items.map(([type, name]) => (
        <div
          key={type}
          data-ltype={type}
          className={`lg-item ${hot === type ? 'lg-hot' : ''}`}
          onMouseEnter={() => setHot(type)}
          onMouseLeave={() => setHot(null)}
        >
          <img src={`${A}/mapicons/${NODE_ICON[type]}.png`} alt="" draggable={false} />
          <span>{name}</span>
        </div>
      ))}
      {/* 高亮层：给同类节点加 hover 态（CSS 兄弟选择器难跨层，改用 data 属性全局样式） */}
      <MapLegendHighlight type={hot} />
    </div>
  )
}

/** 图例悬停 → 对应类型节点加 map-hover 类（模拟原版 S.highlight） */
function MapLegendHighlight({ type }: { type: string | null }) {
  useEffect(() => {
    if (!type) return
    const els = document.querySelectorAll(`[data-ntype="${type}"]`)
    els.forEach(el => el.classList.add('map-hover'))
    return () => els.forEach(el => el.classList.remove('map-hover'))
  }, [type])
  return null
}

function MapNodeView({ node, isCurrent, isReachable, visited, selected, onPick }: {
  node: MapNode; isCurrent: boolean; isReachable: boolean; visited: boolean; selected: boolean; onPick: () => void
}) {
  const size = node.type === 'boss' ? 96 : node.type === 'elite' ? 60 : 52
  const icon = `${A}/mapicons/${NODE_ICON[node.type]}.png`
  return (
    <div
      data-ntype={node.type}
      className={`absolute sts-map-node ${isReachable ? 'sts-map-pulse' : ''} ${!isReachable && !visited && !isCurrent ? 'sts-node-locked' : ''} ${selected ? 'map-select' : ''}`}
      style={{
        left: `calc(${(node.x / W) * 100}% - ${size / 2}px)`,
        top: `calc(${(node.y / H) * 100}% - ${size / 2}px)`,
        width: size, height: size,
        zIndex: isReachable || isCurrent ? 20 : 10,
        opacity: visited && !isCurrent ? 0.5 : 1,
      }}
      onClick={isReachable ? onPick : undefined}
    >
      <Tip tip={<b>{NODE_NAME[node.type]}</b>} className="">
        <img
          src={icon}
          alt={NODE_NAME[node.type]}
          draggable={false}
          className="w-full h-full object-contain"
          style={{
            filter: isCurrent
              ? 'drop-shadow(0 0 14px #ffd070) brightness(1.2)'
              : undefined,
          }}
        />
      </Tip>
      {/* 悬停白描边（原版 OUTLINE_HOVER α0.75） */}
      <div className="sts-map-outline" />
      {isCurrent && (
        <div className="absolute sts-title" style={{ inset: -8, border: '3px solid #ffd070', borderRadius: '50%', boxShadow: '0 0 18px rgba(255,208,112,0.8)' }} />
      )}
    </div>
  )
}
