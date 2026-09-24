'use client'
// ============ 战斗奖励界面 ============
import { useGame } from '@/store/gameStore'
import { CardView } from './CardView'
import { CARDS } from '@/game/cards'
import { RELICS } from '@/game/relics'
import { POTIONS } from '@/game/potions'
import { Tip, RelicIcon, PotionSlot } from './Shared'

const A = '/assets'

export function RewardScreen() {
  const run = useGame(s => s.run)
  const takeGold = useGame(s => s.takeGold)
  const takeCard = useGame(s => s.takeCard)
  const takePotion = useGame(s => s.takePotion)
  const takeRelic = useGame(s => s.takeRelic)
  const proceed = useGame(s => s.proceedFromReward)

  if (!run?.reward || !run.combat) return null
  const r = run.reward

  return (
    <div className="w-full h-full relative select-none"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #3a2214 0%, #140a06 65%, #080402 100%)' }}>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 sts-title"
        style={{ fontSize: 42, color: '#ffd980', textShadow: '3px 3px 0 #000' }}>
        战利品
      </div>

      <div className="absolute inset-x-0 flex flex-col items-center gap-3" style={{ top: 110 }}>
        {/* 金币 */}
        {r.gold !== undefined && (
          <RewardRow
            done={r.taken.includes('gold')}
            onClick={takeGold}
          >
            <img src="/assets/mapicons/treasure.png" alt="" width={44} height={44} />
            <span className="sts-num font-bold" style={{ color: '#ffd980', fontSize: 22 }}>{r.gold} 金币</span>
          </RewardRow>
        )}

        {/* 卡牌 */}
        {r.cards && r.cards.length > 0 && (
          <div className="flex flex-col items-center gap-2 mt-2">
            <div className="sts-body" style={{ color: '#c8b090', fontSize: 15 }}>选择一张卡牌加入牌组（或跳过）</div>
            <div className="flex gap-4 flex-wrap justify-center px-4">
              {(() => {
                // 原版规则：奖励卡牌只能选一张，选后其余锁定
                const tookAny = r.taken.some(t => t.startsWith('card_'))
                return r.cards.map((cid, i) => {
                  const taken = r.taken.includes('card_' + cid)
                  const locked = tookAny && !taken
                  return (
                    <div key={cid} className="sts-card-in relative" style={{ animationDelay: `${i * 0.12}s` }}>
                      <CardView
                        card={{ uid: 'reward_' + cid, id: cid, upgraded: 0 }}
                        width={168}
                        dimmed={taken || locked}
                        onClick={() => !taken && !locked && takeCard(cid)}
                      />
                      {taken && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="sts-title" style={{ fontSize: 30, color: '#7fe08a', textShadow: '2px 2px 0 #000' }}>已选</span>
                        </div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        )}

        {/* 药水 */}
        {r.potion && (
          <RewardRow done={r.taken.includes('potion')} onClick={takePotion}>
            <PotionSlot potionId={r.potion} size={40} />
            <span className="sts-body" style={{ color: '#d8c8a8', fontSize: 15 }}>{POTIONS[r.potion]?.name}</span>
          </RewardRow>
        )}

        {/* 遗物 */}
        {r.relic && (
          <RewardRow done={r.taken.includes('relic')} onClick={takeRelic}>
            <RelicIcon id={r.relic} size={44} />
            <span className="sts-body" style={{ color: '#d8c8a8', fontSize: 15 }}>{RELICS[r.relic]?.name}</span>
          </RewardRow>
        )}

        <button className="sts-btn sts-title mt-6" style={{ fontSize: 24 }} onClick={proceed}>
          {run.combat.isBoss ? '继续' : '返回地图'}
        </button>
      </div>
    </div>
  )
}

function RewardRow({ children, onClick, done }: { children: React.ReactNode; onClick: () => void; done: boolean }) {
  return (
    <button
      className={`flex items-center gap-3 px-5 py-2 rounded-lg transition-all ${done ? 'opacity-40' : 'hover:brightness-125 hover:translate-x-1'}`}
      style={{
        background: 'rgba(30,18,10,0.85)', border: '2px solid #5a4030',
        boxShadow: done ? 'none' : '0 3px 12px rgba(0,0,0,0.5)',
        cursor: done ? 'default' : 'pointer',
      }}
      onClick={() => !done && onClick()}
    >
      {children}
      {!done && <span className="sts-body" style={{ color: '#8a7a60', fontSize: 12 }}>点击获取</span>}
    </button>
  )
}

// ============ Boss 遗物选择 ============
export function BossRelicScreen() {
  const run = useGame(s => s.run)
  const options = useGame(s => s.bossOptions)
  const choose = useGame(s => s.chooseBossRelic)
  if (!run) return null

  return (
    <div className="w-full h-full relative flex flex-col items-center justify-center gap-8 select-none"
      style={{ background: 'radial-gradient(ellipse at 50% 35%, #3a2214 0%, #140a06 65%, #080402 100%)' }}>
      <div className="sts-title" style={{ fontSize: 40, color: '#ffd980', textShadow: '3px 3px 0 #000' }}>
        击败了首领！选择你的战利品
      </div>
      <div className="flex gap-8 flex-wrap justify-center">
        {options.map(id => {
          const def = RELICS[id]
          return (
            <button
              key={id}
              className="sts-panel p-6 flex flex-col items-center gap-3 transition-all hover:brightness-125 hover:-translate-y-1"
              style={{ width: 230, cursor: 'pointer' }}
              onClick={() => choose(id)}
            >
              <img src={`${A}/relics/${id}.png`} alt={def.name} width={84} height={84} draggable={false} />
              <div className="sts-title" style={{ fontSize: 20, color: '#ffd980' }}>{def.name}</div>
              <div className="sts-body text-center" style={{ fontSize: 14, color: '#d8c8a8', lineHeight: 1.5 }}>{def.desc}</div>
            </button>
          )
        })}
      </div>
      <button className="sts-btn sts-title" style={{ fontSize: 20 }} onClick={() => choose(null)}>
        跳过，直达胜利
      </button>
    </div>
  )
}

// ============ 篝火界面 ============
export function RestScreen() {
  const run = useGame(s => s.run)
  const restAction = useGame(s => s.restAction)
  if (!run) return null
  const canRest = !run.relics.includes('coffeeDripper')
  const heal = Math.min(Math.floor(run.maxHp * 0.3), run.maxHp - run.hp)

  return (
    <div className="w-full h-full relative flex flex-col items-center justify-center gap-10 select-none"
      style={{ background: 'radial-gradient(ellipse at 50% 80%, #5a2e10 0%, #1a0e06 60%, #080402 100%)' }}>
      <img src={`${A}/mapicons/rest.png`} alt="" width={140} height={140} draggable={false}
        style={{ filter: 'drop-shadow(0 0 30px rgba(255,150,40,0.7))' }} />
      <div className="sts-title" style={{ fontSize: 44, color: '#ffd980', textShadow: '3px 3px 0 #000' }}>
        篝火
      </div>
      <div className="flex gap-8 flex-wrap justify-center">
        <button className="sts-panel p-6 flex flex-col items-center gap-2 transition-all hover:brightness-125 hover:-translate-y-1"
          style={{ width: 220, cursor: canRest ? 'pointer' : 'not-allowed', opacity: canRest ? 1 : 0.5 }}
          onClick={() => canRest && restAction('rest')}>
          <span style={{ fontSize: 44 }}>🛏️</span>
          <div className="sts-title" style={{ fontSize: 22, color: '#ffd980' }}>休息</div>
          <div className="sts-body text-center" style={{ fontSize: 14, color: '#d8c8a8' }}>
            回复 {Math.floor(run.maxHp * 0.3)} 点生命值（上限的 30%）<br />
            <span style={{ color: '#8fe89a' }}>当前可回复 {heal} 点</span>
          </div>
        </button>
        <button className="sts-panel p-6 flex flex-col items-center gap-2 transition-all hover:brightness-125 hover:-translate-y-1"
          style={{ width: 220, cursor: 'pointer' }}
          onClick={() => restAction('smith')}>
          <span style={{ fontSize: 44 }}>⚒️</span>
          <div className="sts-title" style={{ fontSize: 22, color: '#ffd980' }}>锻造</div>
          <div className="sts-body text-center" style={{ fontSize: 14, color: '#d8c8a8' }}>
            升级牌组中的一张牌
          </div>
        </button>
      </div>
    </div>
  )
}

// ============ 宝箱界面 ============
export function TreasureScreen() {
  const run = useGame(s => s.run)
  const take = useGame(s => s.takeTreasure)
  if (!run) return null
  return (
    <div className="w-full h-full relative flex flex-col items-center justify-center gap-10 select-none"
      style={{ background: 'radial-gradient(ellipse at 50% 75%, #4a3a10 0%, #160e04 60%, #080402 100%)' }}>
      <div className="sts-title" style={{ fontSize: 44, color: '#ffd980', textShadow: '3px 3px 0 #000' }}>
        宝箱
      </div>
      <button
        className="transition-transform hover:scale-110"
        onClick={take}
        style={{ filter: 'drop-shadow(0 0 26px rgba(255,200,60,0.55))' }}
      >
        <img src={`${A}/mapicons/treasure.png`} alt="宝箱" width={180} height={180} draggable={false} />
      </button>
      <button className="sts-btn sts-title" style={{ fontSize: 20 }} onClick={take}>
        打开宝箱
      </button>
    </div>
  )
}

// ============ 结算界面 ============
export function GameOverScreen() {
  const run = useGame(s => s.run)
  const startRun = useGame(s => s.startRun)
  const backToTitle = useGame(s => s.backToTitle)
  if (!run?.gameOverInfo) return null
  const info = run.gameOverInfo

  return (
    <div className="w-full h-full relative flex flex-col items-center justify-center gap-8 select-none"
      style={{ background: 'radial-gradient(ellipse at 50% 35%, #2a1210 0%, #100806 60%, #050202 100%)' }}>
      <div className="sts-title" style={{
        fontSize: 72, color: info.victory ? '#ffd980' : '#c85040',
        textShadow: '4px 4px 0 #000, 0 0 60px rgba(0,0,0,0.8)',
      }}>
        {info.victory ? '第一幕 通关！' : '你死了'}
      </div>
      <div className="sts-panel p-8 flex flex-col gap-3" style={{ minWidth: 340 }}>
        <StatRow label="到达层数" value={String(info.floor)} />
        <StatRow label="消灭怪物" value={String(info.monstersSlain)} />
        <StatRow label="消灭精英" value={String(info.elitesSlain)} />
        <StatRow label="赚取金币" value={String(info.goldEarned)} />
      </div>
      <div className="flex gap-5">
        <button className="sts-btn sts-title" style={{ fontSize: 22 }} onClick={() => startRun()}>再来一局</button>
        <button className="sts-btn sts-title" style={{ fontSize: 22 }} onClick={backToTitle}>回到主菜单</button>
      </div>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between sts-body" style={{ fontSize: 16 }}>
      <span style={{ color: '#a89070' }}>{label}</span>
      <span className="sts-num font-bold" style={{ color: '#f5e5c8' }}>{value}</span>
    </div>
  )
}
