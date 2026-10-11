#!/usr/bin/env python3
"""第三十批素材提取：检视屏（SingleCardViewPopup）原版大卡全套
1) cardui.atlas 的 1024/* region → 烘焙回 1024x1024 全画布 WebP（inset:0 同盒渲染，与 CardView 512 画布架构同构）
   - bg_{type}_{color} 16 张（含 bg_skill_black 诅咒；status 卡走 colorless skill）
   - frame_{type}_{rarity} 9 张（诅咒/状态 = skill common）
   - banner_{rarity} 3 张（诅咒/状态 = common）
   - card_{color}_orb 5 张 → 烘焙回 164x164 画布
2) 1024Portraits 225 张 500x380 → scvart/{我们卡id}.webp（含 16 张特殊名映射）
3) ui/popupArrow.png + checkbox.png + tick.png → scv/
"""
import os, json, re
from PIL import Image

REPO = '/tmp/MySlayTheSpire/src/main/resources'
ATLAS = f'{REPO}/cardui/cardui.atlas'
ATLAS_IMG = f'{REPO}/cardui/cardui.png'
PORT = f'{REPO}/images/1024Portraits'
OUT_SCV = '/home/z/my-project/public/assets/scv'
OUT_ART = '/home/z/my-project/public/assets/scvart'
os.makedirs(OUT_SCV, exist_ok=True)
os.makedirs(OUT_ART, exist_ok=True)

# ---------- libGDX TextureAtlas 解析 ----------
def parse_atlas(path):
    """返回 [(name, page, x, y, w, h, orig_w, orig_h, off_x, off_y)]；y 均为大图/画布坐标系从底部算"""
    pages, regions, cur = [], [], None
    with open(path) as f:
        lines = [l.rstrip('\n') for l in f]
    i = 0
    page = None
    while i < len(lines):
        l = lines[i].strip()
        if l.endswith('.png') and ':' not in l:
            pages.append(l); page = l
        elif l and not any(l.startswith(k) for k in ('size:', 'format:', 'filter:', 'repeat:', 'rotate', 'xy:', 'orig:', 'offset:', 'index:')):
            # region 名行（可含空格）；下一行起是元数据
            cur = {'name': l, 'page': page}
        elif cur is not None and l.startswith('rotate:'):
            cur['rotate'] = l.split(':')[1].strip() == 'true'
        elif cur is not None and l.startswith('xy:'):
            cur['x'], cur['y'] = map(int, l.split(':')[1].split(','))
        elif cur is not None and l.startswith('size:'):
            cur['w'], cur['h'] = map(int, l.split(':')[1].split(','))
        elif cur is not None and l.startswith('orig:'):
            cur['ow'], cur['oh'] = map(int, l.split(':')[1].split(','))
        elif cur is not None and l.startswith('offset:'):
            cur['ox'], cur['oy'] = map(int, l.split(':')[1].split(','))
        elif cur is not None and l.startswith('index:') and 'w' in cur:
            regions.append(cur); cur = None
        i += 1
    return pages, regions

pages, regions = parse_atlas(ATLAS)
by_name = {r['name']: r for r in regions}

sheet = Image.open(ATLAS_IMG).convert('RGBA')

def bake_to_canvas(r, canvas_size):
    """region 贴回 orig 画布。坐标系结论（第二十四批 spine_compose.py 已验证）：
    - atlas xy 直接作 PIL 顶部坐标 crop（rotate:90 → 裁 (x,y,x+h,y+w) 后 ROTATE_270 顺时针还原）
    - offset.y 从画布底部算 → PIL top = orig_h - oy - h"""
    x, y, w, h = r['x'], r['y'], r['w'], r['h']
    if r.get('rotate'):
        im = sheet.crop((x, y, x + h, y + w)).transpose(Image.ROTATE_270)
    else:
        im = sheet.crop((x, y, x + w, y + h))
    canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    top = r['oh'] - r['oy'] - r['h']
    canvas.alpha_composite(im, (r['ox'], top))
    return canvas

def save_webp(im, path, q=85):
    im.save(path, 'WEBP', quality=q, method=6)

# ---------- 1) cardui 1024 region ----------
COLORS = ['red', 'green', 'blue', 'purple', 'colorless']
TYPES = ['attack', 'skill', 'power']
count = 0
for t in TYPES:
    for c in COLORS:
        r = by_name.get(f'1024/bg_{t}_{c}')
        assert r, f'缺 1024/bg_{t}_{c}'
        save_webp(bake_to_canvas(r, 1024), f'{OUT_SCV}/bg{t.capitalize()}{c.capitalize()}.webp')
        count += 1
# 诅咒底板 bg_skill_black → bgSkillCurse（我们的 curse 卡色）
r = by_name['1024/bg_skill_black']
save_webp(bake_to_canvas(r, 1024), f'{OUT_SCV}/bgSkillCurse.webp'); count += 1
# 状态卡底板 = colorless skill（已在上面循环生成 bgSkillColorless）

for t in TYPES:
    for rar in ['common', 'uncommon', 'rare']:
        r = by_name[f'1024/frame_{t}_{rar}']
        save_webp(bake_to_canvas(r, 1024), f'{OUT_SCV}/frame{t.capitalize()}{rar.capitalize()}.webp')
        count += 1
for rar in ['common', 'uncommon', 'rare']:
    r = by_name[f'1024/banner_{rar}']
    save_webp(bake_to_canvas(r, 1024), f'{OUT_SCV}/banner{rar.capitalize()}.webp')
    count += 1
# orb 5 色（164 画布）
ORB = {'red': 'card_red_orb', 'green': 'card_green_orb', 'blue': 'card_blue_orb',
       'purple': 'card_purple_orb', 'colorless': 'card_colorless_orb'}
for c, reg in ORB.items():
    r = by_name[f'1024/{reg}']
    save_webp(bake_to_canvas(r, r['ow']), f'{OUT_SCV}/orb{c.capitalize()}.webp')
    count += 1
print(f'cardui 1024 region: {count} 张')

# ---------- 2) UI 三件套 ----------
import shutil
for name, src in [('arrow', 'popupArrow.png'), ('checkbox', 'checkbox.png'), ('tick', 'tick.png')]:
    s = f'{REPO}/images/ui/{src}'
    im = Image.open(s).convert('RGBA')
    save_webp(im, f'{OUT_SCV}/{name}.webp')
print('ui 三件套: 3 张')

# ---------- 3) 1024Portraits 225 张（我们卡 id 命名） ----------
mapping = json.load(open('/home/z/my-project/scripts/scv_map.json'))  # id -> "color/type/snake"（209 张）
# 16 张特殊映射补丁
SPECIAL = {
    'thunderclap': 'red/attack/thunder_clap',
    'dropkick': 'red/attack/drop_kick',
    'wound': 'status/wound', 'dazed': 'status/dazed', 'burn': 'status/burn',
    'slimed': 'status/slimed', 'void': 'status/void',
    'regret': 'curse/regret', 'injury': 'curse/injury', 'doubt': 'curse/doubt',
    'cripplingCloud': 'green/skill/crippling_poison',
    'sweepBeam': 'blue/attack/sweeping_beam',
    'hyperbeam': 'blue/attack/hyper_beam',
    'multiCast': 'blue/skill/multicast',
    'consecration': 'purple/attack/consecrate',
    'crushJoint': 'purple/attack/crush_joints',
}
mapping.update(SPECIAL)

n = 0
for cid, rel in mapping.items():
    src = f'{PORT}/{rel}.png'
    assert os.path.exists(src), f'缺 {src}'
    im = Image.open(src).convert('RGBA')
    save_webp(im, f'{OUT_ART}/{cid}.webp', q=80)
    n += 1
print(f'1024Portraits: {n} 张')
total = sum(os.path.getsize(f'{OUT_SCV}/{f}') for f in os.listdir(OUT_SCV)) \
      + sum(os.path.getsize(f'{OUT_ART}/{f}') for f in os.listdir(OUT_ART))
print(f'总体积: {total/1024/1024:.2f} MB')
