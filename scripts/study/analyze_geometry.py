#!/usr/bin/env python3
"""分析卡牌素材几何：边框挖孔窗口位置 vs 烘焙艺术图位置"""
from PIL import Image
import os

A = '/home/z/my-project/public/assets'

def region_of_alpha(img, thresh=30):
    """返回非透明内容的bbox (在图像坐标系)"""
    if img.mode != 'RGBA':
        return None
    alpha = img.getchannel('A')
    bbox = alpha.point(lambda p: 255 if p > thresh else 0).getbbox()
    return bbox

def frame_window(img):
    """边框图中完全透明的最大矩形区域（即艺术图窗口）——扫描alpha<10的中心连通区"""
    if img.mode != 'RGBA':
        return None
    w, h = img.size
    alpha = img.getchannel('A')
    px = alpha.load()
    # 从中心向外找透明窗口边界
    cx, cy = w // 2, h // 2
    if px[cx, cy] > 10:
        # 中心不透明，试几个点
        for dy in range(-100, 100, 10):
            for dx in range(-100, 100, 10):
                if 0 <= cx+dx < w and 0 <= cy+dy < h and px[cx+dx, cy+dy] <= 10:
                    cx, cy = cx+dx, cy+dy
                    break
            else:
                continue
            break
        else:
            return None
    # BFS 找透明连通区
    from collections import deque
    seen = set()
    q = deque([(cx, cy)])
    seen.add((cx, cy))
    minx, miny, maxx, maxy = cx, cy, cx, cy
    while q:
        x, y = q.popleft()
        minx, miny = min(minx, x), min(miny, y)
        maxx, maxy = max(maxx, x), max(maxy, y)
        for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and px[nx, ny] <= 10:
                seen.add((nx, ny))
                if len(seen) > 400000:
                    q.clear()
                    break
                q.append((nx, ny))
    if len(seen) < 5000:
        return None
    return (minx, miny, maxx, maxy), len(seen)

print("=" * 70)
print("【边框图分析】")
for name in ['frameAttackCommon', 'frameSkillCommon', 'framePowerCommon', 'frameAttackUncommon', 'frameAttackRare']:
    p = f'{A}/frames/{name}.png'
    if not os.path.exists(p):
        print(f"  {name}: 不存在"); continue
    img = Image.open(p)
    win = frame_window(img)
    bbox = region_of_alpha(img)
    print(f"  {name}: size={img.size} 内容bbox={bbox} 窗口={win[0] if win else None} 窗口面积px={win[1] if win else 0}")

print()
print("【背景图分析】(不透明区=艺术图应出现的位置参考)")
for name in ['bgAttackRed', 'bgSkillRed']:
    p = f'{A}/frames/{name}.png'
    if not os.path.exists(p):
        print(f"  {name}: 不存在"); continue
    img = Image.open(p)
    print(f"  {name}: size={img.size} mode={img.mode} bbox={region_of_alpha(img) or '全图'}")

print()
print("【烘焙艺术图分析】内容在512画布中的位置")
for cid in ['strike', 'bash', 'defend', 'anger', 'twinStrike']:
    p = f'{A}/cardart/{cid}.webp'
    if not os.path.exists(p):
        print(f"  {cid}: 不存在"); continue
    img = Image.open(p).convert('RGBA')
    bbox = region_of_alpha(img)
    if bbox is None:
        # 不透明内容：找非背景色区域太复杂，先打印全图bbox
        print(f"  {cid}: size={img.size} 无alpha通道")
        continue
    print(f"  {cid}: size={img.size} 内容bbox={bbox} (中心区即插画位置)")

print()
print("【原版参考】STS1 卡牌模板几何（社区数据）:")
print("  卡图 512x512, 卡体 299x419 @ (106,47), 肖像窗口 250x190 @ (131,99)")

# 现在测量:边框窗口在512画布的位置,与烘焙图的插画bbox对比
print()
print("=" * 70)
print("【核心对比】边框窗口 vs 艺术图内容位置（应重合）")
fimg = Image.open(f'{A}/frames/frameAttackCommon.png').convert('RGBA')
fwin = frame_window(fimg)
aimg = Image.open(f'{A}/cardart/strike.webp').convert('RGBA')
abbox = region_of_alpha(aimg)
if fwin and abbox:
    wx, wy, wx2, wy2 = fwin[0]
    ax, ay, ax2, ay2 = abbox
    print(f"  边框窗口: x[{wx},{wx2}] y[{wy},{wy2}] 尺寸 {wx2-wx}x{wy2-wy}")
    print(f"  艺术图内容: x[{ax},{ax2}] y[{ay},{ay2}] 尺寸 {ax2-ax}x{ay2-ay}")
    print(f"  偏差: art相对窗口 dx={ax-wx}, dy={ay-wy} (右下为正)")
    print(f"  建议: 艺术图内容应居中于窗口 -> 需要 dx=0 dy=0")
