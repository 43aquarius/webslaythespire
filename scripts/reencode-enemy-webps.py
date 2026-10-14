#!/usr/bin/env python3
"""批量重编码修复怪物贴图（第四十一批）

输入: public/assets/enemies/*.webp 中 43 个"全姿势帧"文件
      (已在 fix-enemy-webp-dispose.py 打过 dispose 补丁 —— 使 PIL 逐帧解码得到独立干净帧)

流程: PIL 逐帧提取(干净全画布RGBA) -> save_all 重编码(q95 method6, 保留每帧时长)
      -> 二进制补丁 ANMF flags |= 0xC0 (blend=覆盖 + dispose=帧后清除, 每帧独立显示)
      -> 覆盖写回

不动: 7 个 delta 动画(acidslimeS/deca/giantHead/gremlinWizard/guardian/spikeSlimeM/spikeSlimeS)
      + 2 个静态图(bronzeOrb/hexaghost)
"""
import struct, os
import numpy as np
from PIL import Image

ENEMIES = 'public/assets/enemies'

FULL_POSE = '''acidslimeM awakenedOne blueSlaver bookOfStabbing bronzeAutomaton
byrd centurion chosen corruptHeart cultist dagger darkling donu fatGremlin
fungibeast greenlouse gremlinLeader jawworm lagavulin madGremlin mystic nemesis
nob orbWalker redSlaver redlouse reptomancer repulsor sentry shieldGremlin
slimeboss sneakyGremlin sphericGuardian spiker spireGrowth spireShield
spireSpear taskmaster theChamp theCollector timeEater transient
writhingMass'''.split()

def parse_anmf_meta(data):
    """返回每帧时长列表 + ANIM loop count"""
    pos = 12; durs = []; loop = 0
    while pos+8 <= len(data):
        f = data[pos:pos+4]; s = struct.unpack('<I', data[pos+4:pos+8])[0]
        if f == b'ANIM':
            loop = struct.unpack('<H', data[pos+12:pos+14])[0]
        elif f == b'ANMF':
            b = data[pos+8:pos+8+16]
            durs.append(b[12]|b[13]<<8|b[14]<<16)
        pos += 8+s+(s&1)
    return durs, loop

def patch_flags_c0(path):
    """把文件内所有 ANMF flags 字节 |= 0xC0"""
    data = bytearray(open(path,'rb').read())
    pos = 12; n = 0
    while pos+8 <= len(data):
        f = bytes(data[pos:pos+4]); s = struct.unpack('<I', data[pos+4:pos+8])[0]
        if f == b'ANMF':
            off = pos+8+15
            data[off] = data[off] | 0xC0
            n += 1
        pos += 8+s+(s&1)
    open(path,'wb').write(bytes(data))
    return n

report = []
for name in FULL_POSE:
    path = os.path.join(ENEMIES, f'{name}.webp')
    bak = f'.zscripts/webp-backup-before-dispose-fix/{name}.webp'
    orig_size = os.path.getsize(path)
    # 断点续跑: 若当前文件与备份一致(仅差dispose补丁)则待处理; 若已差异(重编码过)则跳过
    cur = open(path,'rb').read()
    bakdata = open(bak,'rb').read()
    def only_dispose_diff(a, b):
        """a 是否 = b + 仅 ANMF flags 字节被 |0xC0"""
        if len(a) != len(b): return False
        diffs = [i for i in range(len(a)) if a[i] != b[i]]
        if not diffs: return True   # 完全一致(未打补丁的漏网)
        # 所有差异字节必须恰为某 ANMF flags 偏移且差值 = 0xC0 位
        pos = 12; flag_offs = set()
        while pos+8 <= len(b):
            f = b[pos:pos+4]; s = struct.unpack('<I', b[pos+4:pos+8])[0]
            if f == b'ANMF': flag_offs.add(pos+8+15)
            pos += 8+s+(s&1)
        return all(o in flag_offs and (a[o] | 0xC0) == (b[o] | 0xC0) for o in diffs)
    if not only_dispose_diff(cur, bakdata):
        report.append((name, 'DONE(已重编码,跳过)', f'{orig_size}B'))
        print(f'{name}: 已重编码, 跳过', flush=True)
        continue
    # 从备份恢复 -> 打 dispose 补丁(供PIL逐帧独立解码)
    data = bytearray(bakdata)
    pos = 12
    while pos+8 <= len(data):
        f = bytes(data[pos:pos+4]); s = struct.unpack('<I', data[pos+4:pos+8])[0]
        if f == b'ANMF': data[pos+8+15] |= 0xC0
        pos += 8+s+(s&1)
    tmp_src = f'/tmp/{name}-src.webp'
    open(tmp_src,'wb').write(bytes(data))
    durs, loop = parse_anmf_meta(bytes(data))
    im = Image.open(tmp_src)
    n = im.n_frames
    frames = []
    for i in range(n):
        im.seek(i)
        frames.append(im.convert('RGBA').copy())
    # 校验: 每帧覆盖率应相近(独立姿势), 若某帧远大于帧0 则解码仍带累积 -> 报错跳过
    covs = [ (np.array(f)[...,3]>30).mean() for f in frames ]
    if max(covs) > covs[0]*1.6 + 0.05:
        report.append((name, 'SKIP 累积未除净', f'cov0={covs[0]:.2f} max={max(covs):.2f}'))
        print(f'{name}: SKIP 累积未除净', flush=True)
        continue
    tmp = f'/tmp/{name}-reenc.webp'
    frames[0].save(tmp, format='WEBP', save_all=True, append_images=frames[1:],
                   duration=durs if len(set(durs))>1 else durs[0], loop=loop,
                   quality=95, method=4)
    npatched = patch_flags_c0(tmp)
    new_size = os.path.getsize(tmp)
    # 回读校验: PIL可解码 + flags全为0xCx
    chk = Image.open(tmp); chk.seek(n-1); chk.load()
    data2 = open(tmp,'rb').read()
    pos = 12; fl = set()
    while pos+8 <= len(data2):
        f = data2[pos:pos+4]; s = struct.unpack('<I', data2[pos+4:pos+8])[0]
        if f == b'ANMF': fl.add(data2[pos+8+15])
        pos += 8+s+(s&1)
    assert all(x & 0xC0 == 0xC0 for x in fl), f'{name} flags补丁失败 {fl}'
    # 落地
    os.replace(tmp, path)
    os.remove(tmp_src)
    report.append((name, 'OK', f'{orig_size}->{new_size}B ({n}帧, {npatched}帧flags已补丁)'))
    print(f'{name}: OK {orig_size}->{new_size}B', flush=True)

ok = [r for r in report if r[1]=='OK']
bad = [r for r in report if r[1]!='OK']
for name, st, info in report:
    print(f'{name:20s} {st:8s} {info}')
print(f'\n完成: {len(ok)} 成功, {len(bad)} 跳过')
