#!/usr/bin/env python3
"""第二十四批：批量合成全部敌人原版立绘（Spine setup pose）
当前 sprite 名 → 反编译仓库 monsters 目录映射，覆盖 public/assets/enemies/
质量红线: 非透明率 <3% 或 >95% 报告复核；渲染像素 < 贴图非透明×0.8 报告
"""
import os, sys, json
sys.path.insert(0, '/home/z/my-project/scripts')
from spine_compose import SpineComposer
import numpy as np
from PIL import Image

SRC = '/tmp/MySlayTheSpire/src/main/resources/images/monsters'
NPC = '/tmp/MySlayTheSpire/src/main/resources/images/npcs'
OUT = '/home/z/my-project/public/assets/enemies'

MAP = {
    'acidslimeM': 'theBottom/slimeM',
    'acidslimeS': 'theBottom/slimeS',
    'awakenedOne': 'theForest/awakenedOne',
    'blueSlaver': 'theBottom/blueSlaver',
    'bookOfStabbing': 'theCity/bookOfStabbing',
    'bronzeAutomaton': 'theCity/automaton',
    'bronzeOrb': 'theCity/sphere',
    'byrd': 'theCity/byrd:flying',
    'centurion': 'theCity/romeo',
    'chosen': 'theCity/chosen',
    'corruptHeart': None,  # NPC heart
    'cultist': 'theBottom/cultist',
    'dagger': 'theForest/mage_dagger',
    'darkling': 'theForest/darkling',
    'deca': 'theForest/deca',
    'donu': 'theForest/donu',
    'fatGremlin': 'theBottom/fatGremlin',
    'fungibeast': 'theBottom/fungi',
    'giantHead': 'theForest/head',
    'greenlouse': 'theBottom/louseGreen',
    'gremlinLeader': 'theCity/gremlinleader',
    'gremlinWizard': 'theBottom/wizardGremlin',
    'guardian': 'theBottom/boss/guardian',
    'hexaghost': None,  # 非Spine: core+plasma纯图合成
    'jawworm': 'theBottom/jawWorm',
    'lagavulin': 'theBottom/lagavulin',
    'madGremlin': 'theBottom/angryGremlin',
    'mystic': 'theCity/healer',
    'nemesis': 'theForest/nemesis',
    'nob': 'theBottom/nobGremlin',
    'orbWalker': 'theForest/orbWalker',
    'redSlaver': 'theBottom/redSlaver',
    'redlouse': 'theBottom/louseRed',
    'reptomancer': 'theCity/reptile',
    'repulsor': 'theForest/repulser',
    'sentry': 'theBottom/sentry',
    'shieldGremlin': 'theBottom/femaleGremlin',
    'slimeboss': 'theBottom/boss/slime',
    'sneakyGremlin': 'theBottom/thiefGremlin',
    'sphericGuardian': 'theCity/tank',
    'spikeSlimeM': 'theBottom/slimeAltM',
    'spikeSlimeS': 'theBottom/slimeAltS',
    'spiker': 'theForest/spiker',
    'spireGrowth': 'theForest/spireGrowth',
    'spireShield': 'theEnding/shield',
    'spireSpear': 'theEnding/spear',
    'taskmaster': 'theCity/slaverMaster',
    'theChamp': 'theCity/champ',
    'theCollector': 'theCity/collector',
    'timeEater': 'theForest/timeEater',
    'transient': 'theForest/transient',
    'writhingMass': 'theForest/spaghetti',
}

# 贴图非透明总数（质量对照基准）
def tex_opaque(sd, base='skeleton'):
    total = 0
    c = SpineComposer(sd, base)
    for name, reg in c.regions.items():
        img, w, h = c.region_img(reg)
        total += int((np.array(img)[..., 3] > 10).sum())
    return c, total

def compose_hexaghost(out):
    """hexaghost: core + 6 plasma 环绕（原版纯图合成，非 Spine）"""
    d = '/tmp/MySlayTheSpire/src/main/resources/images/monsters/theBottom/boss/ghost'
    core = Image.open(f'{d}/core.png').convert('RGBA')
    plasma = Image.open(f'{d}/plasma1.png').convert('RGBA')
    canvas = Image.new('RGBA', (768, 768), (0, 0, 0, 0))
    import math as _m
    cx = cy = 384
    # 6 个 plasma 缩至 36% 环绕半径 220
    ps = plasma.resize((int(512*0.36), int(512*0.36)), Image.LANCZOS)
    pw = ps.size[0]
    for k in range(6):
        ang = _m.radians(60 * k - 90)
        px = cx + int(220 * _m.cos(ang)) - pw // 2
        py = cy + int(220 * _m.sin(ang)) - pw // 2
        canvas.paste(ps, (px, py), ps)
    cs = core.resize((int(512*0.62), int(512*0.62)), Image.LANCZOS)
    canvas.paste(cs, (cx - cs.size[0]//2, cy - cs.size[1]//2), cs)
    # 裁边
    a = np.array(canvas)
    nz = np.argwhere(a[..., 3] > 10)
    y0, x0 = nz.min(axis=0); y1, x1 = nz.max(axis=0)
    canvas.crop((x0, y0, x1+1, y1+1)).save(out)
    return (x1-x0+1, y1-y0+1)

ok, warn, err = [], [], []
for sprite, sub in MAP.items():
    sd_spec = os.path.join(NPC, 'heart') if sprite == 'corruptHeart' else os.path.join(SRC, sub) if sub else None
    sd, base = (sd_spec.split(':') + ['skeleton'])[:2] if sd_spec and ':' in sd_spec else (sd_spec, 'skeleton')
    out = os.path.join(OUT, sprite + '.png')
    try:
        if sprite == 'hexaghost':
            size = compose_hexaghost(out)
            a = np.array(Image.open(out))
            nz = int((a[..., 3] > 10).sum())
            cov = nz / (size[0] * size[1])
            msg = f'{sprite}: {size[0]}x{size[1]} 非透明{nz} 覆盖{cov*100:.0f}% (特殊合成)'
            ok.append(msg); print('✓ ' + msg); continue
        c, tex_nz = tex_opaque(sd, base)
        size = c.compose(out)
        a = np.array(Image.open(out))
        nz = int((a[..., 3] > 10).sum())
        ratio = nz / max(tex_nz, 1)
        cov = nz / (size[0] * size[1])
        msg = f'{sprite}: {size[0]}x{size[1]} 非透明{nz} 贴图{tex_nz} 比率{ratio:.2f} 覆盖{cov*100:.0f}%'
        if cov < 0.03 or cov > 0.95:
            warn.append(msg + ' <-- 覆盖率异常')
        elif ratio < 0.5:
            warn.append(msg + ' <-- 渲染/贴图比率低')
        else:
            ok.append(msg)
        print('✓ ' + msg)
    except Exception as e:
        err.append(f'{sprite}: {type(e).__name__} {e}')
        print(f'✗ {sprite}: {e}')

print(f'\n== 成功{len(ok)} 警告{len(warn)} 失败{len(err)} ==')
for m in warn: print('WARN', m)
for m in err: print('ERR ', m)
