// 第二十三批 VLM 视觉验收：顶栏常态/金币三态/VFX/篝火屏（双版本）
import ZAI from 'z-ai-web-dev-sdk'
import { readFileSync } from 'fs'

const ask = async (imgs: string[], q: string): Promise<string> => {
  const zai = await (ZAI as any).create()
  const content: any[] = imgs.map(p => ({
    type: 'image_url',
    image_url: { url: `data:image/png;base64,${readFileSync(p).toString('base64')}` },
  }))
  content.push({ type: 'text', text: q })
  const r = await zai.chat.completions.createVision({ messages: [{ role: 'user', content }] })
  return (r as any).choices?.[0]?.message?.content ?? JSON.stringify(r).slice(0, 400)
}

async function main() {
  const dir = 'scripts/study/b23'
  const q = `这是网页复刻游戏《杀戮尖塔1》的顶栏（原版 TopPanel）截图，两版本（Next.js 与单文件 HTML）。请逐项检查并简短回答（每项"符合/不符合+一句原因"）：
1. 顶栏是否有横贯顶部的深色底板(bar)？
2. 左起是否有：白色角色名+灰色英文小称号、红粉色心形图标+血量文字、钱袋图标+金币数字、带边框的药水槽（3槽）、旗帜图标+层数、遗物图标行？
3. 图2中鼠标悬停血量区域时，心形图标是否放大（约1.2倍）？
4. 图3中金币数字是否呈红色（花费过程）？
5. 图4中设置齿轮是否处于定格状态（非旋转模糊）？
6. 图5（战斗能量球附近）是否有红色旋转光效（VFX 双图）？
7. 图7（篝火屏）顶部是否也有同样的顶栏（bar+心+血量）？
8. 是否有任何破图、错位、文字重叠或明显不协调？`
  const a1 = await ask([`${dir}/next_1_topbar_map.png`, `${dir}/next_2_hover_hp.png`, `${dir}/next_3_gold_red.png`, `${dir}/next_4_gear_hover.png`, `${dir}/next_5_energy_vfx.png`, `${dir}/next_7_rest_topbar.png`], q)
  console.log('=== Next.js 版 ===')
  console.log(a1)
  const a2 = await ask([`${dir}/standalone_1_topbar_map.png`, `${dir}/standalone_2_hover_hp.png`, `${dir}/standalone_3_gold_red.png`, `${dir}/standalone_4_gear_hover.png`, `${dir}/standalone_5_energy_vfx.png`, `${dir}/standalone_7_rest_topbar.png`], q)
  console.log('=== standalone 版 ===')
  console.log(a2)
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
