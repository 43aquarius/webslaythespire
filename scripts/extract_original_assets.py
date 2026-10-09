#!/usr/bin/env python3
"""第18批：从反编译原版游戏仓库提取原版素材 → public/assets
A. 场景图集解析（libGDX atlas）: 各幕战斗背景bg/篝火房campfire/事件房event + title云层
B. 平铺文件复制: 字体/篝火按钮/事件插画/Neow之眼/选人背景/地图元素/各幕BGM
"""
import os, re, shutil
from PIL import Image

SRC = "/tmp/MySlayTheSpire/src/main/resources"
OUT = "/home/z/my-project/public/assets"
ARC = "/tmp/spire-archive/public"  # spire-archive(woff2子集字体)
os.makedirs(OUT, exist_ok=True)

# ---------- libGDX atlas 解析 ----------
def parse_atlas(atlas_path):
    """返回 {region_name: (page_file, x, y, w, h, rotate)}  y为底部原点"""
    text = open(atlas_path, encoding="utf-8").read()
    lines = [l.rstrip() for l in text.splitlines()]
    regions, page = {}, None
    page_sizes = {}
    i = 0
    cur_page = None
    while i < len(lines):
        l = lines[i].strip()
        if not l:
            i += 1; continue
        # 页头: 文件名 + size行
        m = re.match(r'^(.+\.png|.+\.jpg)$', l)
        if m and (i + 1 < len(lines)) and lines[i+1].startswith('size:'):
            cur_page = l
            sm = re.match(r'size:\s*(\d+),\s*(\d+)', lines[i+1])
            page_sizes[cur_page] = (int(sm.group(1)), int(sm.group(2)))
            i += 2
            # 跳过 format/filter/repeat
            while i < len(lines) and (lines[i].startswith(('format', 'filter', 'repeat', 'pma'))):
                i += 1
            continue
        # 区域行
        m = re.match(r'^([a-zA-Z0-9_/\-]+)$', l)
        if m and cur_page:
            name = m.group(1)
            rotate, xy, size, orig, offset, index = False, None, None, None, (0, 0), -1
            j = i + 1
            while j < len(lines):
                nl = lines[j].strip()
                if re.match(r'^([a-zA-Z0-9_/\-]+)$', nl) and (j+1 >= len(lines) or lines[j+1].startswith('size:') or lines[j+1].startswith('rotate')):
                    break
                if nl.startswith('rotate:'):
                    rotate = 'true' in nl
                elif nl.startswith('xy:'):
                    xy = tuple(int(v) for v in re.findall(r'\d+', nl))
                elif nl.startswith('size:'):
                    size = tuple(int(v) for v in re.findall(r'\d+', nl))
                elif nl.startswith('orig:'):
                    orig = tuple(int(v) for v in re.findall(r'\d+', nl))
                elif nl.startswith('offset:'):
                    off = re.findall(r'\d+', nl)
                    offset = (int(off[0]), int(off[1])) if off else (0, 0)
                elif nl.startswith('index:'):
                    mm = re.search(r'-?\d+', nl); index = int(mm.group()) if mm else -1
                elif re.match(r'^(.+\.png|.+\.jpg)$', nl):
                    break
                j += 1
            if xy and size:
                regions[name] = dict(page=cur_page, xy=xy, size=size, rotate=rotate, offset=offset, index=index)
            i = j
            continue
        i += 1
    return regions, page_sizes

def extract_region(atlas_dir, atlas_name, region_name, out_path, pad=2):
    """从图集裁剪区域. 返回(成功, 尺寸)"""
    regions, pages = parse_atlas(os.path.join(atlas_dir, atlas_name))
    if region_name not in regions:
        return False, None
    r = regions[region_name]
    page_path = None
    for ext in ('.png', '.jpg'):
        p = os.path.join(atlas_dir, r['page'][:-4] + ext) if r['page'].endswith(ext) else os.path.join(atlas_dir, r['page'])
        p1 = os.path.join(atlas_dir, r['page'])
        if os.path.exists(p1):
            page_path = p1; break
    if not page_path:
        return False, None
    pw, ph = pages[r['page']]
    x, y = r['xy']; w, h = r['size']
    # libGDX y底部原点 → PIL顶部原点
    top = ph - (y + h)
    with Image.open(page_path) as im:
        if im.mode != 'RGBA':
            im = im.convert('RGBA')
        crop = im.crop((x, top, x + w, top + h))
        if r['rotate']:
            crop = crop.transpose(Image.ROTATE_90)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    if out_path.lower().endswith(('.jpg', '.jpeg')) and crop.mode != 'RGB':
        bg = Image.new('RGB', crop.size, (0, 0, 0))
        bg.paste(crop, mask=crop.split()[3] if crop.mode == 'RGBA' else None)
        crop = bg
    crop.save(out_path, quality=88 if out_path.lower().endswith(('.jpg', '.jpeg')) else None)
    return True, crop.size

report = []
def log(cat, name, ok, detail=""):
    report.append((cat, name, "OK" if ok else "MISS", detail))

# ---------- A. 各幕场景背景 ----------
SCENES = [
    ("bottomScene",  "bg",       "bg/combat1.jpg",  None),        # Act1 战斗背景
    ("cityScene",    "mod/bg1",  "bg/combat2.jpg",  None),        # Act2
    ("beyondScene",  "mod/bg1",  "bg/combat3.jpg",  None),        # Act3
    ("endingScene",  "bg",       "bg/combat4.jpg",  None),        # Act4(心脏)
]
for d, region, out, _ in SCENES:
    ok, size = extract_region(f"{SRC}/{d}", "scene.atlas", region, f"{OUT}/{out}")
    # bg保存为jpg会丢alpha,场景bg是不透明的,转RGB存jpg减小体积
    if ok:
        p = f"{OUT}/{out}"
        with Image.open(p) as im:
            im.convert("RGB").save(p, quality=88)
        os.rename(p, p)  # noop
    log("战斗背景", out, ok, str(size))

# 篝火房/事件房背景(各幕)
for i, d in enumerate(["bottomScene", "cityScene", "beyondScene", "endingScene"], 1):
    for kind in ["campfire", "event"]:
        out = f"bg/{kind}{''
        }{i}.jpg"
        out = f"bg/{kind}{i}.jpg"
        ok, size = extract_region(f"{SRC}/{d}", "scene.atlas", kind, f"{OUT}/{out}")
        if ok:
            with Image.open(f"{OUT}/{out}") as im:
                im.convert("RGB").save(f"{OUT}/{out}", quality=86)
        log("房间背景", out, ok, str(size))

# ---------- B. title图集: sky + 云 ----------
ok, size = extract_region(f"{SRC}/title", "title.atlas", "jpg/sky", f"{OUT}/bg/menubg.jpg")
if ok:
    with Image.open(f"{OUT}/bg/menubg.jpg") as im:
        im.convert("RGB").save(f"{OUT}/bg/menubg.jpg", quality=86)
log("主菜单", "bg/menubg.jpg(sky)", ok, str(size))
# 云层(动画素材): mg2 mg3Bot mg3Top + topCloud2/7 midCloud9/13
clouds = ["mg2", "mg3Bot", "mg3Top", "topCloud2", "topCloud7", "midCloud9", "midCloud13"]
os.makedirs(f"{OUT}/title", exist_ok=True)
for c in clouds:
    ok, size = extract_region(f"{SRC}/title", "title.atlas", c, f"{OUT}/title/{c}.png")
    log("主菜单云层", f"title/{c}.png", ok, str(size))

# ---------- C. 字体(原版: Kreon + 中文SourceHanSerifSC) ----------
os.makedirs(f"{OUT}/fonts", exist_ok=True)
FONTS = [
    (f"{SRC}/font/Kreon-Regular.ttf", "fonts/Kreon-Regular.ttf"),
    (f"{SRC}/font/Kreon-Bold.ttf", "fonts/Kreon-Bold.ttf"),
    (f"{SRC}/font/zhs/SourceHanSerifSC-Bold.otf", None),   # 仅记录,用archive的woff2
    (f"{ARC}/fonts/SourceHanSerifSC-Bold.woff2", "fonts/SourceHanSerifSC-Bold.woff2"),
    (f"{ARC}/fonts/SourceHanSerifSC-Medium.woff2", "fonts/SourceHanSerifSC-Medium.woff2"),
    (f"{ARC}/fonts/kreon-regular.woff2", "fonts/kreon-regular.woff2"),
    (f"{ARC}/fonts/kreon-bold.woff2", "fonts/kreon-bold.woff2"),
]
for srcp, rel in FONTS:
    if rel is None:
        log("字体", os.path.basename(srcp)+"(otf原件略,用woff2)", os.path.exists(srcp), f"{os.path.getsize(srcp)//1024}KB" if os.path.exists(srcp) else "")
        continue
    if os.path.exists(srcp):
        shutil.copy(srcp, f"{OUT}/{rel}")
        log("字体", rel, True, f"{os.path.getsize(srcp)//1024}KB")
    else:
        log("字体", rel, False, "")

# ---------- D. 平铺素材复制 ----------
FLAT = {
    "campfire按钮": [
        ("ui/campfire/sleep.png", "campfire/sleep.png"),
        ("ui/campfire/smith.png", "campfire/smith.png"),
        ("ui/campfire/outline.png", "campfire/outline.png"),
        ("ui/campfire/buttonShadow.png", "campfire/buttonShadow.png"),
        ("ui/campfire/upgradeArrow.png", "campfire/upgradeArrow.png"),
    ],
    "Neow之眼": [
        ("scenes/neow/eye.png", "neow/eye.png"),
    ] + [(f"scenes/neow/lid{i}.png", f"neow/lid{i}.png") for i in range(1, 7)],
    "选人四职业背景": [
        ("scenes/redBg.jpg", "charbg/redBg.jpg"),
        ("scenes/greenBg.jpg", "charbg/greenBg.jpg"),
        ("scenes/blueBg.jpg", "charbg/blueBg.jpg"),
        ("scenes/purpleBg.jpg", "charbg/purpleBg.jpg"),
    ],
    "地图原版元素": [
        ("ui/map/circle1.png", "maporig/circle1.png"),
        ("ui/map/circle2.png", "maporig/circle2.png"),
        ("ui/map/circle3.png", "maporig/circle3.png"),
        ("ui/map/circle4.png", "maporig/circle4.png"),
        ("ui/map/circle5.png", "maporig/circle5.png"),
        ("ui/map/dot1.png", "maporig/dot1.png"),
    ],
    "事件插画": None,  # 特殊处理(全目录)
}
for cat, items in FLAT.items():
    if items is None:
        continue
    for src_rel, out_rel in items:
        sp = f"{SRC}/images/{src_rel}"
        op = f"{OUT}/{out_rel}"
        if os.path.exists(sp):
            os.makedirs(os.path.dirname(op), exist_ok=True)
            shutil.copy(sp, op)
            log(cat, out_rel, True, f"{os.path.getsize(sp)//1024}KB")
        else:
            log(cat, out_rel, False, "")

# 事件插画(52张, images/events)
os.makedirs(f"{OUT}/events", exist_ok=True)
n_ev = 0
for f in os.listdir(f"{SRC}/images/events"):
    if f.lower().endswith(('.jpg', '.png')):
        shutil.copy(f"{SRC}/images/events/{f}", f"{OUT}/events/{f}")
        n_ev += 1
log("事件插画", f"events/({n_ev}张)", n_ev > 0, "")

# ---------- E. 各幕BGM + Boss BGM ----------
os.makedirs("/tmp/newmusic", exist_ok=True)
MUSIC = {
    "level2":  "STS_Level2_NewMix_v1.ogg",
    "level3":  "STS_Level3_v2.ogg",
    "act4":    "STS_Act4_BGM_v2.ogg",
    "boss2":   "STS_Boss2_NewMix_v1.ogg",
    "boss3":   "STS_Boss3_NewMix_v1.ogg",
    "boss4":   "STS_Boss4_v6.ogg",
    "mindbloom": "STS_Boss1MindBloom_v1.ogg",
}
for key, fn in MUSIC.items():
    sp = f"{SRC}/audio/music/{fn}"
    if os.path.exists(sp):
        shutil.copy(sp, f"/tmp/newmusic/{key}.ogg")
        log("BGM", f"{key} <- {fn}", True, f"{os.path.getsize(sp)//1024}KB")
    else:
        log("BGM", fn, False, "")

print(f"{'类别':<10} {'素材':<40} {'状态':<6} 详情")
print("-" * 90)
cats_seen = set()
for cat, name, st, d in report:
    mark = cat if cat not in cats_seen else ""
    cats_seen.add(cat)
    print(f"{mark:<10} {name:<40} {st:<6} {d}")
ok_n = sum(1 for r in report if r[2] == 'OK')
print(f"\n总计: {ok_n}/{len(report)} 成功")
