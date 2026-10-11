// 第三十批 VLM 视觉验收：检视屏（SingleCardViewPopup 原版复刻）双版本四场景
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
  const dir = '/home/z/my-project/scripts/study/batch30'
  const q = `这是网页复刻游戏《杀戮尖塔1》简中版「检视屏」（点击牌堆中的卡牌弹出的全屏大卡，原版 SingleCardViewPopup）的截图（4张：①普通卡检视 ②勾选"看升级版"后 ③诅咒卡 ④带关键词提示的卡）。请逐项检查并简短回答（每项"符合/不符合+一句原因"）：
1. 大卡是否完整显示：卡面底板、高清插画、边框、顶部名字横幅、左上角能量宝珠与数字，各层无错位破图？
2. 卡名字号是否明显大于手牌卡、清晰锐利，位于横幅带上且不溢出？
3. 卡面下方是否有灰色"攻击/技能/能力"类型文字与白色描述文字，两者不重叠、不溢出卡面？
4. 图②勾选升级版后：卡名是否变绿色、描述中的数值是否变绿色、底部是否出现打勾的复选框与"看升级版"文字？
5. 图③诅咒卡：是否为深色卡面、无能量宝珠、底部无"看升级版"复选框？
6. 图④右侧是否出现关键词提示面板（深色底金标题），与大卡不重叠？
7. 大卡左右是否有装饰性箭头（翻页），黑色背景是否居中遮挡了后面的牌堆网格？
8. 任何文字模糊、图层错位、破图或明显不协调之处？`
  const a1 = await ask([`${dir}/scv_base_next.png`, `${dir}/scv_upgrade_next.png`, `${dir}/scv_curse_next.png`, `${dir}/scv_tips_next.png`], q)
  console.log('=== Next.js 版 ===')
  console.log(a1)
  const a2 = await ask([`${dir}/scv_base_standalone.png`, `${dir}/scv_upgrade_standalone.png`, `${dir}/scv_curse_standalone.png`, `${dir}/scv_tips_standalone.png`], q)
  console.log('=== standalone 版 ===')
  console.log(a2)
}

main().catch(e => { console.error(e); process.exit(1) })
