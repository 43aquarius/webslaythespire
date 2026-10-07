#!/usr/bin/env python3
"""
烘焙卡面艺术图 → 512 画布层
=============================
背景：边框/背景/横幅/费用宝珠都是 512×512 全画布图，而艺术图是 ~248×186
裁剪图，靠 CSS 百分比定位 + objectFit:cover 映射进画布盒 —— 与边框坐标系
存在两处偏差（旧窗口 x:118..380 y:95..300 vs 原版 x:131..381 y:99..289）：
  1. 左边超宽 12px、整体左移 ~6px；
  2. 底部超出分隔线（y=266..291）漏进描述区 ~9px。
修复：按原版游戏的肖像窗口（反编译常量：卡体 300×420 内 (25,52) 起 250×190，
即 512 画布 x:131 y:99）把每张艺术图烘焙成 512×512 透明画布图，之后艺术图
与边框用完全相同的 inset:0 同盒渲染 —— 错位在数学上不可能发生。

规则：
  - 宽高比在 250/190 ±10% 内 → 直接拉伸到 250×190（原版游戏正是拉伸绘制）
  - 偏差过大（如 PIL 生成的 256×256 诅咒牌）→ 居中裁剪到窗口比例再缩放
"""
from PIL import Image
import os, sys

SRC = '/home/z/my-project/public/assets/cardart'
WIN_X, WIN_Y, WIN_W, WIN_H = 131, 99, 250, 190
TARGET_RATIO = WIN_W / WIN_H  # 1.3158
WEBP_Q = 85

def is_baked(im: Image.Image) -> bool:
    """已是 512 画布且内容包围盒 == 窗口 → 只需转格式，不再重烘焙"""
    if im.size != (512, 512):
        return False
    bbox = im.getbbox()
    if bbox is None:
        return False
    return (abs(bbox[0] - WIN_X) <= 1 and abs(bbox[1] - WIN_Y) <= 1
            and abs(bbox[2] - (WIN_X + WIN_W)) <= 1 and abs(bbox[3] - (WIN_Y + WIN_H)) <= 1)

def bake_one(path: str, out_path: str) -> tuple[int, int]:
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    if not is_baked(im):
        ratio = w / h
        if abs(ratio - TARGET_RATIO) / TARGET_RATIO > 0.10:
            # 比例偏差过大：居中裁剪到窗口比例（cover）
            if ratio > TARGET_RATIO:  # 太宽 → 裁两侧
                nw = int(h * TARGET_RATIO)
                x0 = (w - nw) // 2
                im = im.crop((x0, 0, x0 + nw, h))
            else:                     # 太高 → 裁上下
                nh = int(w / TARGET_RATIO)
                y0 = (h - nh) // 2
                im = im.crop((0, y0, w, y0 + nh))
        art = im.resize((WIN_W, WIN_H), Image.LANCZOS)
        canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
        canvas.alpha_composite(art, (WIN_X, WIN_Y))
    else:
        canvas = im
    # 输出 WebP（带透明，体积约 PNG 的 1/7）；替换旧文件
    canvas.save(out_path, 'WEBP', quality=WEBP_Q, method=6)
    if out_path != path and os.path.exists(path):
        os.remove(path)
    return w, h

def main():
    files = sorted(f for f in os.listdir(SRC) if f.endswith(('.png', '.webp')))
    if '--verify' in sys.argv:
        # 校验模式：检查所有图是否已是 512×512 且内容包围盒 == 窗口
        bad = []
        for f in files:
            im = Image.open(os.path.join(SRC, f))
            if im.size != (512, 512):
                bad.append((f, 'size', im.size)); continue
            bbox = im.getbbox()
            if bbox is None:
                bad.append((f, 'empty', None)); continue
            if not (abs(bbox[0] - WIN_X) <= 1 and abs(bbox[1] - WIN_Y) <= 1
                    and abs(bbox[2] - (WIN_X + WIN_W)) <= 1 and abs(bbox[3] - (WIN_Y + WIN_H)) <= 1):
                bad.append((f, 'bbox', bbox))
        if bad:
            for b in bad[:10]:
                print('异常:', b)
            sys.exit(1)
        print(f'校验通过: {len(files)} 张全部为 512 画布 + 窗口包围盒正确')
        return
    n = 0
    for f in files:
        stem = f.rsplit('.', 1)[0]
        bake_one(os.path.join(SRC, f), os.path.join(SRC, stem + '.webp'))
        n += 1
    print(f'已烘焙 {n} 张艺术图 → 512 画布 WebP (窗口 x:{WIN_X} y:{WIN_Y} {WIN_W}x{WIN_H})')

if __name__ == '__main__':
    main()
