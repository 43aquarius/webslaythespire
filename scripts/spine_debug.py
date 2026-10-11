#!/usr/bin/env python3
"""诊断 cultist 各附件渲染"""
import sys
sys.path.insert(0, '/home/z/my-project/scripts')
from spine_compose import SpineComposer
from PIL import Image
import numpy as np

c = SpineComposer('/tmp/MySlayTheSpire/src/main/resources/images/monsters/theBottom/cultist')
items, pts = c.collect()
print(f'附件数: {len(items)}, 总点数: {len(pts)}')
xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
print(f'bbox: x[{min(xs):.0f},{max(xs):.0f}] y[{min(ys):.0f},{max(ys):.0f}]')
for slot, att, kind, data in items[:20]:
    an = slot.get('attachment')
    if kind == 'region':
        reg, quad = data
        print(f'  region {an}: reg_size={reg["size"]} quad={[(round(x),round(y)) for x,y in quad]}')
    else:
        reg, uvs, verts, canvas_pts, tris = data
        cxs = [p[0] for p in canvas_pts]; cys = [p[1] for p in canvas_pts]
        print(f'  mesh {an}: reg={reg["size"]} nverts={len(canvas_pts)} tris={len(tris)//3} '
              f'canvas_x[{min(cxs):.0f},{max(cxs):.0f}] y[{min(cys):.0f},{max(cys):.0f}]')
