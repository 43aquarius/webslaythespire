#!/usr/bin/env python3
"""严格标定 v2 —— 修正: 层先裁剪到内容bbox; 粗搜(1/4分辨率)→精化(全分辨率)"""
from PIL import Image
import numpy as np

OUT = '/home/z/my-project/scripts/study'
ASSETS = '/home/z/my-project/public/assets'

comp = Image.open(f'{OUT}/wiki_comp_bash.png').convert('RGBA')
W, H = comp.size
C_full = np.array(comp).astype(int)
# 1/4 分辨率粗搜
DS = 4
comp_ds = comp.resize((W//DS, H//DS), Image.LANCZOS)
C_ds = np.array(comp_ds).astype(int)

def load(p):
    return np.array(Image.open(p).convert('RGBA')).astype(int)

banner = load(f'{ASSETS}/frames/bannerCommon.png')
frame  = load(f'{ASSETS}/frames/frameAttackCommon.png')
orb    = load(f'{ASSETS}/frames/cardRedOrb.png')
art    = Image.open(f'{OUT}/wiki_art_bash.png').convert('RGBA')

def content_bbox(npimg, a=120):
    m = npimg[:, :, 3] > a
    ys, xs = np.where(m)
    return xs.min(), ys.min(), xs.max()+1, ys.max()+1

def crop_resize(npimg_512, sx, sy, ds=1):
    """512画布层 -> (裁剪到内容bbox -> 按sx,sy缩放 -> 再1/ds降采样), 返回(数组, 内容在512画布的bbox)"""
    x0, y0, x1, y1 = content_bbox(npimg_512)
    sub = npimg_512[y0:y1, x0:x1]
    im = Image.fromarray(sub.astype(np.uint8))
    w = max(1, int(round((x1-x0)*sx/ds)))
    h = max(1, int(round((y1-y0)*sy/ds)))
    return np.array(im.resize((w, h), Image.LANCZOS)).astype(int), (x0, y0, x1, y1)

def match(C, L, ox_range, oy_range):
    """L(已缩放层)在C(合成图)中找最佳偏移; 返回(色差, ox, oy) or None"""
    lh, lw = L.shape[:2]
    Ch, Cw = C.shape[:2]
    m = L[:, :, 3] > 120
    lrgb = L[:, :, :3]
    best = (1e18, -1, -1)
    for oy in oy_range:
        for ox in ox_range:
            if ox < 0 or oy < 0 or ox+lw > Cw or oy+lh > Ch:
                continue
            reg = C[oy:oy+lh, ox:ox+lw, :3]
            d = np.abs(reg - lrgb)[m].mean()
            if d < best[0]:
                best = (d, ox, oy)
    return None if best[1] < 0 else best

# ---- 0. 期望变换(从卡体bbox) ----
a = C_full[:, :, 3] > 150
ys, xs = np.where(a)
bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()
sx0, sy0 = (bx1-bx0)/297.0, (by1-by0)/418.0
print(f"卡体bbox: x[{bx0},{bx1}] y[{by0},{by1}] | 期望 sx={sx0:.4f} sy={sy0:.4f}")

# ---- 1. banner 粗搜(1/4分辨率) ----
print("\n[1] banner 粗搜 @1/4分辨率")
best = (1e18, None, None, None, None)
for sx in np.arange(sx0*0.95, sx0*1.05, 0.005):
    for sy in np.arange(sy0*0.95, sy0*1.05, 0.005):
        L, bb = crop_resize(banner, sx, sy, DS)
        r = match(C_ds, L, range(0, W//DS - L.shape[1], 4), range(0, H//DS - L.shape[0], 4))
        if r and r[0] < best[0]:
            best = (r[0], sx, sy, r[1]*DS, r[2]*DS)
d, sx, sy, ox, oy = best
print(f"  粗搜: 色差={d:.1f} scale=({sx:.4f},{sy:.4f}) offset=({ox},{oy})")

# ---- 2. banner 精化(全分辨率, ±8px, ±0.002) ----
print("[2] banner 精化 @全分辨率")
best = (1e18, sx, sy, ox, oy)
for sx2 in np.arange(sx-0.004, sx+0.0041, 0.001):
    for sy2 in np.arange(sy-0.004, sy+0.0041, 0.001):
        L, bb = crop_resize(banner, sx2, sy2, 1)
        r = match(C_full, L, range(ox-10, ox+11), range(oy-10, oy+11))
        if r and r[0] < best[0]:
            best = (r[0], sx2, sy2, r[1], r[2])
d, sx, sy, ox, oy = best
print(f"  精化: 色差={d:.1f} scale=({sx:.4f},{sy:.4f}) offset=({ox},{oy})")
bb = content_bbox(banner)
print(f"  banner内容bbox(512画布): {bb} -> comp中: ({ox},{oy})")

inv = lambda X, Y: ((X-ox)/sx, (Y-oy)/sy)
print(f"\n  变换: comp = ({ox:.0f},{oy:.0f}) + 512坐标*({sx:.4f},{sy:.4f})")

# ---- 3. frame 精确放置(同变换, 局部±10px) ----
print("\n[3] frame 实配(局部搜索)")
L, fbb = crop_resize(frame, sx, sy, 1)
pred_x = ox + fbb[0]*sx
pred_y = oy + fbb[1]*sy
r = match(C_full, L, range(int(pred_x)-12, int(pred_x)+13), range(int(pred_y)-12, int(pred_y)+13))
if r:
    fd, fpx, fpy = r
    fx0, fy0 = inv(fpx, fpy)
    fx1 = fpx + (fbb[2]-fbb[0])*sx
    fy1 = fpy + (fbb[3]-fbb[1])*sy
    print(f"  色差={fd:.1f} comp位置=({fpx},{fpy})")
    print(f"  frame内容(512画布真值): x[{fx0:.1f},{inv(fx1,0)[0]:.1f}] y[{fy0:.1f},{inv(0,fy1)[1]:.1f}]")
    print(f"  frame素材bbox:          x[125,387] y[108,292]")
else:
    print("  失败")

# ---- 4. art 独立定位 ----
print("\n[4] art 独立定位(局部搜索: 卡体上半)")
aw, ah = int(round(250*sx)), int(round(190*sy))
art_s = np.array(art.resize((aw, ah), Image.LANCZOS)).astype(int)
r = match(C_full, art_s, range(bx0+int(20*sx), bx0+int(280*sx), 3), range(by0+int(20*sy), by0+int(240*sy), 3))
if r:
    ad, apx, apy = r
    ax0, ay0 = inv(apx, apy)
    print(f"  色差={ad:.1f} comp位置=({apx},{apy}) 尺寸{aw}x{ah}")
    print(f"\n  ╔══════════════════════════════════════════╗")
    print(f"  ║ 真值艺术图窗口: x[{ax0:.1f},{ax0+250:.1f}] y[{ay0:.1f},{ay0+190:.1f}] ║")
    print(f"  ║ 当前烘焙位置:   x[131,381]    y[99,289]   ║")
    print(f"  ║ 偏差: dx={ax0-131:+.1f}  dy={ay0-99:+.1f}                ║")
    print(f"  ╚══════════════════════════════════════════╝")
    np.save(f'{OUT}/calib_result.npy', np.array([ax0, ay0, sx, sy, ox, oy]))
else:
    print("  art匹配失败")

# ---- 5. 验证: 用真值窗口重烘焙art并与comp对比 ----
if r:
    ax0, ay0 = inv(apx, apy)
    canvas = Image.new('RGBA', (512, 512), (0,0,0,0))
    # art按真值窗口放置
    art512 = Image.new('RGBA', (512, 512), (0,0,0,0))
    a2 = art.resize((250, 190), Image.LANCZOS)
    art512.paste(a2, (int(round(ax0)), int(round(ay0))))
    for p in [f'{ASSETS}/frames/bgAttackRed.png']:
        canvas.alpha_composite(Image.open(p).convert('RGBA'))
    canvas.alpha_composite(art512)
    canvas.alpha_composite(Image.open(f'{ASSETS}/frames/frameAttackCommon.png').convert('RGBA'))
    canvas.alpha_composite(Image.open(f'{ASSETS}/frames/bannerCommon.png').convert('RGBA'))
    canvas.alpha_composite(Image.open(f'{ASSETS}/frames/cardRedOrb.png').convert('RGBA'))
    canvas.resize((768,768)).save(f'{OUT}/recomp_true.png')
    print(f"\n  用真值窗口重合成 -> {OUT}/recomp_true.png")
