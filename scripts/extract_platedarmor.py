#!/usr/bin/env python3
"""第二十一批：从 powers.atlas 提取 platedarmor 状态图标（顶部原点规范，含 metallicize 校准验证）"""
from PIL import Image
import subprocess, io

ATLAS_PNG = '/tmp/MySlayTheSpire/src/main/resources/powers/powers.png'

def extract(region_name, out_path):
    # 解析 atlas 文本取区域参数
    lines = open('/tmp/MySlayTheSpire/src/main/resources/powers/powers.atlas').read().splitlines()
    idx = lines.index(region_name)
    p = {}
    for l in lines[idx+1:idx+6]:
        for k in ('xy', 'size', 'orig', 'offset'):
            if l.strip().startswith(k + ':'):
                vals = [int(v) for v in l.split(':')[1].split(',')]
                p[k] = vals
    img = Image.open(ATLAS_PNG).convert('RGBA')
    x, y = p['xy']; w, h = p['size']; ox, oy = p['offset']
    crop = img.crop((x, y, x + w, y + h))  # 顶部原点（第十九批标定结论）
    canvas = Image.new('RGBA', tuple(p['orig']), (0, 0, 0, 0))
    canvas.alpha_composite(crop, (ox, oy))  # 与第十九批 extract_region 同法（透明区RGB归零）
    canvas.save(out_path)
    return canvas

# 校准：metallicize→128/armor 与既有产物可见内容应当一致（只比可见像素，透明区RGB不比）
cal = extract('128/armor', '/tmp/cal_armor.png')
truth = Image.open('/home/z/my-project/public/assets/status/metallicize.png').convert('RGBA')
diff = sum(abs(a[0]-b[0]) + abs(a[1]-b[1]) + abs(a[2]-b[2])
           for a, b in zip(cal.getdata(), truth.getdata()) if a[3] > 0 and b[3] > 0)
n = sum(1 for a, b in zip(cal.getdata(), truth.getdata()) if a[3] > 0 and b[3] > 0)
print(f'校准 128/armor vs 现存metallicize.png 可见像素平均差={diff/max(n,1):.2f} (≤3为同流程)')

# 提取 platedarmor
out = extract('128/platedarmor', '/home/z/my-project/public/assets/status/platedArmor.png')
opaque = sum(1 for px in out.getdata() if px[3] > 128)
print(f'platedArmor.png 已写入: 128×128, 不透明像素={opaque}')
