#!/usr/bin/env python3
"""第二十五批：从反编译仓库 title.atlas 提取原版主菜单全部云层 + 塔身红光
原版 TitleBackground.java：topCloud1-6(向右飘) + midCloud1-12(向左飘) + mg3TopGlow1/2(加法混合)
图集为顶部原点（第二十批结论）。输出 WebP + 元数据 JSON（offsetY 为 libGDX 底部偏移语义）。
"""
import json
from PIL import Image

SRC = '/tmp/MySlayTheSpire/src/main/resources/title'
OUT = '/home/z/my-project/public/assets/title'

# name -> (page, xy(x,y), packed(w,h), orig(w,h), offset(x,y))
REGIONS = {
    # 原版主菜单实际使用的 6 朵顶层云（向右）
    'topCloud1':  ('title6.png', (1280, 429), (558, 176),  (1920, 1266), (811, 807)),
    'topCloud2':  ('title3.png', (2, 2),      (1561, 374), (1920, 1266), (118, 398)),
    'topCloud3':  ('title4.png', (2, 2),      (1299, 350), (1920, 1266), (257, 182)),
    'topCloud4':  ('title6.png', (1244, 81),  (585, 181),  (1920, 1266), (1199, 677)),
    'topCloud5':  ('title6.png', (643, 111),  (599, 151),  (1920, 1266), (10, 445)),
    'topCloud6':  ('title6.png', (643, 12),   (411, 97),   (1920, 1266), (95, 872)),
    # 原版主菜单实际使用的 12 朵中层云（向左）
    'midCloud1':  ('title6.png', (1423, 621), (452, 165),  (1920, 1266), (582, 740)),
    'midCloud2':  ('title6.png', (915, 788),  (856, 216),  (1920, 1266), (445, 740)),
    'midCloud3':  ('title6.png', (2, 613),    (775, 203),  (1920, 1266), (535, 751)),
    'midCloud4':  ('title6.png', (779, 607),  (642, 179),  (1920, 1266), (554, 760)),
    'midCloud5':  ('title5.png', (2, 642),    (1252, 284), (1920, 1266), (376, 52)),
    'midCloud6':  ('title6.png', (2, 2),      (272, 57),   (1920, 1266), (665, 651)),
    'midCloud7':  ('title6.png', (2, 818),    (911, 186),  (1920, 1266), (506, 46)),
    'midCloud8':  ('title5.png', (2, 928),    (1293, 372), (1920, 1266), (558, 86)),
    'midCloud9':  ('title3.png', (2, 1415),   (1686, 581), (1920, 1266), (41, 390)),
    'midCloud10': ('title6.png', (643, 264),  (635, 341),  (1920, 1266), (473, 498)),
    'midCloud11': ('title5.png', (2, 2),      (1237, 638), (1920, 1266), (637, 190)),
    'midCloud12': ('title4.png', (2, 1083),   (1519, 595), (1920, 1266), (342, 232)),
    # 塔身红光（加法混合），坐标基于 1920x1140 的 mg3Top 画布
    'mg3TopGlow1': ('title6.png', (1831, 138), (158, 289), (1920, 1140), (225, 0)),
    'mg3TopGlow2': ('title6.png', (1877, 674), (153, 330), (1920, 1140), (234, 0)),
    # mg3Top 重裁（与现有文件比对，验证第二十批裁剪正确性）
    'mg3Top':      ('title2.png', (2, 860),    (1920, 1140), (1920, 1140), (0, 0)),
}

meta = {}
pages = {}
for name, (page, (x, y), (w, h), orig, off) in REGIONS.items():
    if page not in pages:
        pages[page] = Image.open(f'{SRC}/{page}').convert('RGBA')
    img = pages[page]
    # 顶部原点：xy 即区域左上角
    crop = img.crop((x, y, x + w, y + h))
    if name == 'mg3Top':
        # 与现有文件比对（不覆盖，仅验证）
        existing = f'{OUT}/mg3Top.png'
        import hashlib
        new_hash = hashlib.md5(crop.tobytes()).hexdigest()
        try:
            old = Image.open(existing).convert('RGBA')
            old_hash = hashlib.md5(old.tobytes()).hexdigest()
            print(f'mg3Top 比对: 新裁剪={"一致" if new_hash == old_hash else "不一致!"} ({old.size} vs {crop.size})')
        except FileNotFoundError:
            print('mg3Top 现有文件不存在')
        continue
    out_path = f'{OUT}/{name}.webp'
    crop.save(out_path, 'WEBP', quality=90, method=6)
    meta[name] = {
        'w': w, 'h': h, 'origW': orig[0], 'origH': orig[1],
        'offX': off[0], 'offY': off[1],
        'kb': round(__import__('os').path.getsize(out_path) / 1024, 1),
    }
    print(f'{name}: {w}x{h} off({off[0]},{off[1]}) -> {meta[name]["kb"]}KB')

with open('/home/z/my-project/scripts/study/batch25/title_clouds_meta.json', 'w') as f:
    json.dump(meta, f, indent=1)
print('\n元数据已保存。总计', sum(v['kb'] for v in meta.values()), 'KB')
