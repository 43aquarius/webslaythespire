#!/usr/bin/env python3
"""
终极标定：抓取多张同组件(红/攻击/普通)wiki合成卡图
  - 两两差分 → 差异bbox = 艺术图实际位置(comp坐标)
  - 卡体bbox(alpha轮廓) → 512画布坐标映射
  - 输出真值艺术图窗口 vs 当前烘焙窗口(131,99)
"""
import hashlib, os, subprocess
from PIL import Image
import numpy as np

OUT = '/home/z/my-project/scripts/study'
BASE = "https://slaythespire.wiki.gg/images"
ASSETS = '/home/z/my-project/public/assets'

def wiki_url(filename):
    md5 = hashlib.md5(filename.encode()).hexdigest()
    return f"{BASE}/{md5[0]}/{md5[:2]}/{filename.replace(' ', '_')}"

def fetch(filename):
    local = f"{OUT}/{filename.replace(' ', '_')}"
    if os.path.exists(local) and os.path.getsize(local) > 500:
        return local
    subprocess.run(['curl', '-s', '-L', '--max-time', '25', '-o', local, wiki_url(filename)], check=False)
    try:
        Image.open(local).load()
        return local
    except Exception:
        os.path.exists(local) and os.remove(local)
        return None

# 红色 普通 攻击牌（同一套 bg/frame/banner/orb/cardicon，只有art不同）
CARDS = ['Red-Bash.png', 'Red-Cleave.png', 'Red-Iron Wave.png', 'Red-Heavy Blade.png',
         'Red-Twin Strike.png', 'Red-Clothesline.png', 'Red-Pommel Strike.png']
comps = {}
for fn in CARDS:
    p = fetch(fn)
    if p:
        im = Image.open(p).convert('RGBA')
        comps[fn] = im
        print(f"  ✓ {fn} {im.size}")
    else:
        print(f"  ✗ {fn}")

names = list(comps)
if len(names) < 2:
    print("不足2张，退出"); raise SystemExit

# ---------- 1. 两两差分 → art区域(comp坐标) ----------
print("\n【两两差分】")
rects = []
for i in range(len(names)):
    for j in range(i+1, len(names)):
        A = np.array(comps[names[i]]).astype(int)
        B = np.array(comps[names[j]]).astype(int)
        if A.shape != B.shape:
            print(f"  {names[i]} vs {names[j]}: 尺寸不同 {A.shape} {B.shape}, 跳过")
            continue
        D = np.abs(A - B).sum(axis=2)  # 通道维是axis2 (h,w,4)
        m = D > 60
        if m.sum() < 500:
            continue
        ys, xs = np.where(m)
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        # 只保留中部大块(去掉文字层差异——文字位置相同但内容不同会全卡差异, 用占比过滤)
        frac = m.sum() / (A.shape[0]*A.shape[1])
        rects.append((names[i], names[j], x0, y0, x1, y1, frac, int(m.sum())))
        print(f"  {names[i][4:-4]:14s} vs {names[j][4:-4]:14s}: 差异bbox x[{x0},{x1}] y[{y0},{y1}] 面积占比{frac:.1%}")

# 取交集(所有pair的共同区域 = art窗口; pair差异可能含文字,交集剔除)
if not rects:
    print("无差分结果"); raise SystemExit
X0 = max(r[2] for r in rects); Y0 = max(r[3] for r in rects)
X1 = min(r[4] for r in rects); Y1 = min(r[5] for r in rects)
print(f"\n  差异交集(=art真值区域, comp坐标): x[{X0},{X1}] y[{Y0},{Y1}]  尺寸 {X1-X0}x{Y1-Y0}")

# ---------- 2. 卡体bbox → 512画布映射 ----------
# 用第一张comp: alpha>150 的实心轮廓(卡体), 但art窗口/banners透明区不在轮廓内
# 更稳: 用 bg 组件在comp中的位置 —— 直接测comp不透明bbox(卡身)
A0 = np.array(comps[names[0]]).astype(int)
a = A0[:, :, 3] > 150
ys, xs = np.where(a)
bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()
print(f"\n  comp卡体bbox: x[{bx0},{bx1}] y[{by0},{by1}] ({bx1-bx0}x{by1-by0})")
# 我们的512画布卡体(bg素材): 107..404 x 47..465
CBX, CBY, CBW, CBH = 107, 47, 297, 418
sx = (bx1-bx0)/CBW; sy = (by1-by0)/CBH
print(f"  映射: comp = ({bx0} + (x512-{CBX})*{sx:.4f}, {by0} + (y512-{CBY})*{sy:.4f})")
to512 = lambda X, Y: (CBX + (X-bx0)/sx, CBY + (Y-by0)/sy)

# ---------- 3. 真值art窗口 → 512画布 ----------
ax, ay = to512(X0, Y0)
ax2, ay2 = to512(X1, Y1)
print(f"\n  ╔════════════════════════════════════════════════╗")
print(f"  ║ art真值窗口(512画布): x[{ax:.1f},{ax2:.1f}] y[{ay:.1f},{ay2:.1f}]   ║")
print(f"  ║   尺寸: {ax2-ax:.1f} x {ay2-ay:.1f}                              ║")
print(f"  ║ 当前烘焙:           x[131,381] y[99,289] (250x190) ║")
print(f"  ║ 偏差: 左上 dx={ax-131:+.1f} dy={ay-99:+.1f}                       ║")
print(f"  ╚════════════════════════════════════════════════╝")

# ---------- 4. 用真值窗口重新合成并保存对比 ----------
art = Image.open(f'{OUT}/wiki_art_bash.png').convert('RGBA')
canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
canvas.alpha_composite(Image.open(f'{ASSETS}/frames/bgAttackRed.png').convert('RGBA'))
art512 = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
art512.paste(art.resize((int(round(ax2-ax)), int(round(ay2-ay))), Image.LANCZOS), (int(round(ax)), int(round(ay))))
canvas.alpha_composite(art512)
canvas.alpha_composite(Image.open(f'{ASSETS}/frames/frameAttackCommon.png').convert('RGBA'))
canvas.alpha_composite(Image.open(f'{ASSETS}/frames/bannerCommon.png').convert('RGBA'))
canvas.alpha_composite(Image.open(f'{ASSETS}/frames/cardRedOrb.png').convert('RGBA'))
canvas.resize((768, 768), Image.LANCZOS).save(f'{OUT}/recomp_true.png')
print(f"\n  真值窗口重合成图 -> {OUT}/recomp_true.png")
np.save(f'{OUT}/true_window.npy', np.array([ax, ay, ax2, ay2, sx, sy, bx0, by0]))
