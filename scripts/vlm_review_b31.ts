// 第三十一批 VLM 视觉验收：商店（全屏地毯/价格/特卖标签/移除服务/商人手/对话气泡）+ 宝箱（三档图/开箱）双版本
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
  const dir = '/home/z/my-project/scripts/study/batch31'
  const q = `这是网页复刻游戏《杀戮尖塔1》简中版的「商店」与「宝箱」界面截图（6张：①商店全景 ②商店hover一张卡+对话气泡 ③宝箱关闭态 ④宝箱开启态 ⑤/⑥同场景另一版本）。原版商店是商人摊位：全屏波斯地毯背景，上方一排待售卡牌，下方遗物与药水，右侧"移除一张牌"服务（拿剪刀的图牌）。请逐项检查并简短回答（每项"符合/不符合+一句原因"）：
1. 商店是否为全屏地毯背景（非纯色/渐变），地毯上有待售卡牌一排，卡牌下方有金币图标+数字价格？
2. 价格颜色是否有区分（可买白色/买不起橙红/特卖天蓝）？是否有一张卡右上角挂着黄色"特卖"标签？
3. 是否能看到"移除一张牌"服务图（原版为拿剪刀的紫色图牌+价格），以及画面底部边缘是否有从下方伸出的商人手（hover 卡牌时手会移动跟随）？
4. 图②中是否有白色对话气泡（带尾巴、内有商人台词文字）？位置是否自然不遮挡商品？
5. 宝箱图③：是否显示一个木质宝箱（图鉴风格），位于画面中右部？图④开箱后：宝箱变为打开状态（箱盖敞开露出内部），是否展示获得的遗物图标（带光晕）与名称描述？
6. 商店/宝箱界面有无破图、错位、文字模糊或明显不协调之处？顶栏HUD是否常驻完整？`

  const a1 = await ask([
    `${dir}/next_shop_full.png`, `${dir}/next_shop_hover_bubble.png`,
    `${dir}/next_treasure.png`, `${dir}/next_treasure_opened.png`,
    `${dir}/standalone_shop_full.png`, `${dir}/standalone_treasure.png`,
  ], q)
  console.log('=== 双版本综合 ===')
  console.log(a1)
}

main().catch(e => { console.error(e); process.exit(1) })
