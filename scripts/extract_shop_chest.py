#!/usr/bin/env python3
"""第三十一批：商店/宝箱原版素材提取
从反编译仓库提取 ZHS 版商店素材与宝箱图 → public/assets/shop/ + public/assets/chests/（webp）
来源考证（ShopScreen.java / OnSaleTag.java / AbstractChest.java / ImageMaster.java）：
  rug      ← images/npcs/rug/zhs.png        1920x1136 全屏地毯（ShopScreen.render 首层）
  purge    ← images/npcs/purge/zhs.png       512 移除服务（renderPurge）
  soldout  ← images/npcs/sold_out/zhs.png    512 售罄（renderPurge 已用分支）
  hand     ← images/npcs/merchantHand.png    512x1024 商人手（render 尾层）
  saletag  ← images/npcs/sale_tag/zhs.png    128 特卖标签（OnSaleTag）
  bubble   ← images/ui/dialog/speechBubble3.png 512 对话气泡（ShopSpeechBubble 唯一IMG，facingRight=scaleX(-1)）
  chests   ← small/medium/large/boss + Opened 各 512（SmallChest/MediumChest/LargeChest/BossChest）
"""
from PIL import Image
import os

SRC = '/tmp/MySlayTheSpire/src/main/resources'
NPC = SRC + '/images/npcs'
OUT_SHOP = '/home/z/my-project/public/assets/shop'
OUT_CHEST = '/home/z/my-project/public/assets/chests'
os.makedirs(OUT_SHOP, exist_ok=True)
os.makedirs(OUT_CHEST, exist_ok=True)

items = [
    # (源路径, 输出名, quality)
    (NPC + '/rug/zhs.png', 'rug', 88),
    (NPC + '/purge/zhs.png', 'purge', 92),
    (NPC + '/sold_out/zhs.png', 'soldout', 92),
    (NPC + '/merchantHand.png', 'hand', 92),
    (NPC + '/sale_tag/zhs.png', 'saletag', 95),
    (SRC + '/images/ui/dialog/speechBubble3.png', 'bubble', 92),
    (NPC + '/smallChest.png', '../chests/small', 92),
    (NPC + '/smallChestOpened.png', '../chests/smallOpened', 92),
    (NPC + '/mediumChest.png', '../chests/medium', 92),
    (NPC + '/mediumChestOpened.png', '../chests/mediumOpened', 92),
    (NPC + '/largeChest.png', '../chests/large', 92),
    (NPC + '/largeChestOpened.png', '../chests/largeOpened', 92),
    (NPC + '/bossChest.png', '../chests/boss', 92),
    (NPC + '/bossChestOpened.png', '../chests/bossOpened', 92),
]

total = 0
for src, name, q in items:
    is_chest = name.startswith('../')
    out_dir = OUT_CHEST if is_chest else OUT_SHOP
    out_name = name.replace('../chests/', '') if is_chest else name
    im = Image.open(src).convert('RGBA')
    # P 模式调色板图统一转 RGBA，避免 webp 转换色彩失真
    dst = os.path.join(out_dir, out_name + '.webp')
    im.save(dst, 'WEBP', quality=q, method=6, alpha_quality=90)
    sz = os.path.getsize(dst)
    total += sz
    # 校验：非透明覆盖率（防调色板转RGBA翻车）
    import numpy as np
    arr = np.array(im)
    cov = (arr[..., 3] > 0).mean()
    print(f'{out_name:14s} {str(im.size):12s} -> {sz//1024:4d}KB  非透明 {cov:.1%}')
print(f'合计 {total // 1024}KB')
