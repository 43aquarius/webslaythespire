#!/usr/bin/env python3
"""生成缺失素材：
1. 各幕战斗背景（combat2/3/4.jpg + map1.jpg：基于现有 combat.jpg 色调偏移）
2. 姿态图标（wrath/calm/divinity：原版风格圆形图标）
3. 缺失状态图标占位（phasing/rebirth/brilliance/caltrops/dexterityLoss 等）
"""
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import os

OUT = "/home/z/my-project/public/assets"
os.makedirs(f"{OUT}/status", exist_ok=True)
os.makedirs(f"{OUT}/bg", exist_ok=True)

# ============ 1. 各幕背景：色调偏移 ============
# 原版：第一幕荒野(暖绿) / 第二幕城市(冷蓝) / 第三幕境外(紫) / 第四幕心脏(红黑)
def make_act_bg(src_path, out_path, hue_shift, brightness=1.0, saturation=1.0):
    img = Image.open(src_path).convert('RGB')
    # 色相偏移（RGB→HSV 手动实现：用矩阵近似）
    import colorsys
    px = img.load()
    w, h = img.size
    # 性能：缩小时处理再放回？1344x768 可接受（约100万像素，python慢）
    # 用 numpy 加速
    import numpy as np
    arr = np.asarray(img).astype(np.float32) / 255.0
    hsv = np.zeros_like(arr)
    # RGB→HSV 向量化
    maxc = arr.max(axis=2)
    minc = arr.min(axis=2)
    v = maxc
    delta = maxc - minc
    s = np.where(maxc > 0, delta / np.maximum(maxc, 1e-8), 0)
    rc = np.where(delta > 0, (maxc - arr[:, :, 0]) / np.maximum(delta, 1e-8), 0)
    gc = np.where(delta > 0, (maxc - arr[:, :, 1]) / np.maximum(delta, 1e-8), 0)
    bc = np.where(delta > 0, (maxc - arr[:, :, 2]) / np.maximum(delta, 1e-8), 0)
    h = np.where(arr[:, :, 0] == maxc, bc - gc, np.where(arr[:, :, 1] == maxc, 2.0 + rc - bc, 4.0 + gc - rc))
    h = (h / 6.0) % 1.0
    h = (h + hue_shift) % 1.0
    # HSV→RGB 向量化
    i = np.floor(h * 6.0).astype(int)
    f = h * 6.0 - i
    p = v * (1.0 - s)
    q = v * (1.0 - s * f)
    t = v * (1.0 - s * (1.0 - f))
    i = i % 6
    r = np.choose(i, [v, q, p, p, t, v])
    g = np.choose(i, [t, v, v, q, p, p])
    b = np.choose(i, [p, p, t, v, v, q])
    out = np.stack([r, g, b], axis=2)
    out = np.clip(out * brightness, 0, 1)
    out = np.clip((out - 0.5) * saturation + 0.5, 0, 1)
    result = Image.fromarray((out * 255).astype('uint8'))
    # 轻微暗角让画面更聚焦
    result.save(out_path, quality=88)
    print("生成", out_path)

src = f"{OUT}/bg/combat.jpg"
make_act_bg(src, f"{OUT}/bg/combat2.jpg", hue_shift=0.55, brightness=0.92, saturation=1.05)   # 城市：冷蓝
make_act_bg(src, f"{OUT}/bg/combat3.jpg", hue_shift=0.78, brightness=0.85, saturation=1.1)    # 境外：暗紫
make_act_bg(src, f"{OUT}/bg/combat4.jpg", hue_shift=0.95, brightness=0.75, saturation=1.2)    # 心脏：血红

# ============ 2. 姿态图标（原版风格：圆形底+符号） ============
def make_stance_icon(path, color, symbol):
    """symbol: 'wrath' 怒目/ 'calm' 波纹 / 'divinity' 光环"""
    S = 109  # 与原版图标同尺寸
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = S // 2, S // 2
    # 外圈（描边+内底）
    d.ellipse([4, 4, S - 4, S - 4], fill=(20, 16, 12, 235), outline=color + (255,), width=3)
    d.ellipse([9, 9, S - 9, S - 9], outline=color + (140,), width=1)
    if symbol == 'wrath':
        # 怒：尖锐三角双眼 + 竖线
        c = color
        d.polygon([(cx - 22, cy - 12), (cx - 4, cy - 4), (cx - 22, cy + 4)], fill=c + (255,))
        d.polygon([(cx + 22, cy - 12), (cx + 4, cy - 4), (cx + 22, cy + 4)], fill=c + (255,))
        d.polygon([(cx - 14, cy + 8), (cx + 14, cy + 8), (cx, cy + 26)], fill=c + (230,))
    elif symbol == 'calm':
        # 静：三条波浪
        c = color
        import math
        for k, yy in enumerate([cy - 14, cy, cy + 14]):
            pts = [(x, yy + 5 * math.sin((x / S) * 2 * math.pi * 1.5)) for x in range(22, S - 21, 2)]
            d.line(pts, fill=c + (255 - k * 40,), width=4)
    elif symbol == 'divinity':
        # 神：放射光圈
        import math
        c = color
        for i in range(12):
            a = i * math.pi / 6
            x1 = cx + 16 * math.cos(a); y1 = cy + 16 * math.sin(a)
            x2 = cx + 34 * math.cos(a); y2 = cy + 34 * math.sin(a)
            d.line([(x1, y1), (x2, y2)], fill=c + (230,), width=3)
        d.ellipse([cx - 13, cy - 13, cx + 13, cy + 13], outline=c + (255,), width=4)
    img.save(path)
    print("生成", path)

make_stance_icon(f"{OUT}/status/wrath.png", (255, 120, 50), 'wrath')
make_stance_icon(f"{OUT}/status/calm.png", (80, 160, 255), 'calm')
make_stance_icon(f"{OUT}/status/divinity.png", (255, 215, 90), 'divinity')

# ============ 3. 其余缺失状态图标（简洁符号风格） ============
def make_simple_icon(path, color, draw_fn):
    S = 109
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = S // 2, S // 2
    d.ellipse([4, 4, S - 4, S - 4], fill=(20, 16, 12, 235), outline=color + (255,), width=3)
    draw_fn(d, cx, cy, color + (255,))
    img.save(path)
    print("生成", path)

import math
# phasing 相位：虚影双圆
make_simple_icon(f"{OUT}/status/phasing.png", (150, 130, 255),
    lambda d, cx, cy, c: (d.ellipse([cx-24, cy-24, cx+8, cy+8], outline=c, width=4),
                          d.ellipse([cx-8, cy-8, cx+24, cy+24], outline=(c[0], c[1], c[2], 130), width=4)))
# rebirth 重生：火焰
def _rebirth(d, cx, cy, c):
    d.polygon([(cx, cy-28), (cx+16, cy-4), (cx+10, cy+22), (cx-10, cy+22), (cx-16, cy-4)], fill=c)
    d.ellipse([cx-7, cy+2, cx+7, cy+20], fill=(255, 240, 170, 235))
make_simple_icon(f"{OUT}/status/rebirth.png", (255, 140, 60), _rebirth)
# brilliance 辉煌：星芒
def _brill(d, cx, cy, c):
    import math
    for i in range(8):
        a = i * math.pi / 4
        d.line([(cx + 8*math.cos(a), cy + 8*math.sin(a)), (cx + 30*math.cos(a), cy + 30*math.sin(a))], fill=c, width=4)
    d.ellipse([cx-8, cy-8, cx+8, cy+8], fill=c)
make_simple_icon(f"{OUT}/status/brilliance.png", (255, 220, 120), _brill)
# caltrops 图钉：三角尖刺
def _calt(d, cx, cy, c):
    for dx in [-18, 0, 18]:
        d.polygon([(cx+dx-8, cy+16), (cx+dx+8, cy+16), (cx+dx, cy-16)], fill=c)
make_simple_icon(f"{OUT}/status/caltrops.png", (200, 90, 90), _calt)
# dexterityLoss 敏捷降低：向下箭头（红调）
make_simple_icon(f"{OUT}/status/dexterityLoss.png", (200, 90, 90),
    lambda d, cx, cy, c: d.polygon([(cx-18, cy-22), (cx+18, cy-22), (cx, cy+22)], fill=c))
# time（时间吞噬者）备用：沙漏
def _time(d, cx, cy, c):
    d.polygon([(cx-16, cy-24), (cx+16, cy-24), (cx, cy)], fill=c)
    d.polygon([(cx-16, cy+24), (cx+16, cy+24), (cx, cy)], fill=(c[0], c[1], c[2], 160))
make_simple_icon(f"{OUT}/status/timeS.png", (160, 200, 255), _time)

print("全部生成完成")
