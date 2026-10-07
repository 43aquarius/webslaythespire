#!/usr/bin/env python3
"""用wiki官方合成卡图(678x874)校准艺术图窗口位置 —— 换算到我们的512画布坐标系"""
from PIL import Image
import numpy as np

OUT = '/home/z/my-project/scripts/study'

comp = Image.open(f'{OUT}/wiki_comp_bash.png').convert('RGBA')
art = Image.open(f'{OUT}/wiki_art_bash.png').convert('RGBA')
print(f"合成图 {comp.size}, 原始art {art.size}")

ca = np.array(comp)
# 1. 合成图中卡体的不透明bbox（卡体外沿）
body = ca[:, :, 3] > 40
ys, xs = np.where(body)
bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()
print(f"合成图卡体bbox: x[{bx0},{bx1}] y[{by0},{by1}] 尺寸 {bx1-bx0}x{by1-by0}")

# 2. 我们的512画布体系: 卡体 x[106,405] y[47,466] (299x419)
#    换算: comp坐标 -> 512坐标:  x512 = 106 + (x - bx0) * 299/(bx1-bx0)
sx = 299.0 / (bx1 - bx0)
sy = 419.0 / (by1 - by0)
tx = lambda x: 106 + (x - bx0) * sx
ty = lambda y: 47 + (y - by0) * sy

# 3. 在合成图中定位艺术图（模板匹配，用art中央60%区域）
A = np.array(art.convert('RGB')).astype(int)
C = ca[:, :, :3].astype(int)
ah, aw = A.shape[:2]
th, tw = int(ah*0.6), int(aw*0.6)
tyy, txx = (ah-th)//2, (aw-tw)//2
tmpl = A[tyy:tyy+th, txx:txx+tw]
best = (1e18, 0, 0)
# 搜索范围限制在卡体上半部
for y in range(by0+10, by0+int((by1-by0)*0.6), 2):
    for x in range(bx0+10, bx1-tw-10, 2):
        reg = C[y:y+th, x:x+tw]
        d = np.mean(np.abs(reg - tmpl))
        if d < best[0]:
            best = (d, x, y)
d, x, y = best
art_x, art_y = tx(x - txx), ty(y - tyy)
print(f"\n模板匹配误差 {d:.2f} (越小越可信, <15 优)")
print(f"art原点在512画布 = ({art_x:.1f}, {art_y:.1f})")
print(f"art窗口(按250x190推算): x[{art_x:.0f},{art_x+250:.0f}] y[{art_y:.0f},{art_y+190:.0f}]")
print(f"我们当前烘焙位置: (131, 99) -> 窗口 x[131,381] y[99,289]")
print(f"偏差: dx={art_x-131:.1f} dy={art_y-99:.1f}")

# 4. frame中轴实区（换算）
frame = np.array(Image.open('/home/z/my-project/public/assets/frames/frameAttackCommon.png').convert('RGBA'))
colf = frame[:, 250:262, 3].max(axis=1)
fys = np.where(colf > 80)[0]
print(f"\nframe(512画布)中轴实区: y[{fys.min()},{fys.max()}] 即frame的饰边纵跨")
print(f"若art窗口 y[{art_y:.0f},{art_y+190:.0f} 与 frame实区 y[{fys.min()},{fys.max()}] ——")
print(f"  art顶部高出frame顶 {art_y - fys.min():.1f}px, art底部低于frame底 {art_y+190 - fys.max():.1f}px")

# 5. 同时测量: 合成图里 frame 饰边位置（用frame模板匹配也可省略——由卡体bbox换算已给出）
# 输出对比图: wiki合成图 vs 我们渲染(同坐标系)
ours = Image.open('/home/z/my-project/scripts/study/composite_512.png').convert('RGBA')
canvas = Image.new('RGBA', (1100, 512), (30, 30, 30, 255))
canvas.paste(ours, (0, 0), ours)
comp_small = comp.resize((512, int(512 * comp.height / comp.width)), Image.LANCZOS)
canvas.paste(comp_small, (560, (512 - comp_small.height)//2), comp_small)
canvas.save(f'{OUT}/compare.png')
print("\n对比图已保存 compare.png (左=我们的512渲染, 右=wiki官方678x874缩放)")
