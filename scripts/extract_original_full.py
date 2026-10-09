#!/usr/bin/env python3
"""第十九批：原版一代资源全面替换（从反编译仓库提取，替换wiki来源素材）
A. 卡面艺术图 225张: cards.atlas(250x190区域) → 烘焙512画布WebP（复用第九批窗口规范 x:131 y:99）
B. 卡框体系 29张: cardui.atlas 512/* 区域 → frames/（帧/背景/横幅/费用宝球）
C. 状态图标 ~100张: powers.atlas 128/* 区域 → status/
D. 遗物图标 ~42张: images/relics/ 直接复制（camelCase→原版名映射）
E. 意图图标 13张: images/ui/intent/ 直接复制（attack_intent_N→attackN）
F. 地图图标 7张: images/ui/map/ 直接复制（chest→treasure）
G. 能量球 4张: cardui 1024/card_*_orb → redEnergy等（先对比，若相同则跳过）
输出替换报告；原文件不备份（git即备份）。
"""
import os, re, json, hashlib
from PIL import Image

SRC = "/tmp/MySlayTheSpire/src/main/resources"
OUT = "/home/z/my-project/public/assets"
WIN_X, WIN_Y, WIN_W, WIN_H = 131, 99, 250, 190

# ---------- libGDX atlas 解析 ----------
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
            rotate, xy, size, orig, offset, index = False, None, None, None, (0, 0), -1
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
                regions[name] = dict(page=cur_page, xy=xy, size=size, orig=orig or size,
                                     offset=offset, rotate=rotate, psize=page_sizes.get(cur_page, (0, 0)))
            i = j
            continue
        i += 1
    return regions, page_sizes

_page_cache = {}
def _load_page(page_path):
    if page_path not in _page_cache:
        _page_cache[page_path] = Image.open(page_path).convert('RGBA')
    return _page_cache[page_path]

def extract_region(atlas_dir, regions, name, out_path=None, canvas_mode=True):
    """提取区域。canvas_mode=True → 平铺到 orig 尺寸画布（还原图集裁切边距，含翻转y坐标）"""
    r = regions.get(name)
    if not r: return None
    # 找页文件（jpg或png）
    page_path = None
    for cand in [r['page'], r['page'][:-4] + '.jpg', r['page'][:-4] + '.png']:
        p = os.path.join(atlas_dir, cand)
        if os.path.exists(p):
            page_path = p; break
    if not page_path: return None
    page = _load_page(page_path)
    pw, ph = page.size
    x, y = r['xy']; w, h = r['size']
    # 实测标定: 此图集为顶部原点(与wiki真值对照RGB差3.0 vs 52.2)
    region = page.crop((x, y, x + w, y + h))
    if r['rotate']:
        region = region.transpose(Image.ROTATE_90)
    if not canvas_mode:
        return region
    ow, oh = r['orig']
    ox, oy = r['offset']
    canvas = Image.new('RGBA', (ow, oh), (0, 0, 0, 0))
    canvas.alpha_composite(region, (ox, oy))
    return canvas

def md5(p):
    return hashlib.md5(open(p, 'rb').read()).hexdigest()[:10]

report = {'A_cards': [], 'B_frames': [], 'C_status': [], 'D_relics': [], 'E_intent': [], 'F_map': [], 'G_energy': []}

# ---------- A. 卡面艺术图 ----------
print('== A. 卡面艺术图 ==')
card_regions, _ = parse_atlas(os.path.join(SRC, "cards", "cards.atlas"))
mapping = json.load(open('/tmp/card_mapping.json'))
ok = skip = miss = 0
for card_id, region_name in mapping.items():
    art = extract_region(os.path.join(SRC, 'cards'), card_regions, region_name, canvas_mode=False)
    if art is None:
        report['A_cards'].append((card_id, region_name, 'MISSING')); miss += 1
        continue
    # 烘焙 512 画布（与第九批一致）
    a = art.resize((WIN_W, WIN_H), Image.LANCZOS)
    canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    canvas.alpha_composite(a, (WIN_X, WIN_Y))
    out = os.path.join(OUT, 'cardart', card_id + '.webp')
    old_md5 = md5(out) if os.path.exists(out) else '-'
    canvas.save(out, 'WEBP', quality=85, method=4)
    new_md5 = md5(out)
    if old_md5 == new_md5:
        skip += 1
    else:
        ok += 1
        report['A_cards'].append((card_id, region_name, f'{art.size[0]}x{art.size[1]}'))
    if (ok + skip) % 25 == 0: print(f'    进度 {ok+skip}/{len(mapping)}', flush=True)
print(f'  替换 {ok} 相同跳过 {skip} 缺失 {miss}')

# ---------- B. 卡框体系 ----------
print('== B. 卡框体系 ==')
cardui_regions, _ = parse_atlas(os.path.join(SRC, "cardui", "cardui.atlas"))
frame_map = {
    '512/frame_attack_common': 'frameAttackCommon.png', '512/frame_attack_uncommon': 'frameAttackUncommon.png', '512/frame_attack_rare': 'frameAttackRare.png',
    '512/frame_skill_common': 'frameSkillCommon.png', '512/frame_skill_uncommon': 'frameSkillUncommon.png', '512/frame_skill_rare': 'frameSkillRare.png',
    '512/frame_power_common': 'framePowerCommon.png', '512/frame_power_uncommon': 'framePowerUncommon.png', '512/frame_power_rare': 'framePowerRare.png',
    '512/bg_attack_red': 'bgAttackRed.png', '512/bg_attack_green': 'bgAttackGreen.png', '512/bg_attack_blue': 'bgAttackBlue.png', '512/bg_attack_purple': 'bgAttackPurple.png',
    '512/bg_skill_red': 'bgSkillRed.png', '512/bg_skill_green': 'bgSkillGreen.png', '512/bg_skill_blue': 'bgSkillBlue.png', '512/bg_skill_purple': 'bgSkillPurple.png',
    '512/bg_power_red': 'bgPowerRed.png', '512/bg_power_green': 'bgPowerGreen.png', '512/bg_power_blue': 'bgPowerBlue.png', '512/bg_power_purple': 'bgPowerPurple.png',
    '512/banner_common': 'bannerCommon.png', '512/banner_uncommon': 'bannerUncommon.png', '512/banner_rare': 'bannerRare.png',
    '512/card_red_orb': 'cardRedOrb.png', '512/card_green_orb': 'cardGreenOrb.png', '512/card_blue_orb': 'cardBlueOrb.png', '512/card_purple_orb': 'cardPurpleOrb.png',
}
for region_name, fname in frame_map.items():
    img = extract_region(os.path.join(SRC, 'cardui'), cardui_regions, region_name)
    if img is None:
        report['B_frames'].append((fname, 'MISSING')); continue
    out = os.path.join(OUT, 'frames', fname)
    old_md5 = md5(out) if os.path.exists(out) else '-'
    img.save(out)
    if old_md5 != md5(out):
        report['B_frames'].append((fname, f'{img.size[0]}x{img.size[1]}'))
print(f'  处理 {len(frame_map)} 项')

# ---------- C. 状态图标 ----------
print('== C. 状态图标 ==')
power_regions, _ = parse_atlas(os.path.join(SRC, "powers", "powers.atlas"))
# 我方状态ID → 原版区域名（STATUS_IMG_FIX已在代码中处理文件名，这里用文件名直配+snake转换）
status_dir = os.path.join(OUT, 'status')
our_status = [f[:-4] for f in os.listdir(status_dir) if f.endswith('.png')]
ok = 0
for sid in our_status:
    # 文件名即原版区域名(大部分)；尝试 128/{name}
    candidates = [f'128/{sid}', f'128/{sid[0].lower() + sid[1:]}']
    img = None
    for c in candidates:
        img = extract_region(os.path.join(SRC, 'powers'), power_regions, c)
        if img is not None: break
    if img is None:
        report['C_status'].append((sid, 'MISSING')); continue
    out = os.path.join(status_dir, sid + '.png')
    img.save(out); ok += 1
print(f'  替换 {ok} / {len(our_status)}')

# ---------- D. 遗物 ----------
print('== D. 遗物 ==')
relic_src = os.path.join(SRC, 'images/relics')
orig_relics = {f[:-4]: f for f in os.listdir(relic_src) if f.endswith('.png')}
def to_snake(s): return re.sub(r'(?<!^)(?=[A-Z])', '_', s).lower()
manual_relic = {'smoothlyStone': 'oddly_smooth_stone', 'bagOfPreparation': 'bag_of_prep', 'bagOfMarbles': 'bag_of_marbles', 'bronzeScales': 'bronze_scales', 'centennialPuzzle': 'centennial_puzzle', 'warPaint': 'war_paint', 'preservedInsect': 'preserved_insect', 'burningBlood': 'burning_blood', 'philosophersStone': 'philosopher_stone', 'crackedCore': 'cracked_core', 'goldenIdol': 'golden_idol', 'ringOfTheSnake': 'ring_of_the_snake', 'sneckoEye': 'snecko_eye', 'dataDisk': 'data_disk', 'meatOnTheBone': 'meat_on_the_bone', 'bloodVial': 'blood_vial', 'ornamentalFan': 'ornamental_fan', 'coffeeDripper': 'coffee_dripper', 'velvetChoker': 'velvet_choker', 'tungstenRod': 'tungsten_rod', 'kunai': 'kunai'}
our_relics = [f[:-4] for f in os.listdir(os.path.join(OUT, 'relics')) if f.endswith('.png')]
ok = 0
for rid in our_relics:
    sn = manual_relic.get(rid, to_snake(rid))
    fn = orig_relics.get(sn) or orig_relics.get(rid) or orig_relics.get(sn.replace('_', ''))
    if not fn:
        # 宽松匹配
        loose = {k.lower().replace('_', ''): v for k, v in orig_relics.items()}
        fn = loose.get(sn.replace('_', ''))
    if not fn:
        report['D_relics'].append((rid, 'MISSING')); continue
    img = Image.open(os.path.join(relic_src, fn)).convert('RGBA')
    out = os.path.join(OUT, 'relics', rid + '.png')
    old_md5 = md5(out) if os.path.exists(out) else '-'
    img.save(out)
    if old_md5 != md5(out):
        report['D_relics'].append((rid, fn))
    ok += 1
print(f'  处理 {ok} / {len(our_relics)}')

# ---------- E. 意图 ----------
print('== E. 意图 ==')
intent_src = os.path.join(SRC, 'images/ui/intent')
intent_map = {
    'attack2.png': 'attack_intent_2.png', 'attack3.png': 'attack_intent_3.png', 'attack4.png': 'attack_intent_4.png',
    'attack5.png': 'attack_intent_5.png', 'attack6.png': 'attack_intent_6.png', 'attack7.png': 'attack_intent_7.png',
    'buff.png': 'buff1.png', 'debuff.png': 'debuff1.png', 'debuffStrong.png': 'debuff2.png',
    'defend.png': 'defend.png', 'escape.png': 'escape.png', 'sleep.png': 'sleep.png', 'unknown.png': 'unknown.png',
}
for ours, orig in intent_map.items():
    src_f = os.path.join(intent_src, orig)
    if not os.path.exists(src_f):
        report['E_intent'].append((ours, 'MISSING')); continue
    img = Image.open(src_f).convert('RGBA')
    out = os.path.join(OUT, 'intent', ours)
    old_md5 = md5(out) if os.path.exists(out) else '-'
    img.save(out)
    if old_md5 != md5(out):
        report['E_intent'].append((ours, orig, f'{img.size[0]}x{img.size[1]}'))
print(f'  处理 {len(intent_map)} 项')

# ---------- F. 地图图标 ----------
print('== F. 地图图标 ==')
map_src = os.path.join(SRC, 'images/ui/map')
map_map = {'boss.png': 'boss.png', 'elite.png': 'elite.png', 'event.png': 'event.png',
           'monster.png': 'monster.png', 'rest.png': 'rest.png', 'shop.png': 'shop.png', 'treasure.png': 'chest.png'}
for ours, orig in map_map.items():
    src_f = os.path.join(map_src, orig)
    if not os.path.exists(src_f):
        # boss/elite等可能是目录(atlas) —— 检查同名png
        report['F_map'].append((ours, 'MISSING-dir')); continue
    img = Image.open(src_f).convert('RGBA')
    out = os.path.join(OUT, 'mapicons', ours)
    old_md5 = md5(out) if os.path.exists(out) else '-'
    img.save(out)
    if old_md5 != md5(out):
        report['F_map'].append((ours, orig, f'{img.size[0]}x{img.size[1]}'))
print(f'  处理 {len(map_map)} 项')

# ---------- G. 能量球 ----------
print('== G. 能量球 ==')
energy_map = {'redEnergy.png': '1024/card_red_orb', 'greenEnergy.png': '1024/card_green_orb',
              'blueEnergy.png': '1024/card_blue_orb', 'purpleEnergy.png': '1024/card_purple_orb'}
for fname, region in energy_map.items():
    img = extract_region(os.path.join(SRC, 'cardui'), cardui_regions, region)
    if img is None:
        report['G_energy'].append((fname, 'MISSING')); continue
    out = os.path.join(OUT, 'frames', fname)
    old_md5 = md5(out) if os.path.exists(out) else '-'
    img.save(out)
    if old_md5 != md5(out):
        report['G_energy'].append((fname, f'{img.size[0]}x{img.size[1]}'))
    else:
        report['G_energy'].append((fname, 'SAME'))
print(f'  处理 {len(energy_map)} 项')

json.dump(report, open('/tmp/extract_report.json', 'w'), ensure_ascii=False, indent=1)
print('\n== 汇总 ==')
for k, v in report.items():
    changed = [x for x in v if x[-1] not in ('SAME',)]
    print(f'{k}: {len(v)}项 其中变更 {len(changed)}')
