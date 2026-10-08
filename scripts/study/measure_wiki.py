#!/usr/bin/env python3
"""下载wiki官方合成卡图，测量艺术图窗口的精确位置（几何真值）"""
import hashlib, os, subprocess, sys
from PIL import Image

BASE = "https://slaythespire.wiki.gg/images"
OUT = '/home/z/my-project/scripts/study'

def wiki_url(filename):
    md5 = hashlib.md5(filename.encode()).hexdigest()
    q = filename.replace(' ', '_')
    return f"{BASE}/{md5[0]}/{md5[:2]}/{q}"

def fetch(filename, local):
    url = wiki_url(filename)
    subprocess.run(['curl', '-s', '-L', '--max-time', '30', '-o', local, url], check=False)
    if os.path.exists(local) and os.path.getsize(local) > 200:
        try:
            im = Image.open(local); im.load()
            print(f"  ✓ {filename} -> {local} {im.size} {im.mode}")
            return True
        except Exception:
            pass
    print(f"  ✗ {filename} 失败")
    return False

os.makedirs(OUT, exist_ok=True)
# 1. wiki官方合成卡（含全套组件的最终成像 = 几何真值）
fetch('Red-Bash.png', f'{OUT}/wiki_comp_bash.png')
fetch('Green-Neutralize.png', f'{OUT}/wiki_comp_neutralize.png')
# 2. 原始艺术图（游戏内原图）
fetch('Red-Bash-Art.png', f'{OUT}/wiki_art_bash.png')

import numpy as np

def measure(comp_path, art_path, name):
    comp = np.array(Image.open(comp_path).convert('RGB')).astype(int)
    art = np.array(Image.open(art_path).convert('RGB')).astype(int)
    ah, aw = art.shape[:2]
    ch, cw = comp.shape[:2]
    print(f"\n【{name}】合成图 {cw}x{ch} 原始art {aw}x{ah}")
    # 在合成图中定位art：用art的中心区域(30%大小)做模板匹配，仅在上半卡区(y<300)搜索
    th, tw = int(ah*0.3), int(aw*0.3)
    ty, tx = (ah-th)//2, (aw-tw)//2
    tmpl = art[ty:ty+th, tx:tx+tw]
    best = (1e18, -1, -1)
    for y in range(60, 300, 2):
        for x in range(80, 360, 2):
            if y+th > ch or x+tw > cw: break
            region = comp[y:y+th, x:x+tw]
            # 归一化差
            d = np.mean(np.abs(region - tmpl))
            if d < best[0]: best = (d, x, y)
    d, x, y = best
    print(f"  模板匹配: art原点 ≈ ({x-tx}, {y-ty}) 匹配误差 {d:.1f}")
    return (x - tx, y - ty)

p1 = measure(f'{OUT}/wiki_comp_bash.png', f'{OUT}/wiki_art_bash.png', 'Bash')

# 3. 直接用边缘检测在合成图上找艺术图区域（红牌Bash: art区域上下左右的色调边界）
comp = Image.open(f'{OUT}/wiki_comp_bash.png').convert('RGBA')
arr = np.array(comp)
# 艺术图窗口判定：合成图中, 艺术图通常占有一块高对比区域。用我们已有的 frame 图做差:
frame = np.array(Image.open('/home/z/my-project/public/assets/frames/frameAttackCommon.png').convert('RGBA')).astype(int)
compf = np.array(comp.convert('RGBA')).astype(int)
print("\n【frame覆盖检查】frame实像素 在 合成图同位置 是否一致:")
fm = frame[:,:,3] > 80
same = (np.abs(frame[:,:,:3][fm] - compf[:,:,:3][fm])).mean()
print(f"  frame不透明像素({fm.sum()}个)与合成图平均色差: {same:.1f} (小于10=同素材同位置)")

# frame的透明窗口（艺术图应从这露出）在合成图中是什么内容
# 逐行扫描frame中轴(256列)实区, 给出合成图中边框上下沿
colf = frame[:, 250:262, 3].max(axis=1)
ys = np.where(colf > 80)[0]
print(f"  frame中轴实区: y {ys.min()}..{ys.max()}")
print(f"  => frame覆盖艺术图时, art必须从 y {ys.min()}..{ys.max()} 区间露出")
print(f"\n结论: wiki合成图中 art 原点 ≈ {p1}; 我们烘焙位置 = (131, 99)")
