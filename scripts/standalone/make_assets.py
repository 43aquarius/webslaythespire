#!/usr/bin/env python3
"""生成单文件版素材清单：优化尺寸 + base64 内联"""
import os, json, base64, io
from PIL import Image

ROOT = '/home/z/my-project/public/assets'
OUT = '/home/z/my-project/scripts/standalone/assets.json'

# 优化策略: [目录, 最大边, 格式, JPEG质量]
# 第十八批新增: campfire/events/title 需内联（篝火按钮/事件插画/漂云）
PLANS = {
    'cardart': (None, 'PASSTHROUGH', None),  # 已离线烘焙为 512 画布 WebP（带透明，与边框同盒渲染）→ 直接内联
    'enemies': (420, 'PNG', None),   # 敌人需要透明
    'frames': (None, 'PNG', None),   # 卡框保持
    'hero': (None, 'PNG', None),
    'intent': (None, 'PNG', None),
    'mapicons': (140, 'PNG', None),
    'neow': (640, 'PNG', None),      # 涅奥鲸鱼+眨眼眼睑(第十八批)
    # 第二十一批：原版药水分层（64px mask 图层，需保真不缩放）；旧 wiki 单图已在第二十一批移除
    'potionlayers': (None, 'PNG', None),
    # 第二十二批：结束回合按钮三态（256px 原版 topPanel 素材，保真）
    'endturn': (None, 'PNG', None),
    # 第二十三批：顶栏全套（bar 1920x128 + 心/钱袋/层旗/deck/settings 64 + 能量VFX 256 + 药水带框 274x106）
    # 共约 33KB，全部保真直接内联（PASSTHROUGH）
    'topbar': (None, 'PASSTHROUGH', None),
    'relics': (110, 'PNG', None),
    'status': (72, 'PNG', None),
    'typeicons': (None, 'PNG', None),
    'bg': (None, None, None),        # jpg 保持
    'campfire': (128, 'PNG', None),  # 原版篝火按钮(sleep/smith)
    'title': (900, 'PNG', None),     # 原版漂云(仅 3 张在用)
    # events: 仅内联本项目用到的 7 张原版插画（见下方 SELECT）
}

manifest = {}
total = 0

# 事件插画：仅内联本项目 EVENT_IMG 映射用到的原版插画（52张全量内联太浪费）
EVENT_SELECT = {
    'bonfire.jpg', 'fishing.jpg', 'goldenWing.jpg', 'deadAdventurer.png',
    'cleric.jpg', 'livingWall.jpg',
}
for f in sorted(EVENT_SELECT):
    path = f'/home/z/my-project/public/assets/events/{f}'
    if not os.path.exists(path):
        print(f'events/{f} 缺失!')
        continue
    with open(path, 'rb') as fp:
        data = fp.read()
    # jpg 直接内联；png 转 720px JPEG（插画无透明需求；manifest 键保留原名与 ui.ts EVENT_IMG 一致）
    if f.endswith('.png'):
        from PIL import Image as _Im
        import io as _io
        im = _Im.open(path).convert('RGB')
        if max(im.size) > 720:
            im.thumbnail((720, 720))
        buf = _io.BytesIO()
        im.save(buf, 'JPEG', quality=82)
        data = buf.getvalue()
    b64 = base64.b64encode(data).decode()
    manifest[f'events/{f}'] = f'data:image/jpeg;base64,{b64}'
    total += len(data)
    print(f'{"events/"+f:40s} {len(data)//1024:5d}KB (select)')

for d, (maxside, fmt, quality) in PLANS.items():
    dp = os.path.join(ROOT, d)
    if not os.path.isdir(dp):
        continue
    for f in sorted(os.listdir(dp)):
        if not f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            continue
        # 第十八批：已被原版图替换的旧背景不再内联（combat1-4/campfire*/event*/menubg 在用）
        if d == 'bg' and f in ('combat.jpg', 'menu.jpg'):
            continue
        # 漂云仅内联在用的 3 张（其余 4 张未使用）
        if d == 'title' and f not in ('mg2.png', 'topCloud2.png', 'midCloud13.png'):
            continue
        path = os.path.join(dp, f)
        key = f'{d}/{f}'
        orig_size = os.path.getsize(path)
        img = Image.open(path)

        if f.lower().endswith('.webp') or fmt == 'PASSTHROUGH':
            # 直接内联不再重编码；MIME 按扩展名（第二十三批：topbar 为 PNG，cardart 为 WebP）
            with open(path, 'rb') as fp:
                data = fp.read()
            ext = f.lower().rsplit('.', 1)[-1]
            mime = 'image/webp' if ext == 'webp' else 'image/jpeg' if ext in ('jpg', 'jpeg') else 'image/png'
        else:
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

# 音频（低码率 ogg，来自原版原声带 + 原版SFX音效）
AUDIO_DIR = '/home/z/my-project/scripts/standalone/audio'
if os.path.isdir(AUDIO_DIR):
    for root, dirs, files in os.walk(AUDIO_DIR):
        for f in sorted(files):
            if not f.endswith('.ogg'):
                continue
            path = os.path.join(root, f)
            rel = os.path.relpath(path, AUDIO_DIR).replace('\\', '/')
            with open(path, 'rb') as fp:
                data = fp.read()
            b64 = base64.b64encode(data).decode()
            manifest[f'audio/{rel}'] = f'data:audio/ogg;base64,{b64}'
            total += len(data)
            print(f'{"audio/"+rel:40s} {len(data)//1024:5d}KB (audio)')

# 字体（原版: Kreon + 中文SourceHanSerifSC, woff2）
FONT_DIR = '/home/z/my-project/public/assets/fonts'
for f in sorted(os.listdir(FONT_DIR)):
    if not f.endswith('.woff2'):
        continue
    with open(os.path.join(FONT_DIR, f), 'rb') as fp:
        data = fp.read()
    b64 = base64.b64encode(data).decode()
    manifest[f'fonts/{f}'] = f'data:font/woff2;base64,{b64}'
    total += len(data)
    print(f'{"fonts/"+f:40s} {len(data)//1024:5d}KB (font)')

with open(OUT, 'w') as f:
    json.dump(manifest, f, separators=(',', ':'))

print(f'\n共 {len(manifest)} 个文件, 总计 {total/1024/1024:.2f} MB (base64 后约 {total*1.37/1024/1024:.2f} MB)')
