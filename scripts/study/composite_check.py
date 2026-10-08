#!/usr/bin/env python3
"""按浏览器层序合成卡牌，并与真实截图对比，定位错位来源"""
from PIL import Image

A = '/home/z/my-project/public/assets'

# 层序与 CardView.tsx 一致: bg -> art -> frame -> banner -> orb
bg     = Image.open(f'{A}/frames/bgAttackRed.png').convert('RGBA')
art    = Image.open(f'{A}/cardart/strike.webp').convert('RGBA')
frame  = Image.open(f'{A}/frames/frameAttackCommon.png').convert('RGBA')
banner = Image.open(f'{A}/frames/bannerCommon.png').convert('RGBA')
orb    = Image.open(f'{A}/frames/cardRedOrb.png').convert('RGBA')

canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
for layer in [bg, art, frame, banner, orb]:
    canvas.alpha_composite(layer)
canvas.save('/home/z/my-project/scripts/study/composite_512.png')

# 放大到与浏览器卡牌相同的渲染尺寸 (宽168 -> 512画布盒宽 168*512/299=287.7 -> 卡体在画布内 106..405)
big = canvas.resize((599, 599), Image.LANCZOS)  # 2倍便于观察
big.save('/home/z/my-project/scripts/study/composite_big.png')

# 分别导出 frame 与 art 的可见内容叠加图（红x标记art bbox, 蓝框标记frame bbox）
print("art 内容bbox: (131,99,381,289) -> 250x190")
print("frame 内容bbox: (125,108,387,292)")
print("frame 内容中心: (%d, %d)  art 中心: (%d, %d)" % ((125+387)/2, (108+292)/2, (131+381)/2, (99+289)/2))

# frameAttackRare 损坏检查
import os
for f in os.listdir(f'{A}/frames'):
    if f.startswith('frame') and f.endswith('.png'):
        im = Image.open(f'{A}/frames/{f}').convert('RGBA')
        bbox = im.getchannel('A').point(lambda p: 255 if p > 30 else 0).getbbox()
        if bbox is None:
            print(f"!! 全透明损坏: {f}")
