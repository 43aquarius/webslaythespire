// 验证 trackForScreen 场景→曲目映射
import { trackForScreen } from '../src/game/music'

const cases: Array<[string, any, string, string]> = [
  ['title', null, 'menu', '标题→菜单曲'],
  ['map', null, 'level', '地图→第一幕主题'],
  ['combat', { isBoss: false, isElite: false }, 'level', '普通战斗→延续第一幕(原版行为)'],
  ['combat', { isBoss: false, isElite: true }, 'elite', '精英战斗→精英曲'],
  ['combat', { isBoss: true, isElite: false }, 'boss', 'Boss战斗→Boss曲'],
  ['shop', null, 'merchant', '商店→商人曲'],
  ['event', null, 'shrine', '事件→圣坛曲'],
  ['rest', null, 'level', '篝火→第一幕主题'],
  ['treasure', null, 'level', '宝箱→第一幕主题'],
  ['reward', null, 'level', '奖励→第一幕主题'],
  ['bossRelic', null, 'credits', 'Boss遗物→结算曲'],
  ['victory', null, 'credits', '胜利→结算曲'],
]

let fail = 0
for (const [screen, combat, want, name] of cases) {
  const got = trackForScreen(screen, combat)
  const ok = got === want
  if (!ok) fail++
  console.log(`  ${ok ? '✓' : '✗'} ${name}: ${got}${ok ? '' : ` (期望 ${want})`}`)
}
console.log(fail === 0 ? '全部通过' : `${fail} 项失败`)
process.exit(fail === 0 ? 0 : 1)
