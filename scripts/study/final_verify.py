#!/usr/bin/env python3
"""终极验证：我们的512合成 vs wiki官方comp —— 变形到同一坐标系后逐像素对比
输出区域色差热力图，直接指出哪个区域不匹配"""
from PIL import Image
import numpy as np

OUT = '/home/z/my-project/scripts/study'
ASSETS = '/home/z/my-project/public/assets'

comp = Image.open(f'{OUT}/Red-Bash.png').convert('RGBA')
C = np.array(comp).astype(int)
a = C[:, :, 3] > 200
ys, xs = np.where(a)
bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()

# 我们的合成（art在131,99 —— 与浏览器渲染一致）
ours = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
ours.alpha_composite(Image.open(f'{ASSETS}/frames/bgAttackRed.png').convert('RGBA'))
a512 = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
art = Image.open(f'{OUT}/wiki_art_bash.png').convert('RGBA')
a512.paste(art.resize((250, 190), Image.LANCZOS), (131, 99))
ours.alpha_composite(a512)
ours.alpha_composite(Image.open(f'{ASSETS}/frames/frameAttackCommon.png').convert('RGBA'))
ours.alpha_composite(Image.open(f'{ASSETS}/frames/bannerCommon.png').convert('RGBA'))
ours.alpha_composite(Image.open(f'{ASSETS}/frames/cardRedOrb.png').convert('RGBA'))

# 把512合成拉伸到comp卡体bbox
sx = (bx1-bx0)/297.0; sy = (by1-by0)/418.0
O = ours.resize((int(512*sx), int(512*sy)), Image.LANCZOS)
# 卡体原点(107,47)在comp中 = (bx0-107*sx, by0-47*sy)
ox, oy = int(round(bx0-107*sx)), int(round(by0-47*sy))
canvas = Image.new('RGBA', (comp.width, comp.height), (0, 0, 0, 255))
canvas.paste(O, (ox, oy), O)
Oa = np.array(canvas).astype(int)

# 对比区域: art窗口附近的带状区 y[80..300]comp比例(即卡体上1/3)
# 用块级(16px)色差
H, W = C.shape[:2]
blk = 16
rows = []
print("区域色差图 (每格=16x16px块的均差, ▓>40 ■>25 ▨>12 ▒>6 ·<=6, 空=透明区未比)")
for by in range(oy+int(60*sy*0.48), min(H, oy+int(300*2.07)), blk):
    line = ''
    valid = 0
    for bx in range(ox+int(20*sx), min(W, ox+int(280*sx)), blk):
        A = C[by:by+blk, bx:bx+blk]
        B = Oa[by:by+blk, bx:bx+blk]
        ma = A[:, :, 3] > 150
        mb = B[:, :, 3] > 150
        both = ma & mb
        if both.sum() < blk*blk*0.3:
            line += ' '
            continue
        valid += 1
        d = np.abs(A[:, :, :3][both] - B[:, :, :3][both]).mean()
        ch = '·'
        if d > 6: ch = '▒'
        if d > 12: ch = '▨'
        if d > 25: ch = '■'
        if d > 40: ch = '▓'
        line += ch
    if valid:
        rows.append((by, line))
for by, line in rows[:40]:
    print(f"y={by:4d} {line}")

# 统计
tot = same = 0
diffs = []
for by in range(oy, min(H, oy+int(419*sy)), 8):
    for bx in range(ox, min(W, ox+int(297*sx)), 8):
        A = C[by:by+8, bx:bx+8]; B = Oa[by:by+8, bx:bx+8]
        ma = A[:, :, 3] > 150; mb = B[:, :, 3] > 150
        both = ma & mb
        if both.sum() < 32: continue
        d = np.abs(A[:, :, :3][both] - B[:, :, :3][both]).mean()
        tot += 1
        if d < 10: same += 1
        diffs.append((d, bx, by))
diffs.sort(reverse=True)
print(f"\n匹配块(色差<10): {same}/{tot} = {same/tot:.0%}")
print("最差20块(色差, 位置comp坐标, 位置512画布):")
for d, bx, by in diffs[:20]:
    x512 = 107 + (bx-ox)/sx; y512 = 47 + (by-oy)/sy
    print(f"  {d:5.1f}  comp({bx},{by})  512({x512:.0f},{y512:.0f})")

canvas.convert('RGB').save(f'{OUT}/overlay_on_comp.png')
# 左右并排: wiki comp | 我们(变形后)
side = Image.new('RGB', (comp.width*2+20, comp.height), (25, 25, 25))
side.paste(comp.convert('RGB'), (0, 0))
side.paste(canvas.convert('RGB'), (comp.width+20, 0))
side.save(f'{OUT}/side_by_side.png')
print("\n并排图 -> side_by_side.png")
