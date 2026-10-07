#!/usr/bin/env python3
"""以真值尺度直接模板匹配art → 精确art放置原点(comp坐标→512画布)"""
from PIL import Image
import numpy as np
OUT = '/home/z/my-project/scripts/study'

# 映射参数(上一轮推导): comp = (0,3) + (512-卡体原点)*(2.2357, 2.0694)
# 但先重新校验卡体bbox —— alpha>150可能含banner外发光, 尝试多阈值
comp = Image.open(f'{OUT}/Red-Bash.png').convert('RGBA')
C = np.array(comp).astype(int)
H, W = C.shape[:2]

for th in (60, 120, 200):
    a = C[:, :, 3] > th
    ys, xs = np.where(a)
    print(f"alpha>{th}: bbox x[{xs.min()},{xs.max()}] y[{ys.min()},{ys.max()}]")

# 稳定卡体: 用alpha>200
a = C[:, :, 3] > 200
ys, xs = np.where(a)
bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()
CBX, CBY, CBW, CBH = 107, 47, 297, 418   # bg素材卡体
sx = (bx1-bx0)/CBW; sy = (by1-by0)/CBH
to512 = lambda X, Y: (CBX + (X-bx0)/sx, CBY + (Y-by0)/sy)
print(f"卡体 x[{bx0},{bx1}] y[{by0},{by1}] | sx={sx:.4f} sy={sy:.4f}")

def try_card(comp_png, art_png, label, win_w=250, win_h=190):
    comp = Image.open(f'{OUT}/{comp_png}').convert('RGBA')
    C = np.array(comp).astype(int)
    art = Image.open(f'{OUT}/{art_png}').convert('RGBA')
    # art拉伸到窗口尺寸再缩放到comp尺度
    aw = int(round(win_w*sx)); ah = int(round(win_h*sy))
    A = np.array(art.resize((aw, ah), Image.LANCZOS)).astype(int)
    # 模板: art中央70%(避免边角与其他层交叠)
    th, tw = int(ah*0.7), int(aw*0.7)
    oy0, ox0 = (ah-th)//2, (aw-tw)//2
    T = A[oy0:oy0+th, ox0:ox0+tw]
    m = T[:, :, 3] > 100
    trgb = T[:, :, :3]
    best = (1e18, -1, -1)
    # 搜索: art原点范围 —— 卡体内上半部
    for oy in range(by0+5, by0+int((by1-by0)*0.65)-ah, 3):
        for ox in range(bx0+5, bx1-aw-5, 3):
            reg = C[oy+oy0:oy+oy0+th, ox+ox0:ox+ox0+tw, :3]
            if reg.shape != trgb.shape:
                continue
            d = np.abs(reg - trgb)[m].mean()
            if d < best[0]:
                best = (d, ox, oy)
    if best[1] < 0:
        print(f"  {label}: 匹配失败")
        return None
    d, ox, oy = best
    # 细化 ±3
    for oy2 in range(oy-3, oy+4):
        for ox2 in range(ox-3, ox+4):
            reg = C[oy2+oy0:oy2+oy0+th, ox2+ox0:ox2+ox0+tw, :3]
            if reg.shape != trgb.shape: continue
            dd = np.abs(reg - trgb)[m].mean()
            if dd < d: d, ox, oy = dd, ox2, oy2
    x512, y512 = to512(ox, oy)
    print(f"  {label}: 色差={d:.1f} comp=({ox},{oy}) -> 512画布 art原点=({x512:.1f},{y512:.1f}) 尺寸{win_w}x{win_h}")
    return (x512, y512)

import os, hashlib, subprocess
def fetch(filename):
    local = f"{OUT}/{filename.replace(' ', '_')}"
    if os.path.exists(local) and os.path.getsize(local) > 500:
        return local
    md5 = hashlib.md5(filename.encode()).hexdigest()
    url = f"https://slaythespire.wiki.gg/images/{md5[0]}/{md5[:2]}/{filename.replace(' ', '_')}"
    subprocess.run(['curl', '-s', '-L', '--max-time', '25', '-o', local, url], check=False)
    try:
        Image.open(local).load(); return local
    except Exception:
        return None

fetch('Red-Cleave-Art.png')

print("\n【art独立模板匹配 @ 真值尺度】")
r1 = try_card('Red-Bash.png', 'wiki_art_bash.png', 'Bash')
r2 = None
if os.path.exists(f'{OUT}/Red-Cleave-Art.png'):
    r2 = try_card('Red-Cleave.png', 'Red-Cleave-Art.png', 'Cleave')

results = [r for r in (r1, r2) if r]
if results:
    ax = sum(r[0] for r in results)/len(results)
    ay = sum(r[1] for r in results)/len(results)
    print(f"\n  ★ 真值art放置原点(512画布): ({ax:.1f}, {ay:.1f}) 窗口 {ax:.0f}..{ax+250:.0f} x {ay:.0f}..{ay+190:.0f}")
    print(f"  ★ 当前烘焙原点: (131, 99)  窗口 131..381 x 99..289")
    print(f"  ★ 偏差: dx={ax-131:+.1f} dy={ay-99:+.1f}")
    np.save(f'{OUT}/art_origin.npy', np.array([ax, ay, sx, sy, bx0, by0]))

    # 用真值原点重合成
    art = Image.open(f'{OUT}/wiki_art_bash.png').convert('RGBA')
    canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    canvas.alpha_composite(Image.open('/home/z/my-project/public/assets/frames/bgAttackRed.png').convert('RGBA'))
    a512 = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    a512.paste(art.resize((250, 190), Image.LANCZOS), (int(round(ax)), int(round(ay))))
    canvas.alpha_composite(a512)
    canvas.alpha_composite(Image.open('/home/z/my-project/public/assets/frames/frameAttackCommon.png').convert('RGBA'))
    canvas.alpha_composite(Image.open('/home/z/my-project/public/assets/frames/bannerCommon.png').convert('RGBA'))
    canvas.alpha_composite(Image.open('/home/z/my-project/public/assets/frames/cardRedOrb.png').convert('RGBA'))
    canvas.resize((768, 768), Image.LANCZOS).save(f'{OUT}/recomp_true.png')
    print(f"  真值原点重合成 -> recomp_true.png")
