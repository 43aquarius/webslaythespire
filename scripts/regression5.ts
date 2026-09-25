// 第五批机制修复专项回归：涅奥四槽/药水递变/稀有度偏移/Boss奖励/商店/诅咒/涅奥哀歌
import { useGame } from '../src/store/gameStore'
import { CARDS, makeCard } from '../src/game/cards'
import { startCombat, AP, endPlayerTurn } from '../src/game/engine'
import { newRun, makeNeowOptions, makeShop, makeCombatReward, neowOfferCards, weightedPotionPick } from '../src/game/run'
import { ENEMIES } from '../src/game/enemies'
import { POTIONS } from '../src/game/potions'
import { RunState, CharacterId } from '../src/game/types'

const g = useGame as any
let pass = 0, fail = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${detail}`) }
}

function freshRun(char: CharacterId = 'ironclad'): RunState {
  const r = newRun(char)
  r.screen = 'map'
  return r
}

async function main() {
  console.log('=== 涅奥四槽结构 ===')
  {
    let sawSwap = 0, sawLament = 0, sawTrade = 0, sawFirst = 0
    for (let i = 0; i < 60; i++) {
      const opts = makeNeowOptions('ironclad')
      check(`四槽数量 (${i})`, opts.length === 4)
      if (opts[3].effect === 'bossSwap') sawSwap++
      if (opts[1].effect === 'neowLament') sawLament++
      if (opts[2].effect === 'tradeoff') sawTrade++
      if (opts[0].id.startsWith('n1_')) sawFirst++
      // 第三祝福配对例外
      if (opts[2].effect === 'tradeoff') {
        const { disadvantage: d, advantage: a } = opts[2]
        check(`配对例外 (${i})`, !((d === 'curseCard' && a === 'removeCard2') || (d === 'loseGold' && a === 'gold') || (d === 'loseMaxHp' && a === 'gainMaxHp')), `${d}+${a}`)
      }
    }
    check('第四槽恒为Boss交换', sawSwap === 60, `${sawSwap}/60`)
    check('第一槽来自卡牌池', sawFirst === 60, `${sawFirst}/60`)
    check('第三槽均为代价祝福', sawTrade === 60, `${sawTrade}/60`)
    check('涅奥哀歌有出现概率(随机)', sawLament > 0 && sawLament < 60, `${sawLament}/60`)
  }

  console.log('=== 涅奥哀歌：敌人1血开始 ===')
  {
    const r = freshRun()
    r.neowLament = 2
    r.combat = startCombat(r, '测试', ['jawWorm'], false, false)
    check('哀歌战斗敌人1血', r.combat.enemies[0].hp === 1, `hp=${r.combat.enemies[0].hp}`)
    check('哀歌计数递减', r.neowLament === 1, `left=${r.neowLament}`)
    r.combat.enemies[0].hp = 30
    r.combat = null
    const c2 = startCombat(r, '测试2', ['jawWorm'], false, false)
    check('第二场哀歌仍1血', c2.enemies[0].hp === 1)
    check('计数归零', (r.neowLament ?? 0) === 0)
    const c3 = startCombat(r, '测试3', ['jawWorm'], false, false)
    check('哀歌结束后正常血量', c3.enemies[0].hp > 1)
  }

  console.log('=== 药水掉率递变制 ===')
  {
    const r = freshRun()
    check('初始掉率40%', r.potionLuck === 0.4, `${r.potionLuck}`)
    r.combat = startCombat(r, 'a', ['jawWorm'], false, false)
    const after1 = r.potionLuck
    check('首战后掉率变化(0.3或0.5)', after1 === 0.3 || after1 === 0.5, `${after1}`)
    // 模拟未掉：+10%
    r.potionLuck = 0.4
    r.combat = null
    let dropped = 0, notDropped = 0
    for (let i = 0; i < 200; i++) {
      r.potionLuck = 0.4
      startCombat(r, 'x', ['jawWorm'], false, false)
      if (r.potionLuck < 0.4) dropped++; else notDropped++
    }
    check('掉率围绕40%波动', dropped > 60 && dropped < 100 && notDropped > 60 && notDropped < 140, `drop=${dropped} miss=${notDropped}`)
  }

  console.log('=== 卡牌稀有度偏移系统 ===')
  {
    const r = freshRun()
    check('偏移计数初始为0', r.rarePity === 0)
    // 无偏移时首层必无稀有（3%-5%<0）
    let rareFirst = 0
    for (let i = 0; i < 100; i++) {
      r.rarePity = 0
      const rw = makeCombatReward(r, false, false)
      if (rw.cards?.some(id => CARDS[id].rarity === 'rare')) rareFirst++
    }
    check('零偏移时不出稀有卡(原版-5%起步)', rareFirst === 0, `${rareFirst}/100`)
    // 偏移足够大时必出稀有
    let rareHigh = 0
    for (let i = 0; i < 100; i++) {
      r.rarePity = 10  // 3%-5%+10% = 8%
      const rw = makeCombatReward(r, false, false)
      if (rw.cards?.some(id => CARDS[id].rarity === 'rare')) rareHigh++
    }
    check('偏移10时稀有概率提升', rareHigh > 10, `${rareHigh}/100`)
  }

  console.log('=== Boss 奖励对照原版 ===')
  {
    const r = freshRun()
    r.combat = startCombat(r, 'boss', ['slimeBoss'], false, true)
    const rw = makeCombatReward(r, false, true)
    check('Boss(1幕)给3张稀有卡', (rw.cards?.length ?? 0) === 3 && rw.cards!.every(id => CARDS[id].rarity === 'rare'), JSON.stringify(rw.cards))
    check('Boss金币在95-105', rw.gold !== undefined && rw.gold >= 95 && rw.gold <= 105, `${rw.gold}`)
    // 幕2
    r.act = 2
    const rw2 = makeCombatReward(r, false, true)
    check('Boss(2幕)仍给稀有卡', (rw2.cards?.length ?? 0) === 3 && rw2.cards!.every(id => CARDS[id].rarity === 'rare'))
    // 幕3/4 Boss：无金币/卡牌/药水
    r.act = 3
    const rw3 = makeCombatReward(r, false, true)
    check('Boss(3幕)无金币无卡牌无药水', rw3.gold === undefined && rw3.cards === undefined && rw3.potion === undefined, JSON.stringify({ gold: rw3.gold, cards: rw3.cards, potion: rw3.potion }))
    // 金币无幕数缩放
    r.act = 1
    const r2 = freshRun()
    r2.combat = startCombat(r2, 'n', ['jawWorm'], false, false)
    const g1 = makeCombatReward(r2, false, false).gold
    r2.act = 3
    r2.combat = startCombat(r2, 'n', ['jawWorm'], false, false)
    const g3 = makeCombatReward(r2, false, false).gold
    check('普通战斗金币无幕数缩放', Math.abs(g1 - g3) <= 10, `act1=${g1} act3=${g3}`)
  }

  console.log('=== 商店对照原版 ===')
  {
    for (let t = 0; t < 10; t++) {
      const r = freshRun(['ironclad', 'silent', 'defect', 'watcher'][t % 4] as CharacterId)
      const shop = makeShop(r)
      const types = shop.cards.map(c => CARDS[c.cardId].type)
      check(`2攻2技1能 (${t})`, types.filter(x => x === 'attack').length === 2 && types.filter(x => x === 'skill').length === 2 && types.filter(x => x === 'power').length === 1, types.join(','))
      check(`恰好一张5折卡 (${t})`, shop.cards.filter(c => c.discount).length === 1)
      const disc = shop.cards.find(c => c.discount)!
      // 折扣价为原价一半：原价必在其稀有度区间内 → 折扣价 ≤ 区间上限/2
      const rarMax = { common: 55, uncommon: 83, rare: 165 }[CARDS[disc.cardId].rarity] ?? 165
      check(`折扣为半价 (${t})`, disc.price >= 1 && disc.price * 2 <= rarMax + 1 && disc.price * 2 >= 45 - 1, `price=${disc.price} rar=${CARDS[disc.cardId].rarity}`)
      check(`移除服务75起 (${t})`, shop.removalPrice === 75)
      for (const it of shop.relics) {
        // 价格按稀有度分档（143-158 / 238-263）
        const ok = (it.price >= 143 && it.price <= 158) || (it.price >= 238 && it.price <= 263)
        check(`遗物价格分档 ${it.relicId} (${t})`, ok, `${it.price}`)
      }
      for (const it of shop.potions) {
        const rar = POTIONS[it.potionId].rarity
        const ok = rar === 'common' ? (it.price >= 48 && it.price <= 53) : rar === 'uncommon' ? (it.price >= 71 && it.price <= 79) : (it.price >= 95 && it.price <= 105)
        check(`药水价格分档 ${it.potionId} (${t})`, ok, `${rar} ${it.price}`)
      }
    }
  }

  console.log('=== 药水稀有度权重 65/25/10 ===')
  {
    const cnt: Record<string, number> = { common: 0, uncommon: 0, rare: 0 }
    for (let i = 0; i < 2000; i++) {
      cnt[POTIONS[weightedPotionPick()].rarity]++
    }
    check('普通≈65%', Math.abs(cnt.common / 2000 - 0.65) < 0.06, `${(cnt.common / 20).toFixed(1)}%`)
    check('罕见≈25%', Math.abs(cnt.uncommon / 2000 - 0.25) < 0.06, `${(cnt.uncommon / 20).toFixed(1)}%`)
    check('稀有≈10%', Math.abs(cnt.rare / 2000 - 0.10) < 0.05, `${(cnt.rare / 20).toFixed(1)}%`)
  }

  console.log('=== 诅咒牌：懊悔/疑虑回合结束触发 ===')
  {
    const r = freshRun()
    r.combat = startCombat(r, 'curse', ['jawWorm'], false, false)
    const c = r.combat
    // 回合开始会抽牌，先结束那个回合进入稳定回合
    endPlayerTurn(c, r)
    // 玩家回合开始
    const P = AP(c)
    const hp0 = r.hp
    // 手动放懊悔+疑虑到手牌（保留至回合结束）
    P.hand = [makeCard('regret'), makeCard('strike')]
    endPlayerTurn(c, r)
    // 懊悔：手牌数2 × 1张懊悔 = 2点伤害
    check('懊悔造成手牌数伤害', r.hp === hp0 - 2, `${hp0} -> ${r.hp}`)
    const hp1 = r.hp
    // 疑虑：+1虚弱
    AP(c).hand = [makeCard('doubt')]
    endPlayerTurn(c, r)
    check('疑虑施加1层虚弱', (AP(c).statuses.weak ?? 0) === 1, `weak=${AP(c).statuses.weak}`)
  }

  console.log('=== Boss战后回复全部已损失生命(单人) + 第4幕直胜 ===')
  {
    // 幕1 Boss：胜利后满血进奖励界面
    g.getState().startRun()
    let st = g.getState()
    let r = st.run
    r.hp = Math.floor(r.maxHp * 0.2)
    r.act = 1
    r.combat = startCombat(r, 'boss', ['gremlinNob'], false, true)
    r.screen = 'combat'
    useGame.setState({ run: r })
    r.combat.enemies[0].hp = 1
    const atk = AP(r.combat).hand.find((c: any) => CARDS[c.id].type === 'attack')!
    g.getState().playCard(atk.uid, r.combat.enemies[0].uid)
    await new Promise(res => setTimeout(res, 2300))
    st = g.getState()
    check('幕1Boss胜利后回复满血', st.run.hp === st.run.maxHp, `${st.run.hp}/${st.run.maxHp}`)
    check('幕1Boss进奖励界面', st.run.screen === 'reward', st.run.screen)
    check('幕1Boss奖励含3稀有卡', (st.run.reward?.cards?.length ?? 0) === 3)

    // 第4幕 Boss（腐朽之心）：直接胜利
    st = g.getState()
    r = st.run
    r.reward = null
    r.combat = null
    r.hp = Math.floor(r.maxHp * 0.2)
    r.act = 4
    r.combat = startCombat(r, 'heart', ['corruptHeart'], false, true)
    r.screen = 'combat'
    useGame.setState({ run: r })
    r.combat.enemies[0].hp = 1
    const atk2 = AP(r.combat).hand.find((c: any) => CARDS[c.id].type === 'attack')!
    g.getState().playCard(atk2.uid, r.combat.enemies[0].uid)
    await new Promise(res => setTimeout(res, 2300))
    st = g.getState()
    check('第4幕Boss直接胜利', st.run.screen === 'victory', st.run.screen)
    check('第4幕Boss无奖励界面', st.run.reward === null)
  }

  console.log('=== 涅奥祝福选项：gainCard 提供3张卡 ===')
  {
    for (const ch of ['ironclad', 'silent', 'defect', 'watcher'] as CharacterId[]) {
      for (let i = 0; i < 20; i++) {
        const ids = neowOfferCards(ch, false)
        check(`普通三选一 (${ch})`, ids.length === 3 && ids.every(id => CARDS[id]), ids.join(','))
        const rids = neowOfferCards(ch, true)
        check(`稀有三选一 (${ch})`, rids.length === 3 && rids.every(id => CARDS[id].rarity === 'rare'), rids.join(','))
      }
    }
  }

  console.log('=== 旧存档兼容 ===')
  {
    // 旧存档没有 rarePity/potionLuck 字段 → 默认值兜底
    const r = newRun('ironclad')
    delete (r as any).rarePity
    delete (r as any).potionLuck
    r.combat = startCombat(r, 'old', ['jawWorm'], false, false)
    check('旧存档药水掉率兜底', r.potionLuck === 0.3 || r.potionLuck === 0.5, `${r.potionLuck}`)
    const rw = makeCombatReward(r, false, false)
    check('旧存档奖励生成正常', !!rw.cards && rw.cards.length === 3)
  }

  console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
