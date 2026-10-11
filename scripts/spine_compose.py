#!/usr/bin/env python3
"""Spine 3.4.02 setup-pose 静态立绘合成器（第二十四批）
从反编译仓库的 skeleton.json + skeleton.atlas + skeleton.png 合成敌人/角色透明立绘 PNG。
支持: region 附件(四角仿射) / mesh 附件(三角形纹理映射) / 加权 mesh 顶点 / slot tint
跳过: path 附件(特效曲线,不渲染)
坐标系: spine 世界 y 向上、rotation 逆时针为正 → 画布 y 翻转
用法:
  python3 spine_compose.py <spine目录> <输出.png> [--scale 1.0]
"""
import json, math, os, sys
from PIL import Image, ImageDraw

# ---------- libGDX atlas 解析 ----------
def parse_atlas(path):
    lines = open(path, encoding='utf-8').read().splitlines()
    regions, page = {}, None
    i = 0
    while i < len(lines):
        l = lines[i].strip()
        if l.endswith(('.png', '.jpg')) and i + 1 < len(lines) and lines[i+1].strip().startswith('size:'):
            page = l
            i += 2
            while i < len(lines) and lines[i].strip().startswith(('format:', 'filter:', 'repeat:', 'pma:')):
                i += 1
            continue
        if page and l and ':' not in l and not l.startswith(('rotate', 'xy', 'size', 'orig', 'offset', 'index')):
            name, reg, j = l, {'page': page, 'rotate': False, 'xy': None, 'size': None}, i + 1
            while j < len(lines):
                nl = lines[j].strip()
                if nl.startswith('rotate:'): reg['rotate'] = ('true' in nl or nl.endswith('90'))
                elif nl.startswith('xy:'):
                    p = nl.split(':', 1)[1].split(','); reg['xy'] = (int(p[0].strip()), int(p[1].strip()))
                elif nl.startswith('size:'):
                    p = nl.split(':', 1)[1].split(','); reg['size'] = (int(p[0].strip()), int(p[1].strip()))
                elif nl.startswith(('orig:', 'offset:', 'index:')):
                    pass
                elif nl and ':' not in nl:
                    break
                j += 1
            if reg['xy'] and reg['size']:
                regions[name] = reg
                i = j
                continue
        i += 1
    return regions

# ---------- 2x3 仿射 ----------
def M(a=1, b=0, c=0, d=0, e=1, f=0): return (a, b, c, d, e, f)
def mul(m1, m2):  # m1 ∘ m2 (先应用 m2)
    a1, b1, c1, d1, e1, f1 = m1; a2, b2, c2, d2, e2, f2 = m2
    return (a1*a2 + b1*d2, a1*b2 + b1*e2, a1*c2 + b1*f2 + c1,
            d1*a2 + e1*d2, d1*b2 + e1*e2, d1*c2 + e1*f2 + f1)
def T(x, y): return (1, 0, x, 0, 1, y)
def R(deg):
    t = math.radians(deg); c, s = math.cos(t), math.sin(t)
    return (c, -s, 0, s, c, 0)
def S(sx, sy): return (sx, 0, 0, 0, sy, 0)
def apply(m, x, y): return (m[0]*x + m[1]*y + m[2], m[3]*x + m[4]*y + m[5])

def solve_affine(src, dst):
    """求 2x3 仿射 G 使 G(src_i) = dst_i（三点）。返回 (a,b,c,d,e,f)。"""
    (x0, y0), (x1, y1), (x2, y2) = src
    (u0, v0), (u1, v1), (u2, v2) = dst
    det = x0*(y1 - y2) + x1*(y2 - y0) + x2*(y0 - y1)
    if abs(det) < 1e-9: return None
    # 解线性方程组 [x y 1] @ [a b c d e f]^T = [u v]
    import numpy as np
    A = np.array([[x0, y0, 1], [x1, y1, 1], [x2, y2, 1]], dtype=float)
    Bu = np.array([u0, u1, v0 if False else 0])
    # 分别解 u 和 v
    au = np.linalg.solve(A, np.array([u0, u1, u2]))
    av = np.linalg.solve(A, np.array([v0, v1, v2]))
    return (au[0], au[1], au[2], av[0], av[1], av[2])

class SpineComposer:
    def __init__(self, spine_dir, base='skeleton'):
        self.dir = spine_dir
        self.skel = json.load(open(os.path.join(spine_dir, base + '.json'), encoding='utf-8'))
        self.regions = parse_atlas(os.path.join(spine_dir, base + '.atlas'))
        # 页图像
        self.pages = {}
        for r in self.regions.values():
            p = r['page']
            if p not in self.pages:
                self.pages[p] = Image.open(os.path.join(spine_dir, p)).convert('RGBA')
        # 骨骼 setup 数据与世界变换
        self.bones = {}
        self.order = []
        for b in self.skel.get('bones', []):
            self.bones[b['name']] = b
            self.order.append(b['name'])
        self.world = {}
        for name in self.order:  # bones 数组保证父先于子
            self._world(name)
        # IK 约束解算（setup pose）
        self.iks = self.skel.get('ik', [])
        for ik in self.iks:
            self._apply_ik_setup(ik)
        self.slot_by_name = {s['name']: s for s in self.skel.get('slots', [])}

    def _recompute_subtree(self, root_name):
        """重算 root 及其全部后代的世界变换（局部 rotation 修改后）"""
        for name in self.order:
            b = self.bones[name]
            if name == root_name or (b.get('parent') and self._is_descendant(name, root_name)):
                self._world(name)

    def _is_descendant(self, name, ancestor):
        b = self.bones[name]
        p = b.get('parent')
        while p:
            if p == ancestor: return True
            p = self.bones[p].get('parent')
        return False

    def _apply_ik_setup(self, ik):
        """两骨/单骨 IK（setup pose, scale=1 假设, spine 3.4 语义: b2 尖端对准 target）"""
        bones = ik.get('bones', [])
        if not bones or ik.get('target') not in self.bones: return
        tgt = self.world[ik['target']]
        tgt_pos = (tgt[2], tgt[5])  # 世界平移 (c, f)
        bend = 1 if ik.get('bendPositive', True) else -1
        if len(bones) == 1:
            # 单骨: 旋转指向 target
            b1n = bones[0]; b1 = self.bones[b1n]
            par = b1.get('parent')
            pw = self.world[par] if par else ((1,0,0,0,1,0))
            # 逆变换 target 到 b1 父系
            tx, ty = self._inv_apply(pw, *tgt_pos)
            p0 = apply(self.world[b1n], 0, 0)
            ang = math.atan2(tgt_pos[1] - p0[1], tgt_pos[0] - p0[0])
            # parent 世界旋转
            pang = math.atan2(pw[3], pw[0])
            b1['rotation'] = math.degrees(ang - pang)
            self._world(b1n)
            self._recompute_subtree(b1n)
            return
        if len(bones) != 2: return
        b1n, b2n = bones
        b1, b2 = self.bones[b1n], self.bones[b2n]
        if b2.get('parent') != b1n:
            # 非父子链（罕见）: 直接放弃
            return
        par = b1.get('parent')
        pw = self.world[par] if par else ((1, 0, 0, 0, 1, 0))
        # 在 b1 父系中解算: p0 = b1 setup 局部平移（本来就是父系坐标）
        p0 = (b1.get('x', 0), b1.get('y', 0))
        # target 世界位置逆变换到 b1 父系
        tx, ty = self._inv_apply(pw, *tgt_pos)
        # 段长
        l1 = math.hypot(b2.get('x', 0), b2.get('y', 0))
        l2 = b2.get('length', 0)
        if l1 <= 0 or l2 <= 0: return
        dx, dy = tx - p0[0], ty - p0[1]
        d = math.hypot(dx, dy)
        if d < 1e-6: return
        maxd, mind = l1 + l2 - 1e-4, abs(l1 - l2) + 1e-4
        if d > maxd or d < mind:
            # 不可达: 伸直指向 target
            base = math.atan2(dy, dx)
            th1 = base
            th2rel = 0.0
        else:
            base = math.atan2(dy, dx)
            cosA = (l1*l1 + d*d - l2*l2) / (2*l1*d)
            A = math.acos(max(-1, min(1, cosA)))
            cosB = (l1*l1 + l2*l2 - d*d) / (2*l1*l2)
            B = math.acos(max(-1, min(1, cosB)))
            th1 = base - bend * A
            th2rel = bend * (math.pi - B)
        # 世界旋转 → 局部旋转（b1 父世界旋转, scale=1）
        pang = math.atan2(pw[3], pw[0])
        b1['rotation'] = math.degrees(th1 - pang)
        b2['rotation'] = math.degrees(th2rel)
        self._world(b1n)
        self._world(b2n)
        self._recompute_subtree(b1n)

    @staticmethod
    def _inv_apply(m, x, y):
        """世界坐标逆变换回 m 局部系（scale=1 假设下用旋转+平移逆）"""
        a, b, c, d, e, f = m
        det = a * e - b * d
        if abs(det) < 1e-9: return (x - c, y - f)
        ix = (e * (x - c) - b * (y - f)) / det
        iy = (-d * (x - c) + a * (y - f)) / det
        return (ix, iy)

    def _world(self, name):
        b = self.bones[name]
        local = mul(mul(T(b.get('x', 0), b.get('y', 0)),
                        R(b.get('rotation', 0))),
                    S(b.get('scaleX', 1), b.get('scaleY', 1)))
        p = b.get('parent')
        if p and p in self.world:
            self.world[name] = mul(self.world[p], local)
        else:
            self.world[name] = local

    def region_img(self, reg):
        """页图像中裁出 region，rotate:90 顺时针还原。返回 (RGBA图, w, h)。"""
        page = self.pages[reg['page']]
        x, y = reg['xy']; w, h = reg['size']
        if reg['rotate']:
            # 页面上占宽 h 高 w，先裁后顺时针转90°（transpose ROTATE_270 = 顺时针90°）
            img = page.crop((x, y, x + h, y + w)).transpose(Image.ROTATE_270)
        else:
            img = page.crop((x, y, x + w, y + h))
        return img, w, h

    def find_region(self, att, an=''):
        name = att.get('path') or an or att.get('name') or ''
        if name in self.regions: return self.regions[name]
        short = name.split('/')[-1]
        if short in self.regions: return self.regions[short]
        return None

    # ---------- 附件几何收集 ----------
    def collect(self):
        """返回 [(slot, att, kind, data)] drawOrder 列表 + 全部画布点集"""
        items, pts = [], []
        skel = self.skel
        default_skin = None
        for sk_name in skel.get('skins', {}):
            default_skin = skel['skins'][sk_name]  # 取第一个(敌人均为default)
            break
        for slot in skel.get('slots', []):
            an = slot.get('attachment')
            if not an: continue
            atts = default_skin.get(slot['name'], {})
            att = atts.get(an)
            if not att: continue
            t = att.get('type', 'region')
            if t == 'path': continue
            reg = self.find_region(att, an)
            if not reg: continue
            bw = self.world[slot['bone']]
            if t == 'region':
                w, h = reg['size']
                am = mul(mul(mul(bw, T(att.get('x', 0), att.get('y', 0))), R(att.get('rotation', 0))),
                         S(att.get('scaleX', 1), att.get('scaleY', 1)))
                quad = [apply(am, x, y) for x, y in
                        [(-w/2, -h/2), (w/2, -h/2), (w/2, h/2), (-w/2, h/2)]]
                canvas_quad = [(x, -y) for x, y in quad]
                pts += canvas_quad
                items.append((slot, att, 'region', (reg, canvas_quad)))
            elif t == 'mesh':
                uvs = att.get('uvs', [])
                verts = att.get('vertices', [])
                n = len(uvs) // 2
                bone_names = self.order
                canvas_pts = []
                if len(verts) == 2 * n:
                    # 简单 mesh: 直接坐标（相对骨骼, 无 boneCount 前缀）
                    for vi in range(n):
                        px, py = apply(bw, verts[2*vi], verts[2*vi+1])
                        canvas_pts.append((px, -py))
                else:
                    # 加权 mesh: [cnt, (boneIdx, x, y, weight)*cnt] 每顶点
                    i = 0
                    for _ in range(n):
                        cnt = int(verts[i]); i += 1
                        wx = wy = 0.0
                        for _k in range(cnt):
                            bi = int(verts[i]); vx = verts[i+1]; vy = verts[i+2]; wgt = verts[i+3]; i += 4
                            bn = bone_names[bi] if bi < len(bone_names) else None
                            if bn is None: continue
                            px, py = apply(self.world[bn], vx, vy)
                            wx += px * wgt; wy += py * wgt
                        canvas_pts.append((wx, -wy))
                pts += canvas_pts
                items.append((slot, att, 'mesh', (reg, uvs, verts, canvas_pts, att.get('triangles', []))))
        return items, pts

    def compose(self, out_path, scale=1.0, pad=4):
        items, pts = self.collect()
        if not items:
            raise RuntimeError('无可渲染附件')
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
        W = int(math.ceil((x1 - x0) * scale)) + pad * 2
        H = int(math.ceil((y1 - y0) * scale)) + pad * 2
        ox, oy = -x0 + pad / scale, -y0 + pad / scale  # 画布→世界平移（缩放前）
        canvas = Image.new('RGBA', (max(W, 1), max(H, 1)), (0, 0, 0, 0))
        for slot, att, kind, data in items:
            # slot tint
            tint = slot.get('color')
            if kind == 'region':
                reg, quad = data
                img, w, h = self.region_img(reg)
                if tint and tint.upper() != 'FFFFFFFF':
                    img = tint_img(img, tint)
                dq = [((qx + ox) * scale, (qy + oy) * scale) for qx, qy in quad]
                paste_quad(canvas, img, dq)
            else:
                reg, uvs, verts, canvas_pts, tris = data
                img, w, h = self.region_img(reg)
                if tint and tint.upper() != 'FFFFFFFF':
                    img = tint_img(img, tint)
                # uv → region 图素（spine json v=0 对应图像顶部, 实验验证: v*h 渲染覆盖率≈贴图非透明总数）
                src = [(uvs[i] * w, uvs[i+1] * h) for i in range(0, len(uvs), 2)]
                dst = [((p[0] + ox) * scale, (p[1] + oy) * scale) for p in canvas_pts]
                for t in range(0, len(tris), 3):
                    i0, i1, i2 = tris[t], tris[t+1], tris[t+2]
                    if max(i0, i1, i2) >= len(dst): continue
                    paste_tri(canvas, img, (dst[i0], dst[i1], dst[i2]),
                              (src[i0], src[i1], src[i2]))
        canvas.save(out_path)
        return canvas.size

def tint_img(img, hexcolor):
    r = int(hexcolor[0:2], 16); g = int(hexcolor[2:4], 16); b = int(hexcolor[4:6], 16)
    a = int(hexcolor[6:8], 16) if len(hexcolor) >= 8 else 255
    bands = img.split()
    bands = (bands[0].point(lambda p: p * r // 255),
             bands[1].point(lambda p: p * g // 255),
             bands[2].point(lambda p: p * b // 255),
             bands[3].point(lambda p: p * a // 255))
    return Image.merge('RGBA', bands)

def paste_quad(canvas, img, quad):
    """四边形（左下/右下/右上/左上 顺序变换后的画布点）贴图。
    quad 顺序: [-w/2,-h/2], [w/2,-h/2], [w/2,h/2], [-w/2,h/2] → 画布上依次为 (世界)左下,右下,右上,左上
    图像像素: (0,0)=左上, (w,h)=右下 → 源三点用 (0,0),(w,0),(w,h) 对应画布 左上,右上,右下
    """
    bl, br, tr, tl = quad
    # 图像角: 左上(0,0) 右上(w,0) 右下(w,h) 左下(0,h)
    W, H = img.size
    g = solve_affine((tl, tr, br), ((0, 0), (W, 0), (W, H)))
    if g is None: return
    xs = [p[0] for p in quad]; ys = [p[1] for p in quad]
    bx0, by0 = int(math.floor(min(xs))), int(math.floor(min(ys)))
    bx1, by1 = int(math.ceil(max(xs))), int(math.ceil(max(ys)))
    bw, bh = max(bx1 - bx0, 1), max(by1 - by0, 1)
    # 平移到 AABB 原点: G_rel(x_rel) = G(x_rel + b) → t' = t + A·b
    g2 = (g[0], g[1], g[2] + (g[0] * bx0 + g[1] * by0), g[3], g[4], g[5] + (g[3] * bx0 + g[4] * by0))
    patch = img.transform((bw, bh), Image.AFFINE, g2, resample=Image.BILINEAR)
    mask = Image.new('L', (bw, bh), 0)
    ImageDraw.Draw(mask).polygon([(tl[0]-bx0, tl[1]-by0), (tr[0]-bx0, tr[1]-by0),
                                  (br[0]-bx0, br[1]-by0), (bl[0]-bx0, bl[1]-by0)], fill=255)
    canvas.paste(patch, (bx0, by0), mask)

def expand_tri(pts, px=1.0):
    """三角形沿质心方向外扩 px（消除 BILINEAR 边缘采样透明缝）"""
    cx = sum(p[0] for p in pts) / 3; cy = sum(p[1] for p in pts) / 3
    out = []
    for x, y in pts:
        dx, dy = x - cx, y - cy
        L = (dx*dx + dy*dy) ** 0.5 or 1.0
        out.append((x + dx/L*px, y + dy/L*px))
    return out

def paste_tri(canvas, img, dst3, src3):
    src3 = expand_tri(src3, 1.0)  # 源外扩: 边缘采样落入真实邻域像素
    g = solve_affine(dst3, src3)  # 画布→源
    if g is None: return
    xs = [p[0] for p in dst3]; ys = [p[1] for p in dst3]
    bx0, by0 = int(math.floor(min(xs))), int(math.floor(min(ys)))
    bx1, by1 = int(math.ceil(max(xs))), int(math.ceil(max(ys)))
    bw, bh = max(bx1 - bx0, 1), max(by1 - by0, 1)
    g2 = (g[0], g[1], g[2] + (g[0] * bx0 + g[1] * by0), g[3], g[4], g[5] + (g[3] * bx0 + g[4] * by0))
    patch = img.transform((bw, bh), Image.AFFINE, g2, resample=Image.BILINEAR)
    mask = Image.new('L', (bw, bh), 0)
    d = ImageDraw.Draw(mask)
    poly = [(p[0]-bx0, p[1]-by0) for p in dst3]
    d.polygon(poly, fill=255)
    canvas.paste(patch, (bx0, by0), mask)

if __name__ == '__main__':
    sd = sys.argv[1]; out = sys.argv[2]
    scale = 1.0
    if '--scale' in sys.argv: scale = float(sys.argv[sys.argv.index('--scale') + 1])
    c = SpineComposer(sd)
    size = c.compose(out, scale=scale)
    print(f'{out} {size[0]}x{size[1]}')
