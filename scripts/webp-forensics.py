#!/usr/bin/env python3
"""WebP 动画取证：提取 ANMF 原始帧（不做画布合成），测量每帧不透明覆盖率
   判定: 全姿势帧(coverage≈整只怪) vs 增量帧(coverage≈小补丁)
   用法: python3 webp-forensics.py [文件名...]  (默认扫描 public/assets/enemies)
"""
import struct, sys, io, os
from PIL import Image

def iter_anmf(data):
    """yield (offset, size, header_bytes) for each ANMF chunk"""
    pos = 12
    while pos + 8 <= len(data):
        fourcc = data[pos:pos+4]
        size = struct.unpack('<I', data[pos+4:pos+8])[0]
        if fourcc == b'ANMF':
            yield pos, size, data[pos+8:pos+8+16]
        pos += 8 + size + (size & 1)

def chunk(fourcc, payload):
    out = fourcc + struct.pack('<I', len(payload)) + payload
    if len(payload) & 1: out += b'\x00'
    return out

def raw_frame_image(data, anmf_off, anmf_size, canvas_w, canvas_h):
    """把 ANMF 帧的 ALPH+VP8 包成单帧动画 WebP（blend=1/dispose=1 无合成）并用 PIL 解码"""
    hdr = 16
    p = anmf_off + 8 + hdr
    end = anmf_off + 8 + anmf_size
    alph = vp8 = None
    fx = fy = fw = fh = 0
    while p + 8 <= end:
        f = data[p:p+4]; s = struct.unpack('<I', data[p+4:p+8])[0]
        body = data[p+8:p+8+s]
        if f == b'ALPH': alph = body
        elif f == b'VP8 ': vp8 = body
        elif f == b'VP8L':
            vp8 = body; alph = None   # 无损帧自带 alpha
        p += 8 + s + (s & 1)
    if vp8 is None: return None, None
    h = data[anmf_off+8:anmf_off+8+16]
    fx = h[0]|h[1]<<8|h[2]<<16; fy = h[3]|h[4]<<8|h[5]<<16
    fw = (h[6]|h[7]<<8|h[8]<<16)+1; fh = (h[9]|h[10]<<8|h[11]<<16)+1
    # VP8X: flags(1)+rsv(3)+canvas_w-1(3)+canvas_h-1(3); anim(0x02)+alpha(0x10)
    flags = 0x12 if alph is not None else 0x02
    vp8x = bytes([flags,0,0,0]) + struct.pack('<I', canvas_w-1)[:3] + struct.pack('<I', canvas_h-1)[:3]
    anim = struct.pack('<I', 0) + struct.pack('<H', 0)   # 背景透明, 循环0
    # ANMF头: x(3) y(3) w-1(3) h-1(3) dur(3) flags(1)=0xC0 (blend=1覆盖 + dispose=1清除)
    anmf_hdr = (struct.pack('<I', fx)[:3] + struct.pack('<I', fy)[:3] +
                struct.pack('<I', fw-1)[:3] + struct.pack('<I', fh-1)[:3] +
                b'\x64\x00\x00' + b'\xc0')
    frame_payload = anmf_hdr
    if alph is not None: frame_payload += chunk(b'ALPH', alph)
    frame_payload += chunk(b'VP8 ' if alph is not None else b'VP8L', vp8)
    parts = [chunk(b'VP8X', vp8x), chunk(b'ANIM', anim), chunk(b'ANMF', frame_payload)]
    body = b''.join(parts)
    riff = b'RIFF' + struct.pack('<I', len(body)+4) + b'WEBP' + body
    im = Image.open(io.BytesIO(riff)).convert('RGBA')
    return im, (fx, fy)

def analyze(path):
    data = open(path,'rb').read()
    # 画布尺寸: 从 VP8X
    pos = 12; cw = ch = 0
    while pos + 8 <= len(data):
        f = data[pos:pos+4]; s = struct.unpack('<I', data[pos+4:pos+8])[0]
        if f == b'VP8X':
            # VP8X payload: flags(1)+rsv(3)+w-1(3)+h-1(3); payload起始于 pos+8
            cw = (data[pos+12]|data[pos+13]<<8|data[pos+14]<<16)+1
            ch = (data[pos+15]|data[pos+16]<<8|data[pos+17]<<16)+1
            break
        pos += 8 + s + (s & 1)
    results = []
    for off, size, hdr in iter_anmf(data):
        w = (hdr[6]|hdr[7]<<8|hdr[8]<<16)+1
        h = (hdr[9]|hdr[10]<<8|hdr[11]<<16)+1
        im, _ = raw_frame_image(data, off, size, cw, ch)
        if im is None:
            results.append((w,h,None)); continue
        # 不透明像素占整帧矩形的比例
        import numpy as np
        a = np.array(im)[...,3]
        cov = (a>30).mean()*100
        results.append((w,h,round(cov,1)))
    return (cw,ch), results

if __name__ == '__main__':
    names = sys.argv[1:] or ['jawworm','acidslimeS','redlouse','greenlouse','nob','shieldGremlin','spikeSlimeS','blueSlaver','redSlaver','cultist','fungibeast']
    for n in names:
        p = f'/home/z/my-project/public/assets/enemies/{n}.webp'
        if not os.path.exists(p): print(f'{n}: MISSING'); continue
        (cw,ch), res = analyze(p)
        covs = [c for _,_,c in res if c is not None]
        full_pose = sum(1 for c in covs if c > 15)   # >15%画布覆盖≈完整姿势
        print(f'{n}: canvas={cw}x{ch} frames={len(res)} 帧内不透明覆盖率={covs} 全姿势帧数={full_pose}/{len(covs)}')
