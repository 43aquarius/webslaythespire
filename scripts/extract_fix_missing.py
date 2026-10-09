#!/usr/bin/env python3
"""第十九批补充：缺失状态图标(权威映射自反编译loadRegion) + 缺失遗物(原版文件名) + block盾"""
import os, json
from PIL import Image

SRC = "/tmp/MySlayTheSpire/src/main/resources"
OUT = "/home/z/my-project/public/assets"

_page_cache = {}
def load_page(p):
    if p not in _page_cache:
        _page_cache[p] = Image.open(p).convert('RGBA')
    return _page_cache[p]

import re
def parse_atlas(atlas_path):
    text = open(atlas_path, encoding="utf-8").read()
    lines = [l.rstrip() for l in text.splitlines()]
    regions, page_sizes, cur_page = {}, {}, None
    i = 0
    while i < len(lines):
        l = lines[i].strip()
        if not l:
            i += 1; continue
        m = re.match(r'^(.+\.png|.+\.jpg)$', l)
        if m and (i + 1 < len(lines)) and lines[i+1].startswith('size:'):
            cur_page = m.group(1)
            sm = re.match(r'size:\s*(\d+),\s*(\d+)', lines[i+1])
            page_sizes[cur_page] = (int(sm.group(1)), int(sm.group(2)))
            i += 2
            while i < len(lines) and (lines[i].startswith(('format', 'filter', 'repeat', 'pma'))):
                i += 1
            continue
        m = re.match(r'^([a-zA-Z0-9_/\-\.]+)$', l)
        if m and cur_page:
            name = m.group(1)
            rotate, xy, size, orig, offset = False, None, None, None, (0, 0)
            j = i + 1
            while j < len(lines):
                nl = lines[j].strip()
                if re.match(r'^[a-zA-Z0-9_/\-\.]+$', nl) and not nl.startswith(('rotate', 'xy', 'size', 'orig', 'offset', 'index')):
                    break
                if nl.startswith('rotate:'): rotate = 'true' in nl
                elif nl.startswith('xy:'):
                    mm = re.match(r'xy:\s*(\d+),\s*(\d+)', nl)
                    if mm: xy = (int(mm.group(1)), int(mm.group(2)))
                elif nl.startswith('size:'):
                    mm = re.match(r'size:\s*(\d+),\s*(\d+)', nl)
                    if mm: size = (int(mm.group(1)), int(mm.group(2)))
                elif nl.startswith('orig:'):
                    mm = re.match(r'orig:\s*(\d+),\s*(\d+)', nl)
                    if mm: orig = (int(mm.group(1)), int(mm.group(2)))
                elif nl.startswith('offset:'):
                    mm = re.match(r'offset:\s*(-?\d+),\s*(-?\d+)', nl)
                    if mm: offset = (int(mm.group(1)), int(mm.group(2)))
                j += 1
            if xy and size:
                regions[name] = dict(page=cur_page, xy=xy, size=size, orig=orig or size, offset=offset, rotate=rotate)
            i = j
            continue
        i += 1
    return regions

def extract(atlas_dir, regions, name):
    r = regions.get(name)
    if not r: return None
    page_path = None
    for cand in [r['page'], r['page'][:-4] + '.jpg', r['page'][:-4] + '.png']:
        p = os.path.join(atlas_dir, cand)
        if os.path.exists(p): page_path = p; break
    if not page_path: return None
    page = load_page(page_path)
    pw, ph = page.size
    x, y = r['xy']; w, h = r['size']
    region = page.crop((x, y, x + w, y + h))
    if r['rotate']: region = region.transpose(Image.ROTATE_90)
    ow, oh = r['orig']; ox, oy = r['offset']
    canvas = Image.new('RGBA', (ow, oh), (0, 0, 0, 0))
    canvas.alpha_composite(region, (ox, oy))
    return canvas

# ---------- 状态图标补齐（权威映射: 反编译 loadRegion） ----------
power_regions = parse_atlas(os.path.join(SRC, 'powers', 'powers.atlas'))
status_fix = {
    'curlUp': 'closeUp', 'entangled': 'entangle', 'equilibrium': 'retain', 'equilibriumB': 'retain',
    'caltrops': 'thorns', 'staticDischarge': 'static_discharge', 'mentalFortress': 'mental_fortress',
    'noxiousFumes': 'fumes', 'corpseExplosion': 'cExplosion', 'feelNoPain': 'noPain',
    'fireBreathing': 'firebreathing', 'masterReality': 'master_reality', 'dexterityLoss': 'flex',
    'lockOn': 'lockon', 'aThousandCuts': 'thousandCuts', 'likeWater': 'like_water',
    'theBomb': 'the_bomb', 'beatOfDeath': 'beat', 'metallicize': 'armor', 'heatsinks': 'heatsink',
    'rage': 'anger', 'darkEmbrace': 'darkembrace', 'timeS': 'time', 'creativeAI': 'ai',
    'electro': 'mastery', 'mark': 'pressure_points', 'flying': 'flight', 'block': 'defenseNext',
}
ok, miss = [], []
for sid, region in status_fix.items():
    img = extract(os.path.join(SRC, 'powers'), power_regions, f'128/{region}')
    if img is None:
        miss.append((sid, region)); continue
    img.save(os.path.join(OUT, 'status', sid + '.png'))
    ok.append((sid, region))
print(f'状态补齐: {len(ok)} 成功, {len(miss)} 缺失 {miss}')

# ---------- 遗物补齐（原版文件名） ----------
relic_fix = {
    'bagOfMarbles': 'marbles.png', 'smoothlyStone': 'smooth_stone.png', 'oddlySmoothStone': 'smooth_stone.png',
    'pureWater': 'clean_water.png', 'ringOfTheSnake': 'snake_ring.png', 'crackedCore': 'vCore.png',
    'meatOnTheBone': 'meat.png', 'preservedInsect': 'insect.png', 'velvetChoker': 'redChoker.png',
    'tungstenRod': 'tungsten.png', 'goldenIdol': 'goldenIdolRelic.png', 'bustedCrown': 'crown.png',
    'Kunai2': 'kunai.png', 'kunai2': 'kunai.png',
}
okr, missr = [], []
for rid, fn in relic_fix.items():
    src_f = os.path.join(SRC, 'images', 'relics', fn)
    if not os.path.exists(src_f):
        missr.append((rid, fn)); continue
    Image.open(src_f).convert('RGBA').save(os.path.join(OUT, 'relics', rid + '.png'))
    okr.append((rid, fn))
print(f'遗物补齐: {len(okr)} 成功, {len(missr)} 缺失 {missr}')

# ---------- 地图boss图标（原版是目录结构，查内容） ----------
boss_dir = os.path.join(SRC, 'images', 'ui', 'map', 'boss')
if os.path.isdir(boss_dir):
    print('boss目录内容:', os.listdir(boss_dir))
else:
    print('boss不是目录')
# bossOutline.png 存在吗
for f in ['boss.png', 'bossOutline.png', 'eliteOutline.png']:
    p = os.path.join(SRC, 'images', 'ui', 'map', f)
    print(f, os.path.exists(p))
