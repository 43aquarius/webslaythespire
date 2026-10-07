#!/usr/bin/env python3
"""
严格标定：从 wiki 官方合成卡图求解
  1) 512画布 -> 合成图 的仿射变换（用banner/bg求解，最小化不透明像素色差）
  2) 艺术图在合成图中的实际位置（独立模板匹配）→ 换算回512画布坐标
  3) 结论：真值艺术图窗口 vs 我们当前烘焙窗口(131,99,250x190)
"""
from PIL import Image
import numpy as np

OUT = '/home/z/my-project/scripts/study'
ASSETS = '/home/z/my-project/public/assets'

comp = Image.open(f'{OUT}/wiki_comp_bash.png').convert('RGBA')
W, H = comp.size
C = np.array(comp).astype(int)

def load(p):
    return np.array(Image.open(p).convert('RGBA')).astype(int)

banner = load(f'{ASSETS}/frames/bannerCommon.png')   # 512画布
frame  = load(f'{ASSETS}/frames/frameAttackCommon.png')
orb    = load(f'{ASSETS}/frames/cardRedOrb.png')
art    = Image.open(f'{OUT}/wiki_art_bash.png').convert('RGBA')  # 248x186 原图

def resize_layer(npimg, sx, sy):
    """把512画布层按(x缩放sx, y缩放sy)重采样, 返回新数组(尺寸变化)"""
    im = Image.fromarray(npimg.astype(np.uint8))
    w = max(1, int(round(im.width * sx)))
    h = max(1, int(round(im.height * sy)))
    return np.array(im.resize((w, h), Image.LANCZOS)).astype(int)

def match_opaque(L, ox_range, oy_range, step=2):
    """在comp中搜索层L的最佳放置偏移: 只比较L不透明(alpha>120)处与comp的RGB差"""
    lh, lw = L.shape[:2]
    m = L[:, :, 3] > 120
    if m.sum() < 500:
        return None
    lrgb = L[:, :, :3]
    best = (1e18, 0, 0)
    for oy in oy_range:
        for ox in ox_range:
            if ox < 0 or oy < 0 or ox + lw > W or oy + lh > H:
                continue
            reg = C[oy:oy+lh, ox:ox+lw, :3]
            d = np.abs(reg - lrgb)[m].mean()
            if d < best[0]:
                best = (d, ox, oy)
    return best

print("=" * 72)
print("阶段1: 求解 512画布->合成图 变换 (用banner, 全局搜 scale+offset)")
print("=" * 72)
# 卡体在comp中的bbox: 用alpha>150排除阴影
a = C[:, :, 3]
solid = a > 150
ys, xs = np.where(solid)
bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()
print(f"卡体(不透明)bbox: x[{bx0},{bx1}] y[{by0},{by1}] -> {bx1-bx0}x{by1-by0}")
# 我们512画布卡体: 297x418 @ (107,47)
print(f"我们512卡体: 297x418 @ (107,47) -> 期望变换≈ sx={(bx1-bx0)/297:.3f} sy={(by1-by0)/418:.3f} 原点≈({bx0-107*(bx1-bx0)/297:.0f},{by0-47*(by1-by0)/418:.0f})")

best_all = (1e18, None, None, None, None)
# 细搜: sx, sy 各在期望值±8%内
sx0, sy0 = (bx1-bx0)/297.0, (by1-by0)/418.0
for sx in np.arange(sx0*0.94, sx0*1.06, 0.008):
    for sy in np.arange(sy0*0.94, sy0*1.06, 0.008):
        Lb = resize_layer(banner, sx, sy)
        r = match_opaque(Lb, range(max(0,bx0-60), bx0+60, 4), range(max(0,by0-60), by0+60, 4))
        if r and r[0] < best_all[0]:
            best_all = (r[0], sx, sy, r[1], r[2])
d, sx, sy, ox, oy = best_all
print(f"\nbanner最优: scale=({sx:.3f},{sy:.3f}) offset=({ox},{oy}) 色差={d:.1f}")

# 精化: 邻域内step=1
refine = (1e18, None, None, None, None)
for sx2 in np.arange(sx-0.008, sx+0.0081, 0.002):
    for sy2 in np.arange(sy-0.008, sy+0.0081, 0.002):
        Lb = resize_layer(banner, sx2, sy2)
        r = match_opaque(Lb, range(max(0,ox-8), ox+9, 1), range(max(0,oy-8), oy+9, 1))
        if r and r[0] < refine[0]:
            refine = (r[0], sx2, sy2, r[1], r[2])
d, sx, sy, ox, oy = refine
print(f"banner精化: scale=({sx:.3f},{sy:.3f}) offset=({ox},{oy}) 色差={d:.1f}")
print(f"=> 512画布->comp: comp_x ≈ {ox} + 512坐标*{sx:.4f}, comp_y ≈ {oy} + 512坐标*{sy:.4f}")

# 逆变换: comp -> 512画布
inv = lambda X, Y: ((X - ox)/sx, (Y - oy)/sy)

print()
print("=" * 72)
print("阶段2: frame 饰边在comp中的位置(用同变换预测+局部搜索) → 真值艺术图窗口")
print("=" * 72)
# frame在comp中的预测位置
fx, fy = ox + 125*sx, oy + 108*sy   # frame内容bbox(125,108,387,292)的左上
Lf = resize_layer(frame, sx, sy)
r = match_opaque(Lf, range(max(0,int(fx)-15), int(fx)+16, 1), range(max(0,int(fy)-15), int(fy)+16, 1))
if r:
    fd, fpx, fpy = r
    print(f"frame实配: comp位置=({fpx},{fpy}) 色差={fd:.1f}")
    # frame内容bbox换算回512画布
    fwx, fwy = inv(fpx, fpy)
    # 右下角: 再放一个点 — 用frame bbox右下(387,292)匹配较难, 直接按scale
    fw2 = fpx + (387-125)*sx
    fh2 = fpy + (292-108)*sy
    print(f"frame内容在512画布: x[{fwx:.1f},{inv(fw2,0)[0]:.1f}] y[{fwy:.1f},{inv(0,fh2)[1]:.1f}]")
    print(f"我们当前烘焙艺术图: x[131,381] y[99,289]  (frame饰边bbox按素材=(125,108,387,292))")
else:
    print("frame匹配失败")

print()
print("=" * 72)
print("阶段3: 艺术图在comp中独立定位(模板匹配@真值尺度) → 真值窗口")
print("=" * 72)
# art 248x186 -> 512画布上应拉伸为250x190, 在comp里尺寸 = 250*sx x 190*sy
aw, ah = int(round(250*sx)), int(round(190*sy))
art_scaled = np.array(art.resize((aw, ah), Image.LANCZOS)).astype(int)
r = match_opaque(art_scaled, range(max(0,bx0+20), bx0+int(300*sx), 2), range(max(0,by0+20), by0+int(260*sy), 2))
if r:
    ad, apx, apy = r
    print(f"art实配: comp位置=({apx},{apy}) 色差={ad:.1f}  尺寸{aw}x{ah}")
    ax0, ay0 = inv(apx, apy)
    print(f"\n>>> 真值艺术图窗口(512画布): x[{ax0:.1f},{ax0+250:.1f}] y[{ay0:.1f},{ay0+190:.1f}]")
    print(f">>> 我们烘焙位置:          x[131,381] y[99,289]")
    print(f">>> 偏差: dx={ax0-131:+.1f} dy={ay0-99:+.1f}  (正=真值更靠右/下)")
    # frame真值窗口内沿(透明区) — 从frame素材推: frame实区(125,108,387,292)的透明内部
    print(f">>> frame饰边bbox真值: x[{inv(fpx,0)[0]:.1f},{inv(fw2,0)[0]:.1f}] y[{inv(fpy,0)[1]:.1f},{inv(fh2,0)[1]:.1f}]")
else:
    print("art匹配失败")
