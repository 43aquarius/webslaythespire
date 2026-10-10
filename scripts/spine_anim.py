#!/usr/bin/env python3
"""Spine 3.4 idle 动画烘焙器（第二十七批）
从原版 skeleton.json 的 animations 逐帧采样，烘焙循环 WebP 动图（替换静态立绘）。
通道支持: bones(rotate/translate/scale/shear) + slots(attachment/color) + deform(FFD, 加权/简单mesh) + drawOrder
曲线: 线性 / stepped / 贝塞尔 [cx1,cy1,cx2,cy2]（二分求根）
跳过: paths / events（特效曲线与音效事件，不影响外观）
IK: setup 约束每帧重解（52 敌 idle 无 ik 动画通道）
坐标系: spine 世界 y 向上 → 画布 y 翻转（同 spine_compose）
权重: 与原版内嵌 runtime (com.esotericsoftware.spine.Bone) 公式逐行对齐
用法:
  python3 spine_anim.py <spine目录> <输出.webp> [--base skeleton] [--anim idle]
                        [--fps 10] [--max-frames 32] [--max-side 420] [--quality 80]
"""
import io, json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spine_compose import SpineComposer, parse_atlas, tint_img, paste_quad, paste_tri, solve_affine, apply, mul, T, R, S
from PIL import Image

# ---------- 贝塞尔曲线（spine CurveTimeline.bezierCurveValue 语义） ----------
def bez_y(alpha, cx1, cy1, cx2, cy2):
    """P0=(0,0) P1=(cx1,cy1) P2=(cx2,cy2) P3=(1,1)；给定 x=alpha 求 y。x(t) 在 [0,1] 单调。"""
    if alpha <= 0: return 0.0
    if alpha >= 1: return 1.0
    lo, hi = 0.0, 1.0
    for _ in range(48):
        mid = (lo + hi) / 2
        t1 = 1 - mid
        x = 3 * t1 * t1 * mid * cx1 + 3 * t1 * mid * mid * cx2 + mid * mid * mid
        if x < alpha: lo = mid
        else: hi = mid
    t = (lo + hi) / 2
    t1 = 1 - t
    return 3 * t1 * t1 * t * cy1 + 3 * t1 * t * t * cy2 + t * t * t

def curve_alpha(k0, k1, t):
    """区间 [k0,k1] 内时间归一化 → 值归一化。"""
    t0, t1 = k0.get('time', 0), k1.get('time', 0)
    if t1 <= t0: return 1.0
    a = (t - t0) / (t1 - t0)
    c = k0.get('curve')
    if c == 'stepped': return 0.0
    if isinstance(c, list) and len(c) == 4:
        return bez_y(a, c[0], c[1], c[2], c[3])
    return a

def find_seg(keys, t):
    """返回 (k0, k1)。首帧之前 → (None, None)（timeline 不生效, 保持 setup）；
    末帧之后 → (last, None)（保持末值）；单 key → (k0, None)。"""
    if t < keys[0].get('time', 0):
        return None, None
    if len(keys) == 1 or t >= keys[-1].get('time', 0):
        return keys[-1], None
    lo, hi = 0, len(keys) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if keys[mid].get('time', 0) <= t: lo = mid
        else: hi = mid
    return keys[lo], keys[hi]

def lerp(a, b, p): return a + (b - a) * p


class SpineAnimator(SpineComposer):
    def __init__(self, spine_dir, base='skeleton'):
        super().__init__(spine_dir, base)
        # setup pose 备份（骨骼局部 + 槽位状态）
        self._sb = {}
        for n, b in self.bones.items():
            self._sb[n] = {k: b.get(k, d) for k, d in [
                ('rotation', 0), ('x', 0), ('y', 0),
                ('scaleX', 1), ('scaleY', 1), ('shearX', 0), ('shearY', 0)]}
        self._ss = {s['name']: {'attachment': s.get('attachment'), 'color': s.get('color')}
                    for s in self.skel.get('slots', [])}
        self._slot_order_setup = [s['name'] for s in self.skel.get('slots', [])]
        # 动画解析
        self.anims = self.skel.get('animations', {})
        # 渲染缓存
        self._img_cache = {}
        self._deform_now = {}
        self._wi_cache = {}

    # ---------- 世界变换（Bone.updateWorldTransform 对齐, 含 shear, 全继承） ----------
    def _world(self, name):
        b = self.bones[name]
        rot = b.get('rotation', 0)
        sx, sy = b.get('scaleX', 1), b.get('scaleY', 1)
        shx, shy = b.get('shearX', 0), b.get('shearY', 0)
        rotY = rot + 90.0 + shy
        r = math.radians
        la = math.cos(r(rot + shx)) * sx
        lb = math.cos(r(rotY)) * sy
        lc = math.sin(r(rot + shx)) * sx
        ld = math.sin(r(rotY)) * sy
        x, y = b.get('x', 0), b.get('y', 0)
        p = b.get('parent')
        if p and p in self.world:
            # 6 元组约定: (a, b, tx, c, d, ty) —— apply: x'=a*x+b*y+tx, y'=c*x+d*y+ty
            # libGDX: a=pa*la+pb*lc; b=pa*lb+pb*ld; c=pc*la+pd*lc; d=pc*lb+pd*ld;
            #         worldX=pa*x+pb*y+p.worldX; worldY=pc*x+pd*y+p.worldY
            pa, pb, ptx, pc, pd, pty = self.world[p]
            self.world[name] = (pa * la + pb * lc, pa * lb + pb * ld,
                                pa * x + pb * y + ptx,
                                pc * la + pd * lc, pc * lb + pd * ld,
                                pc * x + pd * y + pty)
        else:
            self.world[name] = (la, lb, x, lc, ld, y)

    # ---------- 通道采样 ----------
    def _sample_bones(self, anim, t):
        for tgt, tls in anim.get('bones', {}).items():
            b = self.bones.get(tgt)
            if b is None: continue
            sb = self._sb[tgt]
            for kind, keys in tls.items():
                if not keys: continue
                k0, k1 = find_seg(keys, t)
                if k0 is None: continue  # 首帧前不生效（保持 setup）
                if k1 is None:  # 末帧保持
                    if kind == 'rotate':
                        b['rotation'] = k0.get('angle', sb['rotation'])
                    elif kind == 'translate':
                        b['x'] = k0.get('x', sb['x']); b['y'] = k0.get('y', sb['y'])
                    elif kind == 'scale':
                        b['scaleX'] = k0.get('x', sb['scaleX']); b['scaleY'] = k0.get('y', sb['scaleY'])
                    elif kind == 'shear':
                        b['shearX'] = k0.get('x', sb['shearX']); b['shearY'] = k0.get('y', sb['shearY'])
                    continue
                p = curve_alpha(k0, k1, t)
                if kind == 'rotate':
                    v0 = k0.get('angle', sb['rotation']); v1 = k1.get('angle', sb['rotation'])
                    b['rotation'] = lerp(v0, v1, p)
                elif kind == 'translate':
                    b['x'] = lerp(k0.get('x', sb['x']), k1.get('x', sb['x']), p)
                    b['y'] = lerp(k0.get('y', sb['y']), k1.get('y', sb['y']), p)
                elif kind == 'scale':
                    b['scaleX'] = lerp(k0.get('x', sb['scaleX']), k1.get('x', sb['scaleX']), p)
                    b['scaleY'] = lerp(k0.get('y', sb['scaleY']), k1.get('y', sb['scaleY']), p)
                elif kind == 'shear':
                    b['shearX'] = lerp(k0.get('x', sb['shearX']), k1.get('x', sb['shearX']), p)
                    b['shearY'] = lerp(k0.get('y', sb['shearY']), k1.get('y', sb['shearY']), p)

    def _sample_slots(self, anim, t):
        for tgt, tls in anim.get('slots', {}).items():
            for kind, keys in tls.items():
                if not keys: continue
                k0, k1 = find_seg(keys, t)
                if k0 is None: continue  # 首帧前不生效
                if kind == 'attachment':
                    self._slot_att[tgt] = k0.get('name')  # stepped 语义, 可为 None
                elif kind == 'color':
                    setup_c = self._ss[tgt].get('color') or 'FFFFFFFF'
                    if k1 is not None:
                        p = curve_alpha(k0, k1, t)
                        c0 = hexc(k0.get('color', setup_c)); c1 = hexc(k1.get('color', setup_c))
                        self._slot_color[tgt] = '%02X%02X%02X%02X' % tuple(
                            int(round(lerp(a, b, p))) for a, b in zip(c0, c1))
                    else:
                        self._slot_color[tgt] = k0.get('color', setup_c)

    def _expand_deform_key(self, key, setup_2n, deform_len, weighted):
        """按 SkeletonJson 语义展开 key → 与 DeformTimeline.frameVertices 同构的数组。
        weighted: 零基增量流（长度 2·Σk），json 值从 offset 填入（未覆盖=0 增量）。
        非加权: setup 平面坐标 + json 增量 = 绝对坐标（长度 2n）。"""
        v = key.get('vertices')
        if v is None:
            return list(setup_2n) if not weighted else [0.0] * deform_len
        start = key.get('offset', 0)
        if weighted:
            out = [0.0] * deform_len
            for i, val in enumerate(v):
                if start + i < deform_len: out[start + i] = val
            return out
        out = list(setup_2n)
        for i, val in enumerate(v):
            if start + i < len(out): out[start + i] = out[start + i] + val
        return out

    def _weighted_info(self, att, key):
        """缓存 json 混合顶点 → (ks, bones_stream, xyw, setup_2n, deform_len)。
        非加权时 ks=None, setup_2n=平面坐标; weighted 时 setup_2n=None。"""
        cache = self._wi_cache
        if key in cache: return cache[key]
        jv = att.get('vertices', [])
        n = len(att.get('uvs', [])) // 2
        if len(jv) == 2 * n:
            info = (None, None, None, jv, len(jv))
        else:
            ks, bones_stream, xyw = [], [], []
            i = 0
            while i < len(jv):
                k = int(jv[i]); i += 1
                ks.append(k); bones_stream.append(k)
                for _ in range(k):
                    bones_stream.append(int(jv[i]))
                    xyw.extend(jv[i+1:i+4])
                    i += 4
            info = (ks, bones_stream, xyw, None, len(xyw) // 3 * 2)
        cache[key] = info
        return info

    def _sample_deform(self, anim, t, skin_map):
        self._deform_now = {}
        for skin, slots in anim.get('deform', {}).items():
            for sl, atts in slots.items():
                for at, keys in atts.items():
                    if not keys: continue
                    att = skin_map.get((sl, at))
                    if att is None: continue
                    if att.get('type', 'mesh') != 'mesh':
                        continue  # region deform 不存在（json 仅 mesh 导出）
                    ks, bs, xyw, setup_2n, dl = self._weighted_info(att, (sl, at))
                    weighted = ks is not None
                    k0, k1 = find_seg(keys, t)
                    if k0 is None: continue  # 首帧前不生效 → setup（无增量）
                    v0 = self._expand_deform_key(k0, setup_2n, dl, weighted)
                    if k1 is not None:
                        p = curve_alpha(k0, k1, t)
                        v1 = self._expand_deform_key(k1, setup_2n, dl, weighted)
                        v0 = [lerp(a, b, p) for a, b in zip(v0, v1)]
                    self._deform_now[(sl, at)] = v0

    def _sample_draw_order(self, anim, t):
        """Spine 3.4 语义（SkeletonJson.java 629-652）: offsets 仅含 {slot, offset}。
        产物 = slot 索引数组（渲染顺序），未提及的 slot 按原序填入空位。"""
        keys = anim.get('drawOrder', [])
        if not keys:
            self._slot_order = self._slot_order_setup
            return
        k = None
        for kk in keys:
            if kk.get('time', 0) <= t: k = kk
            else: break
        if k is None or not k.get('offsets'):
            self._slot_order = self._slot_order_setup
            return
        slot_idx = {n: i for i, n in enumerate(self._slot_order_setup)}
        cnt = len(self._slot_order_setup)
        draw_order = [-1] * cnt
        offsets = k['offsets']
        unchanged = [0] * (cnt - len(offsets))
        oi = 0  # originalIndex
        ui = 0  # unchangedIndex
        for om in sorted(offsets, key=lambda x: slot_idx.get(x.get('slot'), 0)):
            si = slot_idx.get(om.get('slot'))
            if si is None: continue
            while oi != si:
                unchanged[ui] = oi; ui += 1; oi += 1
            pos = oi + int(om.get('offset', 0))
            if 0 <= pos < cnt: draw_order[pos] = oi
            oi += 1
        while oi < cnt:
            unchanged[ui] = oi; ui += 1; oi += 1
        for j in range(cnt - 1, -1, -1):
            if draw_order[j] == -1:
                ui -= 1
                draw_order[j] = unchanged[ui]
        self._slot_order = [self._slot_order_setup[i] for i in draw_order if i >= 0]

    # ---------- 姿态应用 ----------
    def _set_setup_pose(self):
        """恢复 setup 姿态（原始 setup + IK 解算，与第二十四批静态图一致；IK 幂等）"""
        for n, sv in self._sb.items():
            b = self.bones[n]
            for k, v in sv.items(): b[k] = v
        for n in self.order: self._world(n)
        self._deform_now = {}
        self._slot_order = self._slot_order_setup
        self._slot_att = {n: v['attachment'] for n, v in self._ss.items()}
        self._slot_color = {n: v['color'] for n, v in self._ss.items()}
        for ik in self.iks: self._apply_ik_setup(ik)

    def set_pose(self, anim_name, t):
        anim = self.anims[anim_name]
        # 1. 恢复 setup 局部 pose
        self._set_setup_pose()
        # 2. 通道采样（顺序同 Animation.apply: bones → slots → deform → drawOrder）
        self._sample_bones(anim, t)
        # 3. 世界重推 + IK 重解
        for n in self.order: self._world(n)
        skin_map = self._skin_map()
        self._sample_slots(anim, t)
        self._sample_deform(anim, t, skin_map)
        self._sample_draw_order(anim, t)
        for ik in self.iks: self._apply_ik_setup(ik)

    def _skin_map(self):
        if not hasattr(self, '_skin_map_cache'):
            m = {}
            for sk_name, slots in self.skel.get('skins', {}).items():
                for sl, atts in slots.items():
                    for at, att in atts.items():
                        m[(sl, at)] = att
            self._skin_map_cache = m
        return self._skin_map_cache

    # ---------- 渲染（collect 覆写: 动画槽位状态 + deform + drawOrder 顺序） ----------
    def _img_tinted(self, reg, tint):
        key = (reg['page'], reg['xy'][0], reg['xy'][1], tint)
        if key not in self._img_cache:
            img, w, h = self.region_img(reg)
            if tint and tint.upper() != 'FFFFFFFF':
                img = tint_img(img, tint)
            self._img_cache[key] = img
        return self._img_cache[key]

    def collect(self):
        items, pts = [], []
        skin_map = self._skin_map()
        for slot_name in self._slot_order:
            an = self._slot_att.get(slot_name)
            if not an: continue
            att = skin_map.get((slot_name, an))
            if not att: continue
            t = att.get('type', 'region')
            if t == 'path': continue
            reg = self.find_region(att, an)
            if not reg: continue
            slot = self.slot_by_name[slot_name]
            tint = self._slot_color.get(slot_name) or slot.get('color')
            bw = self.world[slot['bone']]
            if t == 'region':
                w, h = reg['size']
                am = mul(mul(mul(bw, T(att.get('x', 0), att.get('y', 0))), R(att.get('rotation', 0))),
                         S(att.get('scaleX', 1), att.get('scaleY', 1)))
                quad = [apply(am, x, y) for x, y in
                        [(-w/2, -h/2), (w/2, -h/2), (w/2, h/2), (-w/2, h/2)]]
                canvas_quad = [(x, -y) for x, y in quad]
                pts += canvas_quad
                items.append((slot, att, 'region', (reg, canvas_quad, tint)))
            elif t == 'mesh':
                uvs = att.get('uvs', [])
                n = len(uvs) // 2
                deform = self._deform_now.get((slot_name, an))
                ks, bs, xyw, setup_2n, dl = self._weighted_info(att, (slot_name, an))
                canvas_pts = []
                if ks is None:
                    # 非加权: deform 为绝对坐标（2n），否则 setup
                    verts = deform if deform is not None else setup_2n
                    for vi in range(n):
                        px, py = apply(bw, verts[2*vi], verts[2*vi+1])
                        canvas_pts.append((px, -py))
                else:
                    # 加权: 世界顶点 = Σ ((x+dx)·boneA + (y+dy)·boneB + boneW)·w
                    # （VertexAttachment.computeWorldVertices 100-115 行逐行对齐）
                    b = f = vstream = 0
                    for vi in range(n):
                        kk = bs[vstream]; vstream += 1
                        wx = wy = 0.0
                        for _ in range(kk):
                            bi = bs[vstream]; vstream += 1
                            vx = xyw[b] + (deform[f] if deform is not None else 0.0)
                            vy = xyw[b+1] + (deform[f+1] if deform is not None else 0.0)
                            wgt = xyw[b+2]
                            b += 3; f += 2
                            bn = self.order[bi] if 0 <= bi < len(self.order) else None
                            if bn is None: continue
                            m = self.world[bn]
                            wx += (vx * m[0] + vy * m[1] + m[2]) * wgt
                            wy += (vx * m[3] + vy * m[4] + m[5]) * wgt
                        canvas_pts.append((wx, -wy))
                pts += canvas_pts
                items.append((slot, att, 'mesh', (reg, uvs, None, canvas_pts, att.get('triangles', []), tint)))
        return items, pts

    # ---------- 烘焙 ----------
    def anim_duration(self, anim_name):
        anim = self.anims[anim_name]
        tmax = 0.0
        for ch in ('bones', 'slots'):
            for tgt, tls in anim.get(ch, {}).items():
                for kind, keys in tls.items():
                    if keys: tmax = max(tmax, keys[-1].get('time', 0))
        for kk in anim.get('drawOrder', []):
            tmax = max(tmax, kk.get('time', 0))
        for skin, slots in anim.get('deform', {}).items():
            for sl, atts in slots.items():
                for at, keys in atts.items():
                    if keys: tmax = max(tmax, keys[-1].get('time', 0))
        return tmax

    def render_frames(self, anim_name, n_frames, max_side=420, pad=4, setup_frame=False):
        """采样 n 帧（t = dur*i/n，i∈[0,n)），联合 bbox 固定画布，返回 (帧列表, 画布规格)"""
        dur = self.anim_duration(anim_name)
        ts = [dur * i / n_frames for i in range(n_frames)]
        if setup_frame:
            ts.append(-1)  # -1 = setup pose（用于 bbox 防御）
        samples = []
        all_pts = []
        for t in ts:
            if t < 0:
                self._set_setup_pose()
            else:
                self.set_pose(anim_name, t)
            items, pts = self.collect()
            samples.append(items)
            all_pts += pts
        xs = [p[0] for p in all_pts]; ys = [p[1] for p in all_pts]
        x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
        side = max(x1 - x0, y1 - y0)
        scale = min(1.0, (max_side - pad * 2) / side) if side > 0 else 1.0
        W = int(math.ceil((x1 - x0) * scale)) + pad * 2
        H = int(math.ceil((y1 - y0) * scale)) + pad * 2
        ox, oy = -x0 + pad / scale, -y0 + pad / scale
        frames = []
        for items in samples:
            canvas = Image.new('RGBA', (max(W, 1), max(H, 1)), (0, 0, 0, 0))
            for slot, att, kind, data in items:
                if kind == 'region':
                    reg, quad, tint = data
                    img = self._img_tinted(reg, tint)
                    dq = [((qx + ox) * scale, (qy + oy) * scale) for qx, qy in quad]
                    paste_quad(canvas, img, dq)
                else:
                    reg, uvs, verts, canvas_pts, tris, tint = data
                    img, w, h = self._img_tinted_raw(reg, tint)
                    src = [(uvs[i] * w, uvs[i+1] * h) for i in range(0, len(uvs), 2)]
                    dst = [((p[0] + ox) * scale, (p[1] + oy) * scale) for p in canvas_pts]
                    for ti in range(0, len(tris), 3):
                        i0, i1, i2 = tris[ti], tris[ti+1], tris[ti+2]
                        if max(i0, i1, i2) >= len(dst): continue
                        paste_tri(canvas, img, (dst[i0], dst[i1], dst[i2]),
                                  (src[i0], src[i1], src[i2]))
            frames.append(canvas)
        return frames, (W, H, scale)

    def _img_tinted_raw(self, reg, tint):
        """mesh 需要原图尺寸 (w,h)，走独立缓存"""
        key = ('raw', reg['page'], reg['xy'][0], reg['xy'][1], tint)
        if key not in self._img_cache:
            img, w, h = self.region_img(reg)
            if tint and tint.upper() != 'FFFFFFFF':
                img = tint_img(img, tint)
            self._img_cache[key] = (img, w, h)
        return self._img_cache[key]


def hexc(h):
    h = (h or 'FFFFFFFF').strip('#')
    if len(h) == 6: h += 'FF'
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), int(h[6:8], 16))


def bake(spine_dir, out, anim, base='skeleton', fps=10, max_frames=32,
         max_side=420, quality=80, alpha_quality=90, method=6, minimize=False):
    a = SpineAnimator(spine_dir, base)
    dur = a.anim_duration(anim)
    n = max(1, min(max_frames, int(math.ceil(dur * fps))))
    frames, (W, H, scale) = a.render_frames(anim, n, max_side=max_side)
    per = int(round(1000 * dur / n))
    frames[0].save(out, save_all=True, append_images=frames[1:],
                   duration=per, loop=0, format='WEBP',
                   quality=quality, alpha_quality=alpha_quality, method=method,
                   minimize_size=minimize, lossless=False)
    kb = os.path.getsize(out) / 1024
    return dict(frames=n, dur=round(dur, 2), size=f'{W}x{H}', ms=per, kb=round(kb, 1))


if __name__ == '__main__':
    sd, out = sys.argv[1], sys.argv[2]
    kw = {}
    args = sys.argv[3:]
    def opt(n, cast):
        if n in args: kw[n.lstrip('-').replace('-', '_')] = cast(args[args.index(n) + 1])
    opt('--base', str); opt('--anim', str); opt('--fps', int); opt('--max-frames', int)
    opt('--max-side', int); opt('--quality', int)
    print(json.dumps(bake(sd, out, **kw), ensure_ascii=False))
