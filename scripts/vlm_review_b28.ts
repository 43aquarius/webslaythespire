// 第二十八批 VLM 视觉验收：原版 ZHS 字体 NotoSansMonoCJKsc（黑体等宽）全局观感（双版本）
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
  const dir = '/tmp/font_pilot'
  const q = `这是网页复刻游戏《杀戮尖塔1》简中版的截图（3张：标题屏、战斗屏、卡牌特写）。游戏本次把全局字体替换为原版简中版字体 NotoSansMonoCJKsc（黑体/无衬线等宽，数字与字母为汉字一半宽度的等宽风格，原版观感）。请逐项检查并简短回答（每项"符合/不符合+一句原因"）：
1. 全部中文文字是否为黑体/无衬线风格（笔画均匀、无衬线脚），而不是宋体（横细竖粗带衬线脚）？
2. 卡牌名称、卡牌描述文字是否清晰锐利、大小协调、无溢出或截断？
3. 顶栏的血量数字、金币数字、层数数字是否清晰可读、风格统一？
4. 数字/英文字母是否呈现等宽排版特征（宽度一致、对齐整齐）？
5. 标题屏的主标题与按钮文字是否协调（黑体、无破图）？
6. 是否有任何文字重叠、模糊、破图或明显不协调之处？`
  const a1 = await ask([`${dir}/b28_next_title.png`, `${dir}/b28_next_combat.png`, `${dir}/b28_next_card.png`], q)
  console.log('=== Next.js 版 ===')
  console.log(a1)
  const a2 = await ask([`${dir}/b28_standalone_title.png`, `${dir}/b28_standalone_combat.png`, `${dir}/b28_standalone_card.png`], q)
  console.log('=== standalone 版 ===')
  console.log(a2)
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
