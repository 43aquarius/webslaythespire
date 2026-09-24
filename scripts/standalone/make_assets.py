#!/usr/bin/env python3
"""生成单文件版素材清单：优化尺寸 + base64 内联"""
import os, json, base64, io
from PIL import Image

ROOT = '/home/z/my-project/public/assets'
OUT = '/home/z/my-project/scripts/standalone/assets.json'

# 优化策略: [目录, 最大边, 格式, JPEG质量]
PLANS = {
    'cardart': (None, 'JPEG', 82),   # 卡面无透明需求 → JPEG
    'enemies': (420, 'PNG', None),   # 敌人需要透明
    'frames': (None, 'PNG', None),   # 卡框保持
    'hero': (None, 'PNG', None),
    'intent': (None, 'PNG', None),
    'mapicons': (140, 'PNG', None),
    'neow': (640, 'PNG', None),      # 涅奥鲸鱼
    'potions': (None, 'PNG', None),
    'relics': (110, 'PNG', None),
    'status': (72, 'PNG', None),
    'typeicons': (None, 'PNG', None),
    'bg': (None, None, None),        # jpg 保持
}

manifest = {}
total = 0

for d, (maxside, fmt, quality) in PLANS.items():
    dp = os.path.join(ROOT, d)
    if not os.path.isdir(dp):
        continue
    for f in sorted(os.listdir(dp)):
        if not f.lower().endswith(('.png', '.jpg', '.jpeg')):
            continue
        path = os.path.join(dp, f)
        key = f'{d}/{f}'
        orig_size = os.path.getsize(path)
        img = Image.open(path)

        if fmt == 'JPEG' or path.lower().endswith(('.jpg', '.jpeg')):
            im = img.convert('RGBA')
            bg = Image.new('RGB', im.size, (10, 6, 4))
            bg.paste(im, mask=im.split()[3])
            buf = io.BytesIO()
            bg.save(buf, 'JPEG', quality=quality or 80, optimize=True)
            mime = 'image/jpeg'
        else:
            im = img.convert('RGBA')
            if maxside and max(im.size) > maxside:
                ratio = maxside / max(im.size)
                im = im.resize((round(im.width * ratio), round(im.height * ratio)), Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, 'PNG', optimize=True)
            mime = 'image/png'

        data = buf.getvalue()
        if len(data) >= orig_size and not maxside and fmt != 'JPEG':
            with open(path, 'rb') as fp:
                data = fp.read()
            mime = 'image/png' if f.lower().endswith('.png') else 'image/jpeg'
        b64 = base64.b64encode(data).decode()
        manifest[key] = f'data:{mime};base64,{b64}'
        total += len(data)
        print(f'{key:40s} {orig_size//1024:5d}KB -> {len(data)//1024:5d}KB')

# 音频（低码率 ogg，来自原版原声带）
AUDIO_DIR = '/home/z/my-project/scripts/standalone/audio'
if os.path.isdir(AUDIO_DIR):
    for f in sorted(os.listdir(AUDIO_DIR)):
        if not f.endswith('.ogg'):
            continue
        path = os.path.join(AUDIO_DIR, f)
        with open(path, 'rb') as fp:
            data = fp.read()
        b64 = base64.b64encode(data).decode()
        manifest[f'audio/{f}'] = f'data:audio/ogg;base64,{b64}'
        total += len(data)
        print(f'{"audio/"+f:40s} {len(data)//1024:5d}KB (audio)')

with open(OUT, 'w') as f:
    json.dump(manifest, f, separators=(',', ':'))

print(f'\n共 {len(manifest)} 个文件, 总计 {total/1024/1024:.2f} MB (base64 后约 {total*1.37/1024/1024:.2f} MB)')
