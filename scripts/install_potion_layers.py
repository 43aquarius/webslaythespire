#!/usr/bin/env python3
"""
第二十九批(合并线)：为钢铁精华/蛇油两种新药水安装原版瓶型图层到 potionlayers/
anvil: glass(body)/liquid/hybrid/outline —— 4张（PotionSize.ANVIL 无 spots 分支，同 moon/spiky 惯例）
snecko: glass(body)/liquid/hybrid/spots/outline —— 5张（SNECKO 有 spotsImg）
来源: /tmp/MySlayTheSpire 反编译仓库 images/potion/{anvil,snecko}/
"""
import os, shutil

SRC = '/tmp/MySlayTheSpire/src/main/resources/images/potion'
DST = '/home/z/my-project/public/assets/potionlayers'

# shape -> (源目录内文件名映射列表)
JOBS = {
    'anvil': [('body.png', 'glass'), ('liquid.png', 'liquid'), ('hybrid.png', 'hybrid'), ('outline.png', 'outline')],
    'snecko': [('body.png', 'glass'), ('liquid.png', 'liquid'), ('hybrid.png', 'hybrid'), ('spots.png', 'spots'), ('outline.png', 'outline')],
}

n = 0
for shape, files in JOBS.items():
    for src_name, layer in files:
        s = os.path.join(SRC, shape, src_name)
        d = os.path.join(DST, f'{shape}_{layer}.png')
        assert os.path.exists(s), f'缺源文件: {s}'
        shutil.copyfile(s, d)
        print(f'{shape}_{layer}.png <- {src_name} ({os.path.getsize(d)}B)')
        n += 1
print(f'共安装 {n} 张图层')
