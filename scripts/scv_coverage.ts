// 第三十批预研：统计我们卡池 → 原版 1024Portraits 的覆盖度
// 输出映射表 id -> 原版路径（snake_case by nameEn）+ 缺失清单
import { CARDS } from '../src/game/cards'
import { writeFileSync } from 'fs'

const DIR = '/tmp/MySlayTheSpire/src/main/resources/images/1024Portraits'
const existsSync = (() => {
  // bun: use fs
  const { existsSync: e } = require('fs')
  return e
})()

function snake(nameEn: string): string {
  return nameEn
    .replace(/['’,]/g, '')
    .replace(/\+/g, 'Plus')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
}

const colors: Record<string, string> = { red: 'red', green: 'green', blue: 'blue', purple: 'purple', colorless: 'colorless' }
const types: Record<string, string> = { attack: 'attack', skill: 'skill', power: 'power' }

const mapping: Record<string, string> = {}
const missing: string[] = []

for (const [id, def] of Object.entries(CARDS)) {
  const color = colors[def.color || 'red'] || 'colorless'
  const type = types[def.type] || 'skill'
  const sn = snake(def.nameEn)
  const cands = [
    `${DIR}/${color}/${type}/${sn}.png`,
    // 令牌/状态/诅咒可能在 colorless
    `${DIR}/colorless/${type}/${sn}.png`,
    `${DIR}/status/${type}/${sn}.png`,
    `${DIR}/curse/${type}/${sn}.png`,
    // 升级版卡名（如 Strike+ 在原版是同文件）
  ]
  let found = cands.find(c => existsSync(c))
  if (!found) {
    // 试其它 type 目录（原版个别卡目录与实际 type 不同）
    for (const t2 of ['attack', 'skill', 'power']) {
      for (const c2 of [color, 'colorless', 'status', 'curse']) {
        const p = `${DIR}/${c2}/${t2}/${sn}.png`
        if (existsSync(p)) { found = p; break }
      }
      if (found) break
    }
  }
  if (found) mapping[id] = found.replace(DIR + '/', '').replace('.png', '')
  else missing.push(`${id} (${def.nameEn}, ${def.color || 'red'}/${def.type})`)
}

writeFileSync('/home/z/my-project/scripts/scv_map.json', JSON.stringify(mapping, null, 1))
console.log(`总卡数: ${Object.keys(CARDS).length}`)
console.log(`命中: ${Object.keys(mapping).length}`)
console.log(`缺失: ${missing.length}`)
console.log(missing.join('\n'))
