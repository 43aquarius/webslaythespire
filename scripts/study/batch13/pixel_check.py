#!/usr/bin/env python3
"""像素级验证意图爆发：对比有/无爆发两帧在意图区域的亮度差"""
from PIL import Image, ImageChops
import sys

# intent_burst3.png 有爆发（注入后450ms）；combat_full.png 无爆发基线
a = Image.open('/home/z/my-project/scripts/study/batch13/intent_burst3.png').convert('RGB')
b = Image.open('/home/z/my-project/scripts/study/batch13/combat_full.png').convert('RGB')
print('sizes:', a.size, b.size)
if a.size != b.size:
    # 裁到相同尺寸
    w, h = min(a.size[0], b.size[0]), min(a.size[1], b.size[1])
    a = a.crop((0, 0, w, h)); b = b.crop((0, 0, w, h))

# 爆发区域：意图图标附近（burst x=693 y=81 w~44 视口坐标 → 舞台缩放后截图坐标）
# 截图尺寸 = 视口尺寸，直接用测量坐标
x0, y0, x1, y1 = 640, 30, 780, 140
ra = a.crop((x0, y0, x1, y1))
rb = b.crop((x0, y0, x1, y1))
diff = ImageChops.difference(ra, rb)
bbox = diff.getbbox()
import numpy as np
da = np.asarray(ra, dtype=int); db = np.asarray(rb, dtype=int)
d = np.abs(da - db).sum(axis=2)
print('意图区域: 有爆发平均亮度 %.1f vs 无爆发 %.1f' % (da.mean(), db.mean()))
print('差异>30的像素数:', int((d > 30).sum()), '/', d.size, '(%.1f%%)' % (100 * (d > 30).sum() / d.size))
print('最大差异:', int(d.max()), '差异bbox:', bbox)
