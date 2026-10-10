#!/usr/bin/env python3
# 第二十三批素材提取：顶栏全套原版素材（TopPanel bar/图标 + 能量VFX + 药水带框）
# 源: MySlayTheSpire 反编译仓库（原版一代 desktop-1.0.jar 解包）
import shutil, os

SRC = '/tmp/MySlayTheSpire/src/main/resources/images/ui'
DST = '/home/z/my-project/public/assets/topbar'
os.makedirs(DST, exist_ok=True)

# (源相对路径, 目标名, 用途)
ASSETS = [
    ('topPanel/bar.png',            'bar.png',        '顶栏底板 1920x128'),
    ('topPanel/panelHeart.png',     'hp.png',         'HP 心形图标 64'),
    ('topPanel/panelGoldBag.png',   'gold.png',       '金币钱袋图标 64'),
    ('topPanel/floor.png',          'floor.png',      '层数旗图标 64'),
    ('topPanel/deck.png',           'deck.png',       '卡组图标 64'),
    ('topPanel/map.png',            'map.png',        '地图图标 64'),
    ('topPanel/settings.png',       'settings.png',   '设置齿轮图标 64'),
    ('topPanel/energyRedVFX.png',   'energy-vfx.png', '铁甲战士能量VFX 256（EnergyPanel.setEnergy 2s 双图旋转）'),
    ('potionPopUp/potionSelectBox.png', 'potionbox.png', '药水带背景框 274x106 动态宽'),
]

for src_rel, name, note in ASSETS:
    s = os.path.join(SRC, src_rel)
    d = os.path.join(DST, name)
    shutil.copyfile(s, d)
    os.chmod(d, 0o644)
    print(f'  {name:16s} <- {src_rel}  ({os.path.getsize(d)}B) {note}')

# 尺寸核对（PIL）
try:
    from PIL import Image
    for _, name, _n in ASSETS:
        im = Image.open(os.path.join(DST, name))
        print(f'  {name:16s} {im.size[0]}x{im.size[1]}')
except ImportError:
    print('  (PIL 缺失，跳过尺寸核对)')

print(f'\n共 {len(ASSETS)} 张 -> {DST}')
