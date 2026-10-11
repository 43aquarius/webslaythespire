#!/usr/bin/env python3
"""
第二十一批：原版药水分层渲染合成
从 MySlayTheSpire 反编译仓库提取原版 12 种瓶子形状 × 5 层素材，
按 AbstractPotion.render() 原版管线合成：liquid(×liquidColor) → hybrid(×hybridColor)
→ spots(×spotsColor) → container/glass(白色)，64×64 画布。
颜色来源：libGDX 1.9.5 Color.java（权威拉取）/ StS Settings.java / 各 Potion 类构造函数。
"""
import os
from PIL import Image

SRC = '/tmp/MySlayTheSpire/src/main/resources/images/potion'
DST = '/home/z/my-project/public/assets/potions'
STUDY = '/home/z/my-project/scripts/study/batch21'
os.makedirs(STUDY, exist_ok=True)

# ---------- 权威颜色（RGBA, 0-255） ----------
# libGDX 1.9.5 Color.java
LIBGDX = {
    'WHITE': (255, 255, 255, 255), 'LIGHT_GRAY': (0xbf, 0xbf, 0xbf, 255),
    'DARK_GRAY': (0x3f, 0x3f, 0x3f, 255), 'BLACK': (0, 0, 0, 255),
    'CLEAR': (0, 0, 0, 0),                # 全透明（FAIRY 液体不可见）
    'SKY': (0x87, 0xce, 0xeb, 255), 'CYAN': (0, 255, 255, 255),
    'CHARTREUSE': (0x7f, 0xff, 0x00, 255), 'LIME': (0x32, 0xcd, 0x32, 255),
    'FOREST': (0x22, 0x8b, 0x22, 255), 'GOLD': (0xff, 0xd7, 0x00, 255),
    'ORANGE': (0xff, 0xa5, 0x00, 255), 'FIREBRICK': (0xb2, 0x22, 0x22, 255),
    'RED': (0xff, 0x00, 0x00, 255), 'SCARLET': (0xff, 0x34, 0x1c, 255),
    'CORAL': (0xff, 0x7f, 0x50, 255), 'VIOLET': (0xee, 0x82, 0xee, 255),
    'MAROON': (0xb0, 0x30, 0x60, 255), 'TEAL': (0, 128, 128, 255),
    'SWIFT_HEX': (0x0d, 0x42, 0x9d, 255),  # Color.valueOf("0d429dff")
}
# StS Settings.java：new Color(signedInt) → RGBA8888 解包
def rgba8888(signed_int):
    v = signed_int & 0xFFFFFFFF
    return ((v >> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255)
SETTINGS = {
    'RED_TEXT_COLOR': rgba8888(-10132481),
    'GREEN_TEXT_COLOR': rgba8888(2147418367),
    'GOLD_COLOR': rgba8888(-272084481),
}

# ---------- 20 种药水：形状 + (liquid, hybrid, spots) ----------
# 数据源：各 Potion 类 super(...) 构造 + AbstractPotion.initializeColor()
P = {
    'firePotion':      dict(shape='SPHERE', liquid=LIBGDX['RED'],          hybrid=LIBGDX['ORANGE'],        spots=None),
    'blockPotion':     dict(shape='S',      liquid=LIBGDX['SKY'],          hybrid=None,                    spots=None),
    'strengthPotion':  dict(shape='S',      liquid=LIBGDX['DARK_GRAY'],    hybrid=None,                    spots=LIBGDX['CORAL']),
    'dexterityPotion':  dict(shape='S',      liquid=LIBGDX['CHARTREUSE'],   hybrid=None,                    spots=None),
    'energyPotion':     dict(shape='BOLT',   liquid=LIBGDX['GOLD'],         hybrid=None,                    spots=None),
    'explosivePotion':  dict(shape='H',      liquid=LIBGDX['ORANGE'],       hybrid=None,                    spots=None),
    'fearPotion':       dict(shape='H',      liquid=LIBGDX['BLACK'],        hybrid=LIBGDX['SCARLET'],        spots=None),
    'weakPotion':       dict(shape='H',      liquid=LIBGDX['VIOLET'],       hybrid=LIBGDX['MAROON'],         spots=None),
    'swiftPotion':      dict(shape='H',      liquid=LIBGDX['SWIFT_HEX'],    hybrid=None,                    spots=LIBGDX['CYAN']),
    'bloodPotion':      dict(shape='H',      liquid=LIBGDX['WHITE'],        hybrid=LIBGDX['LIGHT_GRAY'],     spots=None),
    'fruitJuice':       dict(shape='HEART',  liquid=LIBGDX['ORANGE'],       hybrid=LIBGDX['LIME'],           spots=None),
    'skillPotion':      dict(shape='CARD',   liquid=LIBGDX['CHARTREUSE'],   hybrid=None,                    spots=None),
    'fairyInBottle':    dict(shape='FAIRY',  liquid=LIBGDX['CLEAR'],        hybrid=None,                    spots=LIBGDX['WHITE']),
    'attackPotion':     dict(shape='CARD',   liquid=LIBGDX['RED'],          hybrid=LIBGDX['ORANGE'],        spots=None),  # AttackPotion.java: PotionColor.FIRE
    'poisonPotion':     dict(shape='M',      liquid=LIBGDX['LIME'],         hybrid=None,                    spots=LIBGDX['FOREST']),
    'ghostInAJar':      dict(shape='GHOST',  liquid=LIBGDX['WHITE'],        hybrid=LIBGDX['LIGHT_GRAY'],     spots=None),
    'liquidBronze':     dict(shape='SPIKY',  liquid=rgba8888(-491249153),   hybrid=rgba8888(415023359),      spots=None),
    'cultistPotion':    dict(shape='MOON',   liquid=rgba8888(676576511),    hybrid=rgba8888(472670463),      spots=None),
    'essenceOfSteel':   dict(shape='ANVIL',  liquid=LIBGDX['TEAL'],         hybrid=None,                    spots=None),
    'sneckoOil':        dict(shape='SNECKO', liquid=SETTINGS['GREEN_TEXT_COLOR'], hybrid=SETTINGS['GOLD_COLOR'], spots=None),
}

# ---------- 形状 → 五层文件映射 ----------
def layers_of(shape):
    prefix = {'S': 'potion_s', 'M': 'potion_m', 'H': 'potion_h', 'T': 'potion_t'}
    if shape in prefix:
        p = prefix[shape]
        return dict(container=f'{p}_glass.png', liquid=f'{p}_liquid.png',
                    hybrid=f'{p}_hybrid.png', spots=f'{p}_spots.png')
    d = shape.lower()
    return dict(container=f'{d}/body.png', liquid=f'{d}/liquid.png',
                hybrid=f'{d}/hybrid.png', spots=f'{d}/spots.png')

def tinted(layer_path, color):
    """libGDX SpriteBatch 着色语义：texture RGBA × batch color RGBA（逐通道乘法）"""
    img = Image.open(layer_path).convert('RGBA')
    if color is None:
        return img
    r, g, b, a = [x / 255.0 for x in color]
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            pr, pg, pb, pa = img.getpixel((x, y))
            px[x, y] = (round(pr * r), round(pg * g), round(pb * b), round(pa * a))
    return img

def compose(pid):
    spec = P[pid]
    lf = layers_of(spec['shape'])
    canvas = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    # 原版 render() 顺序：liquid → hybrid → spots → container(白)
    for key in ('liquid', 'hybrid', 'spots'):
        if spec[key] is not None:
            layer = tinted(os.path.join(SRC, lf[key]), spec[key])
            canvas = Image.alpha_composite(canvas, layer)
    container = Image.open(os.path.join(SRC, lf['container'])).convert('RGBA')
    canvas = Image.alpha_composite(canvas, container)
    return canvas

# ---------- 主流程：合成 + wiki旧图RGB差对照 ----------
report = []
for pid in P:
    out = compose(pid)
    dst = os.path.join(DST, f'{pid}.png')
    out.save(dst)
    # 与 wiki 旧渲染图（git 中的原版游戏官方渲染）计算RGB差
    import subprocess
    old = subprocess.run(['git', 'show', f'HEAD:public/assets/potions/{pid}.png'],
                         cwd='/home/z/my-project', capture_output=True).stdout
    import io
    old_img = Image.open(io.BytesIO(old)).convert('RGBA').resize((64, 64))
    diff, n = 0.0, 0
    for y in range(64):
        for x in range(64):
            o = old_img.getpixel((x, y)); c_ = out.getpixel((x, y))
            if o[3] > 40 or c_[3] > 40:
                for ch in range(3):
                    diff += abs(o[ch] - c_[ch]); n += 1
    mean = diff / max(n, 1) if n else 0
    report.append((pid, P[pid]['shape'], round(mean, 2)))

print('药水分层合成完成（20种）：')
for pid, shape, mean in report:
    print(f'  {pid:16s} shape={shape:7s} 与wiki旧图平均RGB差={mean}')

# ---------- 生成对照拼图（新合成 vs wiki旧图）供 VLM 验收 ----------
cell, cols = 64, 10
sheet = Image.new('RGBA', (cols * cell * 2, 2 * cell * 3), (40, 36, 30, 255))
pids = list(P.keys())
for i, pid in enumerate(pids):
    import subprocess, io
    new_img = Image.open(f'{DST}/{pid}.png')
    old_b = subprocess.run(['git', 'show', f'HEAD:public/assets/potions/{pid}.png'],
                           cwd='/home/z/my-project', capture_output=True).stdout
    old_img = Image.open(io.BytesIO(old_b)).convert('RGBA')
    r, c = divmod(i, cols)
    sheet.paste(old_img, (c * cell, r * cell * 2))
    sheet.paste(new_img, (c * cell, r * cell * 2 + cell))
sheet.save(f'{STUDY}/potion_compare.png')
print(f'对照拼图: {STUDY}/potion_compare.png（上排=wiki旧图, 下排=新原版管线合成）')
