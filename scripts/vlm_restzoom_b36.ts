// 放大核查休息屏"搜索框"疑点
import ZAI from 'z-ai-web-dev-sdk'
import { readFileSync } from 'fs'
async function main() {
  const zai = await (ZAI as any).create()
  const ask = async (img: string, q: string) => {
    const content: any[] = [{ type: 'image_url', image_url: { url: `data:image/png;base64,${readFileSync(img).toString('base64')}` } }]
    content.push({ type: 'text', text: q })
    const r = await zai.chat.completions.createVision({ messages: [{ role: 'user', content }] })
    return (r as any).choices?.[0]?.message?.content ?? JSON.stringify(r).slice(0, 300)
  }
  console.log('--- 休息屏搜索框疑点 ---')
  console.log(await ask('scripts/study/batch36/sa_04_rest.png', `这张《杀戮尖塔》网页复刻的休息屏截图中，你之前提到"搜索框"。请精确描述：1) 这个搜索框在屏幕什么位置？2) 里面有什么内容/文字？3) 它是游戏本体UI还是某个悬浮小部件（如音乐播放器）的一部分？简短回答。`))
}
main().catch(e => { console.error('FATAL', e); process.exit(2) })
