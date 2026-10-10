#!/usr/bin/env python3
"""逐部件渲染诊断：每个附件单独存图 + 检查alpha覆盖率"""
import sys
sys.path.insert(0, '/home/z/my-project/scripts')
from spine_compose import SpineComposer, paste_quad, paste_tri, tint_img
from PIL import Image
import numpy as np
import os

sd = '/tmp/MySlayTheSpire/src/main/resources/images/monsters/theBottom/cultist'
out_dir = '/home/z/my-project/scripts/spine_test/parts'
os.makedirs(out_dir, exist_ok=True)
c = SpineComposer(sd)
items, pts = c.collect()
xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
W, H = int(x1 - x0) + 20, int(y1 - y0) + 20
ox, oy = -x0 + 10, -y0 + 10

for slot, att, kind, data in items:
    an = slot.get('attachment', '?').split('/')[-1]
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    if kind == 'region':
        reg, quad = data
        img, w, h = c.region_img(reg)
        dq = [(qx + ox, qy + oy) for qx, qy in quad]
        paste_quad(canvas, img, dq)
    else:
        reg, uvs, verts, canvas_pts, tris = data
        img, w, h = c.region_img(reg)
        src = [(uvs[i] * w, (1 - uvs[i+1]) * h) for i in range(0, len(uvs), 2)]
        dst = [(p[0] + ox, p[1] + oy) for p in canvas_pts]
        n_draw = 0
        for t in range(0, len(tris), 3):
            i0, i1, i2 = tris[t], tris[t+1], tris[t+2]
            paste_tri(canvas, img, (dst[i0], dst[i1], dst[i2]), (src[i0], src[i1], src[i2]))
            n_draw += 1
    a = np.array(canvas)
    cov = (a[..., 3] > 10).mean() * 100
    # 部件bbox内的覆盖率(更准确: 非零alpha像素的bbox覆盖率)
    nz = np.argwhere(a[..., 3] > 10)
    if len(nz):
        bb_cov = len(nz) / ((nz[:,0].max()-nz[:,0].min()+1) * (nz[:,1].max()-nz[:,1].min()+1)) * 100
    else:
        bb_cov = 0
    canvas.save(f'{out_dir}/{an}.png')
    print(f'{an:14s} {kind:6s} 三角形{n_draw if kind=="mesh" else "-":>3} 画布覆盖{cov:5.1f}% bbox覆盖{bb_cov:5.1f}%')
