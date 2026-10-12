// VLM 终验奖励屏最终截图
import ZAI from 'z-ai-web-dev-sdk'
import { readFileSync } from 'fs'
async function main() {
  const zai = await (ZAI as any).create()
  const content: any[] = [{ type: 'image_url', image_url: { url: `data:image/png;base64,${readFileSync('scripts/study/batch36/10_reward_final.png').toString('base64')}` } }]
  content.push({ type: 'text', text: `这是网页复刻《杀戮尖塔1》的战斗奖励屏截图。请检查：1) 是否有三张奖励卡牌且卡面插画清晰可见？2) 是否有金币与药水奖励？3) 有无破图/黑屏/错位/报错红字？4) 卡面插画（猛击/旋风斩/防御）是否符合一代手绘暗黑风而非二代2025高饱和3D风？逐项简短回答。` })
  const r = await zai.chat.completions.createVision({ messages: [{ role: 'user', content }] })
  console.log((r as any).choices?.[0]?.message?.content ?? JSON.stringify(r).slice(0, 300))
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
