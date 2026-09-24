'use client'
// ============ 地图界面（顶部 HUD 与战斗一致，参照原版） ============
import { useEffect, useRef } from 'react'
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

export function MapScreen() {
  const run = useGame(s => s.run)
  const chooseNode = useGame(s => s.chooseNode)
  const scrollRef = useRef<HTMLDivElement>(null)

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
  const reachable = run.currentNodeId
    ? (map.nodes[run.currentNodeId]?.edges ?? [])
    : map.startNodes

  const W = 1100, H = 1450

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
          {/* 边 —— 原版风格：亮色圆点虚线，走过的路变金色实线 */}
          <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 5 }}>
            {Object.values(map.nodes).flatMap(node =>
              node.edges.map(toId => {
                const to = map.nodes[toId]
                if (!to) return null
                const visitedEdge = run.visitedNodes.includes(toId) &&
                  (run.currentNodeId === node.id || run.visitedNodes.includes(node.id))
                const fromCurrent = run.currentNodeId === node.id
                return (
                  <line
                    key={`${node.id}-${toId}`}
                    x1={`${(node.x / W) * 100}%`} y1={`${(node.y / H) * 100}%`}
                    x2={`${(to.x / W) * 100}%`} y2={`${(to.y / H) * 100}%`}
                    stroke={visitedEdge ? '#ffd97a' : fromCurrent ? '#f0e6cc' : '#cfc2a4'}
                    strokeWidth={visitedEdge ? 6 : 5}
                    strokeDasharray={visitedEdge ? undefined : '0.5 13'}
                    strokeLinecap="round"
                    opacity={visitedEdge ? 0.95 : fromCurrent ? 0.95 : 0.75}
                    style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.9))' }}
                  />
                )
              })
            )}
          </svg>
          {/* 节点 */}
          {Object.values(map.nodes).map(node => (
            <MapNodeView
              key={node.id}
              node={node}
              isCurrent={run.currentNodeId === node.id}
              isReachable={reachable.includes(node.id)}
              visited={run.visitedNodes.includes(node.id)}
              onPick={() => chooseNode(node.id)}
            />
          ))}
          {/* 底部渐隐 */}
          <div className="absolute inset-x-0 bottom-0" style={{ height: 120, background: 'linear-gradient(0deg, rgba(8,5,3,0.8), transparent)', zIndex: 8 }} />
        </div>
      </div>
    </div>
  )
}

function MapNodeView({ node, isCurrent, isReachable, visited, onPick }: {
  node: MapNode; isCurrent: boolean; isReachable: boolean; visited: boolean; onPick: () => void
}) {
  const W = 1100, H = 1450
  const size = node.type === 'boss' ? 96 : node.type === 'elite' ? 60 : 52
  const icon = `${A}/mapicons/${NODE_ICON[node.type]}.png`
  return (
    <div
      className={`absolute ${isReachable ? 'sts-node-reach' : ''} ${!isReachable && !visited && !isCurrent ? 'sts-node-locked' : ''}`}
      style={{
        left: `calc(${(node.x / W) * 100}% - ${size / 2}px)`,
        top: `calc(${(node.y / H) * 100}% - ${size / 2}px)`,
        width: size, height: size,
        zIndex: isReachable || isCurrent ? 20 : 10,
        opacity: visited && !isCurrent ? 0.45 : 1,
      }}
      onClick={isReachable ? onPick : undefined}
    >
      <Tip
        tip={<b>{NODE_NAME[node.type]}</b>}
        className=""
      >
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
      {isCurrent && (
        <div className="absolute sts-title" style={{ inset: -8, border: '3px solid #ffd070', borderRadius: '50%', boxShadow: '0 0 18px rgba(255,208,112,0.8)' }} />
      )}
    </div>
  )
}
