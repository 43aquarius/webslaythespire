#!/usr/bin/env python3
# 第三十一批预研：素材方向判定 + 体积预估
from PIL import Image
import numpy as np
import os

NPC = '/tmp/MySlayTheSpire/src/main/resources/images/npcs'
DLG = '/tmp/MySlayTheSpire/src/main/resources/images/ui/dialog'

# 1) 气泡图尾巴方向
for f in ['speechBubble2.png', 'speechBubble3.png']:
    im = Image.open(os.path.join(DLG, f)).convert('RGBA')
    a = np.array(im)
    alpha = a[..., 3]
    h, w = alpha.shape
    bottom = alpha[int(h * 0.85):, :]
    left_mass = int((bottom[:, :w // 2] > 0).sum())
    right_mass = int((bottom[:, w // 2:] > 0).sum())
    tail = '左' if left_mass > right_mass else '右'
    print(f, im.size, 'bottom-left', left_mass, 'bottom-right', right_mass, '=> 尾巴在', tail)

# 2) 体积预估
cases = [
    ('rug/zhs.png', 'rug'),
    ('purge/zhs.png', 'purge'),
    ('sold_out/zhs.png', 'soldout'),
    ('merchantHand.png', 'hand'),
    ('sale_tag/zhs.png', 'saletag'),
    ('merchantObjects.png', 'objects'),
    ('smallChest.png', 'chestS'),
    ('smallChestOpened.png', 'chestSO'),
    ('mediumChest.png', 'chestM'),
    ('mediumChestOpened.png', 'chestMO'),
    ('largeChest.png', 'chestL'),
    ('largeChestOpened.png', 'chestLO'),
    ('bossChest.png', 'chestB'),
    ('bossChestOpened.png', 'chestBO'),
]
os.makedirs('/tmp/probe31', exist_ok=True)
for src, name in cases:
    p = os.path.join(NPC, src)
    im = Image.open(p).convert('RGBA')
    png_path = f'/tmp/probe31/{name}.png'
    webp_path = f'/tmp/probe31/{name}.webp'
    im.save(png_path)
    im.save(webp_path, 'WEBP', quality=88, method=6)
    print(f'{name:8s} {str(im.size):12s} png {os.path.getsize(png_path)//1024:5d}KB  webp {os.path.getsize(webp_path)//1024:5d}KB')

# 3) 气泡图体积
for f in ['speechBubble2.png', 'speechBubble3.png']:
    im = Image.open(os.path.join(DLG, f)).convert('RGBA')
    webp_path = f'/tmp/probe31/{f[:-4]}.webp'
    im.save(webp_path, 'WEBP', quality=90, method=6)
    print(f'{f[:-4]:12s} {str(im.size):12s} webp {os.path.getsize(webp_path)//1024:5d}KB')
