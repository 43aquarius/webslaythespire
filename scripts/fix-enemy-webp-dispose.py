#!/usr/bin/env python3
"""修复怪物贴图重影 bug（第四十一批）

根因: 43 个敌人动画 WebP 的每一帧都是"完整姿势"全帧, 但 ANMF flags 为
(blend=0 叠加合成, dispose=0 不清画布) —— 浏览器按规范逐帧叠加合成,
12-20 个完整姿势堆在同一画布上 => 触角拖影/身体破碎色块(虱子最严重)。
而 7 个真正的 delta 动画(酸液史莱姆等: 全帧+小增量帧交替)用同样的
flags 是正确的, 不能动。

修复: 对全姿势文件把每帧 ANMF flags 改为 0xC0 (blend=1 覆盖 + dispose=1
帧后清画布) => 每帧独立显示, 累积痕迹清零。纯位补丁, 零重编码损失。

安全检查: ANIM 背景色必须全透明(否则 dispose 会画出实心色块)。
"""
import struct, os, shutil, sys

ENEMIES = 'public/assets/enemies'
BACKUP = '.zscripts/webp-backup-before-dispose-fix'

# 由 webp-forensics.py 覆盖率分析得出的全姿势文件清单(其余为 delta/静态, 不动)
FULL_POSE = '''acidslimeM awakenedOne blueSlaver bookOfStabbing bronzeAutomaton
byrd centurion chosen corruptHeart cultist dagger darkling donu fatGremlin
fungibeast greenlouse gremlinLeader jawworm lagavulin madGremlin mystic nemesis
nob orbWalker redSlaver redlouse reptomancer repulsor sentry shieldGremlin
slimeboss sneakyGremlin sphericGuardian spiker spireGrowth spireShield
spireSpear taskmaster theChamp theCollector timeEater transient
writhingMass'''.split()

# 注: bronzeOrb / hexaghost 是静态图(无ANMF), 跳过
FULL_POSE = [n for n in FULL_POSE if n not in ('bronzeOrb', 'hexaghost')]
print(f'待修复全姿势文件: {len(FULL_POSE)} 个')

os.makedirs(BACKUP, exist_ok=True)
patched, skipped = [], []
for name in FULL_POSE:
    path = os.path.join(ENEMIES, f'{name}.webp')
    if not os.path.exists(path):
        skipped.append((name, '文件不存在')); continue
    data = bytearray(open(path, 'rb').read())
    # 遍历块
    pos = 12
    anmf_positions = []
    bgcolor = None
    while pos + 8 <= len(data):
        f = bytes(data[pos:pos+4])
        size = struct.unpack('<I', data[pos+4:pos+8])[0]
        if f == b'ANIM':
            bgcolor = struct.unpack('<I', data[pos+8:pos+12])[0]
        elif f == b'ANMF':
            anmf_positions.append(pos)
        pos += 8 + size + (size & 1)
    if not anmf_positions:
        skipped.append((name, '无动画帧')); continue
    # 安全校验: dispose 清画布用 ANIM 背景色, 必须全透明
    if bgcolor is None or (bgcolor >> 24) != 0:
        skipped.append((name, f'背景色不透明 0x{bgcolor:08x}, 跳过')); continue
    # 备份
    bak = os.path.join(BACKUP, f'{name}.webp')
    if not os.path.exists(bak):
        shutil.copy2(path, bak)
    # 打补丁: 每帧 flags 字节 (ANMF块头偏移+8+15) 置 0xC0
    n = 0
    for p in anmf_positions:
        off = p + 8 + 15
        old = data[off]
        data[off] = old | 0xC0   # blend=1 覆盖 + dispose=1 帧后清除
        n += 1
    open(path, 'wb').write(bytes(data))
    patched.append((name, n))

print(f'已补丁: {len(patched)} 个文件, 共 {sum(n for _,n in patched)} 帧')
if skipped:
    print('跳过:', skipped)

# ---- 自检: 重新解析验证 flags 与文件完整性 ----
import io
from PIL import Image
errors = []
for name, _ in patched:
    path = os.path.join(ENEMIES, f'{name}.webp')
    data = open(path, 'rb').read()
    pos = 12; flags = set(); ok = True
    while pos + 8 <= len(data):
        f = data[pos:pos+4]; size = struct.unpack('<I', data[pos+4:pos+8])[0]
        if f == b'ANMF':
            flags.add(data[pos+8+15])
        pos += 8 + size + (size & 1)
    if flags != {0xC0}:
        errors.append((name, f'flags异常 {flags}')); ok = False
    try:
        im = Image.open(io.BytesIO(data)); im.load()
        _ = im.n_frames
    except Exception as e:
        errors.append((name, f'PIL解码失败 {e}'))
print('自检:', '全部通过 (flags=0xC0, PIL可解码)' if not errors else errors)
sys.exit(1 if errors else 0)
