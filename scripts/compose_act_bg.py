#!/usr/bin/env python3
"""合成 Act2(TheCity)/Act3(TheBeyond) 原版战斗背景 — 按原版 renderCombatRoomBg 图层顺序
严格解析器: 单遍正则, 校验已知区域值
"""
import re, os, sys
from PIL import Image

R = '/tmp/MySlayTheSpire/src/main/resources'
OUT = '/home/z/my-project/public/assets'

# ---------- 严格解析器 ----------
REGION_BLOCK = re.compile(
    r'(?m)^(?P<name>[a-zA-Z0-9_/-]+)\n'
    r'(?P<props>(?:  [a-z]+: [^\n]+\n)+)'
)
PAGE_RE = re.compile(r'(?m)^(\S+\.(?:png|jpg))\nsize: (\d+),\s*(\d+)')

def parse_atlas(path):
    """返回 regions dict, 每个含 page/xy/size/offset/rotate; pages dict"""
    text = open(path, encoding='utf-8').read()
    pages = {}
    for m in PAGE_RE.finditer(text):
        pages[m.group(1)] = (int(m.group(2)), int(m.group(3)))
    # 页面的字符区间, 用于把区域归属到其后的第一个页面
    page_starts = []
    for m in PAGE_RE.finditer(text):
        page_starts.append((m.start(), m.group(1)))
    regions = {}
    for m in REGION_BLOCK.finditer(text):
        name = m.group('name')
        if name.endswith(('.png', '.jpg')) or name in pages:
            continue
        # 归属页面: 最后一个 start <= region start
        page = None
        for s, pn in page_starts:
            if s <= m.start():
                page = pn
        props = {}
        for line in m.group('props').strip().splitlines():
            k, v = line.strip().split(': ', 1)
            props[k] = v
        xy = tuple(int(v) for v in re.findall(r'\d+', props.get('xy', '0, 0')))
        size = tuple(int(v) for v in re.findall(r'\d+', props.get('size', '0, 0')))
        off = re.findall(r'\d+', props.get('offset', '0, 0'))
        offset = (int(off[0]), int(off[1])) if off else (0, 0)
        index_m = re.search(r'-?\d+', props.get('index', '-1'))
        regions[name] = dict(
            page=page, xy=xy, size=size, offset=offset,
            rotate='true' in props.get('rotate', 'false'),
            index=int(index_m.group()) if index_m else -1,
        )
    return regions, pages

def load_region_crop(scene, name, regions, pages):
    r = regions[name]
    page_path = os.path.join(R, scene, r['page'])
    pw, ph = pages[r['page']]
    x, y = r['xy']
    w, h = r['size']
    with Image.open(page_path) as im:
        if im.mode == 'P':
            im = im.convert('RGBA')
        elif im.mode != 'RGBA':
            im = im.convert('RGBA')
        c = im.crop((x, y, x + w, y + h))
    if r['rotate']:
        c = c.transpose(Image.ROTATE_90)
    return c, r

# ---------- 校验已知值 ----------
regs_city, pages_city = parse_atlas(os.path.join(R, 'cityScene', 'scene.atlas'))
regs_bey, pages_bey = parse_atlas(os.path.join(R, 'beyondScene', 'scene.atlas'))
assert regs_city['mod/bg1']['xy'] == (2, 1200) and regs_city['mod/bg1']['size'] == (1920, 501), regs_city['mod/bg1']
assert regs_city['mod/ceiling']['offset'] == (0, 932), regs_city['mod/ceiling']
assert regs_city['mod/floor']['size'] == (1920, 460) and regs_city['mod/floor']['xy'] == (2, 937), regs_city['mod/floor']
assert regs_city['mod/bg1']['page'] == 'scene.png' and regs_city['mod/floor']['page'] == 'scene2.png', (regs_city['mod/bg1']['page'], regs_city['mod/floor']['page'])
print('校验通过: cityScene mod/bg1=(2,1200,1920x501)@0,445 ceiling@0,932 floor(1920x460)@0,0 页面归属正确')
print(f'cityScene 区域数: {len(regs_city)}, beyondScene: {len(regs_bey)}')

# ---------- 合成函数 ----------
GAME_W, GAME_H = 1920, 1080

def composite(scene, regions, pages, layers, out_path):
    """layers: [(region_name, alpha_over=True)] 按绘制顺序; offset为底部原点"""
    canvas = Image.new('RGBA', (GAME_W, GAME_H), (8, 6, 10, 255))
    for name in layers:
        if name not in regions:
            print(f'  跳过(缺失): {name}')
            continue
        crop, r = load_region_crop(scene, name, regions, pages)
        ox, oy = r['offset']
        w, h = r['size']
        # 底部原点 → 顶部原点
        ty = GAME_H - (oy + h)
        canvas.alpha_composite(crop, (ox, ty))
    out = canvas.convert('RGB')
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    out.save(out_path, quality=88)
    print(f'  合成 {out_path} {out.size}')

# Act2: TheCity renderCombatRoomBg: bg1(wall) → floor → ceiling → mg1
print('=== Act2 TheCity 合成 ===')
composite('cityScene', regs_city, pages_city,
          ['mod/bg1', 'mod/bgGlowv2', 'mod/floor', 'mod/ceiling', 'mod/mg1'],
          f'{OUT}/bg/combat2.jpg')

# Act3: TheBeyond renderCombatRoomBg: bg1 → bg2 → floor → ceiling → fg
print('=== Act3 TheBeyond 合成 ===')
composite('beyondScene', regs_bey, pages_bey,
          ['mod/bg1', 'mod/bg2', 'mod/floor', 'mod/ceiling', 'mod/fg'],
          f'{OUT}/bg/combat3.jpg')

# 同时修正 Act1/Act4: bg区域左上原点直接裁(此前用翻转bug版,重裁)
print('=== Act1/Act4 重裁(左上原点) ===')
for scene, region, outp in [('bottomScene', 'bg', f'{OUT}/bg/combat1.jpg'),
                            ('endingScene', 'bg', f'{OUT}/bg/combat4.jpg')]:
    regs, pgs = parse_atlas(os.path.join(R, scene, 'scene.atlas'))
    crop, r = load_region_crop(scene, region, regs, pgs)
    rgb = Image.new('RGB', crop.size, (0, 0, 0))
    rgb.paste(crop, mask=crop.split()[3] if crop.mode == 'RGBA' else None)
    rgb.save(outp, quality=88)
    print(f'  {outp} {rgb.size}')

# 篝火/事件房也用左上原点重裁
for scene, i in [('bottomScene', 1), ('cityScene', 2), ('beyondScene', 3), ('endingScene', 4)]:
    regs, pgs = parse_atlas(os.path.join(R, scene, 'scene.atlas'))
    for kind in ['campfire', 'event']:
        crop, r = load_region_crop(scene, kind, regs, pgs)
        rgb = Image.new('RGB', crop.size, (0, 0, 0))
        rgb.paste(crop, mask=crop.split()[3])
        rgb.save(f'{OUT}/bg/{kind}{i}.jpg', quality=86)
print('=== 篝火/事件房背景重裁完成 ===')

# title sky 重裁
regs_t, pgs_t = parse_atlas(os.path.join(R, 'title', 'title.atlas'))
crop, r = load_region_crop('title', 'jpg/sky', regs_t, pgs_t)
rgb = Image.new('RGB', crop.size, (0, 0, 0)); rgb.paste(crop, mask=crop.split()[3])
rgb.save(f'{OUT}/bg/menubg.jpg', quality=86)
print('menubg(sky)', rgb.size)
# 云层重裁
os.makedirs(f'{OUT}/title', exist_ok=True)
for c in ['mg2', 'mg3Bot', 'mg3Top', 'topCloud2', 'topCloud7', 'midCloud9', 'midCloud13']:
    if c in regs_t:
        crop, r = load_region_crop('title', c, regs_t, pgs_t)
        crop.save(f'{OUT}/title/{c}.png')
        print('cloud', c, crop.size)
    else:
        print('cloud MISSING', c)
