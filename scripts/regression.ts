// 针对 bug 修复点的专项回归测试
import { useGame } from '../src/store/gameStore'
import { CARDS, cardCost, makeCard } from '../src/game/cards'
import {
  startCombat, canPlayCard, playCard, applyStatus, enemyDisplayDamage, AP,
} from '../src/game/engine'
import { newRun } from '../src/game/run'

const g = useGame as any
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let pass = 0, fail = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${detail}`) }
}

async function main() {
  console.log('=== 专项回归：金币单次入账 ===')
  {
    g.getState().startRun()
    // 直接构造一场战斗并胜利
    const st = g.getState()
    const r = st.run
    r.combat = startCombat(r, '测试', ['jawWorm'], false, false)
    r.screen = 'combat'
    useGame.setState({ run: r })
    const gold0 = g.getState().run.gold
    const reward0 = g.getState().run.combat.goldReward
    // 击杀敌人
    const run = g.getState().run
    run.combat.enemies[0].hp = 1
    g.getState().playCard(
      g.getState().run.combat && AP(g.getState().run.combat).hand.find((c: any) => CARDS[c.id].type === 'attack')!.uid,
      g.getState().run.combat.enemies[0].uid
    )
    // 等待胜利横幅结算
    await sleep(2200)
    const st1 = g.getState()
    check('胜利后未自动加金币', st1.run.gold === gold0, `gold ${gold0} -> ${st1.run.gold}`)
    check('进入奖励界面', st1.run.screen === 'reward')
    st1.takeGold()
    const st2 = g.getState()
    check('点击领取后金币单次入账', st2.run.gold === gold0 + reward0, `expect ${gold0 + reward0}, got ${st2.run.gold}`)
  }

  console.log('=== 专项回归：药水墨牌 0 费 ===')
  {
    const run = newRun()
    const combat = startCombat(run, '测试', ['jawWorm'], false, false)
    // 模拟技能药水给牌：一张 2 费牌设为 freeThisTurn
    const freeCard = makeCard('entrench')  // 2 费技能（无回能量效果）
    freeCard.freeThisTurn = true
    AP(combat).hand.push(freeCard)
    const e0 = AP(combat).energy
    const chk = canPlayCard(combat, run, freeCard)
    check('freeThisTurn 卡在 0 能量时可打出', chk.ok)
    AP(combat).energy = 0
    const chk2 = canPlayCard(combat, run, freeCard)
    check('freeThisTurn 卡能量检查按 0 费', chk2.ok)
    AP(combat).energy = e0
    playCard(combat, run, freeCard.uid, null)
    check('打出 freeThisTurn 卡不扣能量', AP(combat).energy === e0, `energy ${e0} -> ${AP(combat).energy}`)
  }

  console.log('=== 专项回归：Artifact 反制 debuff ===')
  {
    const run = newRun()
    const combat = startCombat(run, '测试', ['jawWorm'], false, false)
    AP(combat).statuses.artifact = 1
    applyStatus(combat, 'player', 'vulnerable', 2)
    check('反制了易伤（原 bug：不反制正值 debuff）', AP(combat).statuses.vulnerable === undefined)
    check('反制层数消耗', AP(combat).statuses.artifact === undefined)
    applyStatus(combat, 'player', 'strength', 2)
    check('力量增益不被反制', AP(combat).statuses.strength === 2)
    combat.enemies[0].statuses.artifact = 1
    applyStatus(combat, combat.enemies[0], 'vulnerable', 2)
    check('敌人 artifact 也正确反制', combat.enemies[0].statuses.vulnerable === undefined)
  }

  console.log('=== 专项回归：意图伤害实时计算 ===')
  {
    const run = newRun()
    const combat = startCombat(run, '测试', ['cultist'], false, false)
    const e = combat.enemies[0]
    // 找到攻击意图（cultist 第二招是攻击，或直接构造）
    e.intent = { type: 'attack', damage: 6, times: 1 }
    const before = enemyDisplayDamage(e, AP(combat).statuses).dmg
    applyStatus(combat, e, 'weak', 1)  // 敌人虚弱 → 伤害降
    const after = enemyDisplayDamage(e, AP(combat).statuses).dmg
    check('施加虚弱后意图伤害实时下降', after < before, `${before} -> ${after}`)
    applyStatus(combat, 'player', 'vulnerable', 1)  // 玩家易伤 → 伤害升
    const after2 = enemyDisplayDamage(e, AP(combat).statuses).dmg
    check('玩家易伤后意图伤害实时上升', after2 > after, `${after} -> ${after2}`)
  }

  console.log('=== 专项回归：奖励单卡锁定 ===')
  {
    g.getState().startRun()
    const run = g.getState().run
    run.reward = { gold: 10, cards: ['bash', 'cleave'], taken: [] }
    run.screen = 'reward'
    useGame.setState({ run })
    const st = g.getState()
    const deck0 = st.run.deck.length
    st.takeCard('bash')
    check('选第一张成功', g.getState().run.deck.length === deck0 + 1)
    st.takeCard('cleave')
    check('第二张被锁定拒绝', g.getState().run.deck.length === deck0 + 1)
  }

  console.log('=== 专项回归：地图药水使用 ===')
  {
    g.getState().startRun()
    const run = g.getState().run
    run.potions[0] = 'bloodPotion'
    run.hp = 30
    useGame.setState({ run })
    g.getState().usePotionMap(0)
    const st = g.getState()
    check('血瓶地图使用生效', st.run.hp === 45 && st.run.potions[0] === null, `hp ${st.run.hp}`)
    // 战斗型药水在地图提示
    const run2 = st.run
    run2.potions[1] = 'firePotion'
    useGame.setState({ run: run2 })
    g.getState().usePotionMap(1)
    check('火焰药水地图使用被拦截', g.getState().run.potions[1] === 'firePotion')
  }

  console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
  if (fail > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
