'use client'
// ============ 地图界面 ============
import { useEffect, useRef, useState } from 'react'
import { useGame } from '@/store/gameStore'
import { MapNode } from '@/game/types'
import { Tip, RelicIcon, PotionSlot } from './Shared'

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
  const usePotionMap = useGame(s => s.usePotionMap)
  const openPile = useGame(s => s.openPile)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [tipNode, setTipNode] = useState<string | null>(null)

  // 自动滚动到当前节点
  useEffect(() => {
    if (!run || !scrollRef.current) return
    const cur = run.currentNodeId ? run.map.nodes[run.currentNodeId] : null
    const y = cur ? cur.y : 1350
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
    <div className="w-full h-full relative overflow-hidden select-none">
      {/* 顶部状态栏 */}
      <div className="absolute top-0 inset-x-0 z-30 flex items-center gap-3 px-4 py-2 flex-wrap"
        style={{ background: 'linear-gradient(180deg, rgba(10,6,4,0.92) 0%, rgba(10,6,4,0.75) 70%, transparent 100%)' }}>
        <div className="sts-body font-bold" style={{ color: '#ff8a70', fontSize: 16, textShadow: '1px 1px 0 #000' }}>
          ❤ {run.hp}/{run.maxHp}
        </div>
        <div className="sts-body font-bold" style={{ color: '#ffd980', fontSize: 16, textShadow: '1px 1px 0 #000' }}>
          💰 {run.gold}
        </div>
        <div className="flex gap-1 items-center">
          {run.relics.map(id => <RelicIcon key={id} id={id} size={34} />)}
        </div>
        <div className="flex gap-1 items-center">
          {run.potions.map((pid, i) => (
            <PotionSlot
              key={i} potionId={pid} size={32}
              onClick={() => usePotionMap(i)}
            />
          ))}
        </div>
        <button className="sts-btn" style={{ fontSize: 13, padding: '4px 14px' }} onClick={() => openPile('deck')}>
          查看牌组
        </button>
        <div className="ml-auto sts-body" style={{ color: '#a89070', fontSize: 13 }}>
          第 1 幕 · 层 {run.visitedNodes.length}
        </div>
      </div>

      {/* 地图画布 */}
      <div ref={scrollRef} className="w-full h-full overflow-y-auto sts-scroll">
        <div className="relative mx-auto" style={{ width: '100%', maxWidth: 900, height: H }}>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${A}/bg/map.jpg)`,
              backgroundSize: '100% 100%',
              filter: 'brightness(0.85)',
            }}
          />
          {/* 边 */}
          <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 5 }}>
            {Object.values(map.nodes).flatMap(node =>
              node.edges.map(toId => {
                const to = map.nodes[toId]
                if (!to) return null
                const visitedEdge = run.visitedNodes.includes(toId) &&
                  (run.currentNodeId === node.id || run.visitedNodes.includes(node.id))
                const onPath = run.currentNodeId === node.id
                return (
                  <line
                    key={`${node.id}-${toId}`}
                    x1={`${(node.x / W) * 100}%`} y1={`${(node.y / H) * 100}%`}
                    x2={`${(to.x / W) * 100}%`} y2={`${(to.y / H) * 100}%`}
                    stroke={visitedEdge ? '#e8c880' : 'rgba(60,40,28,0.65)'}
                    strokeWidth={visitedEdge ? 5 : 3}
                    strokeDasharray={visitedEdge ? undefined : '1 12'}
                    strokeLinecap="round"
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
  const size = node.type === 'boss' ? 92 : node.type === 'elite' ? 56 : 48
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
