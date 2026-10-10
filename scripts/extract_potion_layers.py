#!/usr/bin/env python3
"""第二十一批：原版药水分层合成 — 从反编译仓库提取图层与权威着色
管线复刻 AbstractPotion.render：liquid(着色) → hybrid(着色,可选) → spots(着色,可选) → glass(白)
- PotionSize 枚举 → 图层资产（T/S/M/H=通用 potion_x_*；13种形状=目录 body/liquid/hybrid/spots/outline）
- PotionColor 枚举 → liquid/hybrid/spots 着色（libGDX 命名色 + Settings int 色 + SWIFT 字面量）
输出: public/assets/potionlayers/*.png（扁平命名 {shape}_{layer}.png）+ src/game/potionLayers.ts
"""
import re, shutil, sys
from pathlib import Path

SRC = Path('/tmp/MySlayTheSpire/src/main/resources/images/potion')
JAVA = Path('/tmp/MySlayTheSpire/src/main/java/com/megacrit/cardcrawl/potions')
DST = Path('/home/z/my-project/public/assets/potionlayers')
TS_OUT = Path('/home/z/my-project/src/game/potionLayers.ts')

# 我方18药水 id → Java 类名（fairyInBottle→FairyPotion 等）
POTION_CLASS = {
    'firePotion': 'FirePotion', 'blockPotion': 'BlockPotion', 'strengthPotion': 'StrengthPotion',
    'dexterityPotion': 'DexterityPotion', 'energyPotion': 'EnergyPotion', 'explosivePotion': 'ExplosivePotion',
    'fearPotion': 'FearPotion', 'weakPotion': 'WeakenPotion', 'swiftPotion': 'SwiftPotion',
    'bloodPotion': 'BloodPotion', 'fruitJuice': 'FruitJuice', 'skillPotion': 'SkillPotion',
    'fairyInBottle': 'FairyPotion', 'attackPotion': 'AttackPotion', 'poisonPotion': 'PoisonPotion',
    'ghostInAJar': 'GhostInAJar', 'liquidBronze': 'LiquidBronze', 'cultistPotion': 'CultistPotion',
}

# libGDX 命名色 → CSS hex（libGDX 源码值：LIGHT_GRAY=0.7, DARK_GRAY=0.3, GRAY=0.5）
LIBGDX = {
    'WHITE': '#ffffff', 'LIGHT_GRAY': '#b3b3b3', 'GOLD': '#ffd700', 'ORANGE': '#ffa500',
    'RED': '#ff0000', 'CHARTREUSE': '#7fff00', 'LIME': '#32cd32', 'FOREST': '#228b22',
    'DARK_GRAY': '#4d4d4d', 'CORAL': '#ff7f50', 'VIOLET': '#ee82ee', 'MAROON': '#b03060',
    'SCARLET': '#ff1400', 'BLACK': '#000000', 'GRAY': '#808080', 'CYAN': '#00ffff',
    'FIREBRICK': '#b22222', 'SKY': '#87ceeb', 'NAVY': '#000080',
    'CLEAR': None,  # alpha 0 → 整层跳过
}

def int_argb(v: int):
    """libGDX Color(int)：RRGGBBAA，R 在最高字节（GREEN_TEXT=0x7FFF7FFF→#7fff7f 验证）"""
    v &= 0xFFFFFFFF
    r, g, b, a = (v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF
    return f'#{r:02x}{g:02x}{b:02x}' if a >= 250 else f'rgba({r},{g},{b},{round(a / 255, 2)})'

SETTINGS = {
    'Settings.RED_TEXT_COLOR': int_argb(-10132481),
    'Settings.GREEN_TEXT_COLOR': int_argb(2147418367),
    'Settings.GOLD_COLOR': int_argb(-272084481),
}

# PotionColor → (liquid, hybrid, spots)；None=跳层。逐条对应 initializeColor switch
COLOR_MAP = {
    'BLUE': ('Color.SKY', None, None),
    'WHITE': ('Color.WHITE', 'Color.LIGHT_GRAY', None),
    'FAIRY': ('Color.CLEAR', None, 'Color.WHITE'),
    'ENERGY': ('Color.GOLD', None, None),
    'EXPLOSIVE': ('Color.ORANGE', None, None),
    'FIRE': ('Color.RED', 'Color.ORANGE', None),
    'GREEN': ('Color.CHARTREUSE', None, None),
    'POISON': ('Color.LIME', None, 'Color.FOREST'),
    'STRENGTH': ('Color.DARK_GRAY', None, 'Color.CORAL'),
    'STEROID': ('Color.DARK_GRAY', 'Color.CORAL', None),
    'SWIFT': ('#0d429d', None, 'Color.CYAN'),
    'WEAK': ('Color.VIOLET', 'Color.MAROON', None),
    'FEAR': ('Color.BLACK', 'Color.SCARLET', None),
    'ELIXIR': ('Color.GOLD', None, 'Color.DARK_GRAY'),
    'ANCIENT': ('Color.GOLD', 'Color.CYAN', None),
    'FRUIT': ('Color.ORANGE', 'Color.LIME', None),
    'SNECKO': ('Settings.GREEN_TEXT_COLOR', 'Settings.GOLD_COLOR', None),
    'SMOKE': ('Color.GRAY', 'Color.DARK_GRAY', None),
    'ATTACK': ('Settings.RED_TEXT_COLOR', 'Color.FIREBRICK', None),
    'SKILL': ('Color.FOREST', 'Color.CHARTREUSE', None),
    'POWER': ('Color.NAVY', 'Color.SKY', None),
    'NONE': ('Color.RED', None, 'Color.RED'),  # default 分支
}

# PotionSize → 扁平文件名集合；None 表示该层不存在（ImageMaster 装载清单权威）
GENERIC = {'T': 't', 'S': 's', 'M': 'm', 'H': 'h'}
SHAPE_DIR = {'SPHERE': 'sphere', 'BOTTLE': 'bottle', 'HEART': 'heart', 'SNECKO': 'snecko',
             'FAIRY': 'fairy', 'GHOST': 'ghost', 'JAR': 'jar', 'BOLT': 'bolt', 'CARD': 'card',
             'MOON': 'moon', 'SPIKY': 'spiky', 'EYE': 'eye', 'ANVIL': 'anvil'}
FULL_LAYERS = ['glass', 'liquid', 'hybrid', 'spots', 'outline']
NO_SPOTS_LAYERS = ['glass', 'liquid', 'hybrid', 'outline']  # moon/spiky/eye/anvil 无 spots

def size_files(size: str):
    if size in GENERIC:
        k = GENERIC[size]
        return k, {L: f'potion_{k}_{L if L != "glass" else "glass"}.png' for L in FULL_LAYERS}
    if size in SHAPE_DIR:
        d = SHAPE_DIR[size]
        layers = FULL_LAYERS if d in ('sphere', 'bottle', 'heart', 'snecko', 'fairy', 'ghost', 'jar', 'bolt', 'card') else NO_SPOTS_LAYERS
        return d, {L: (f'{d}/body.png' if L == 'glass' else f'{d}/{L}.png') for L in layers}
    raise SystemExit(f'未知 PotionSize: {size}')

def resolve_color(ref):
    if ref is None:
        return None
    if ref.startswith('#'):
        return ref
    if ref in SETTINGS:
        return SETTINGS[ref]
    if ref.startswith('Color.'):
        name = ref[6:]
        if name not in LIBGDX:
            raise SystemExit(f'未知 libGDX 色: {ref}')
        return LIBGDX[name]
    raise SystemExit(f'无法解析颜色: {ref}')

def parse_constructor(text: str, cls: str):
    """两种构造器形态：
    1) super(..., PotionSize.X, PotionColor.Y)                         — 简单型，色由 initializeColor 映射
    2) super(..., PotionSize.X, PotionEffect.E, liquid, hybrid, spots)  — 完整型，显式 new Color(int)/null
    返回 (size, color_or_None, liquid_int, hybrid_int, spots_int)；int 色为 -1 表示 null"""
    m = re.search(r'super\([^)]*?PotionSize\.(\w+)\s*,\s*PotionColor\.(\w+)\)', text)
    if m:
        return m.group(1), m.group(2), -1, -1, -1
    m = re.search(r'super\([^)]*?PotionSize\.(\w+)\s*,\s*PotionEffect\.\w+'
                  r'\s*,\s*(?:new Color\((-?\d+)\)|null)\s*,\s*(?:new Color\((-?\d+)\)|null)'
                  r'\s*,\s*(?:new Color\((-?\d+)\)|null)\)', text)
    if m:
        def g(i):
            v = m.group(i)
            return int(v) if v else -1
        return m.group(1), None, g(2), g(3), g(4)
    raise SystemExit(f'{cls}.java 未匹配任何构造器形态')

def main():
    if DST.exists():
        shutil.rmtree(DST)
    DST.mkdir(parents=True)
    rows, copied = [], 0
    for pid, cls in POTION_CLASS.items():
        src = JAVA / f'{cls}.java'
        if not src.exists():
            raise SystemExit(f'Java 类缺失: {src}')
        text = src.read_text(encoding='utf-8', errors='ignore')
        size, color, li_int, hy_int, sp_int = parse_constructor(text, cls)
        if color is not None:
            if color not in COLOR_MAP:
                raise SystemExit(f'{cls}: 未知 PotionColor {color}')
            li_ref, hy_ref, sp_ref = COLOR_MAP[color]
            liquid, hybrid, spots = resolve_color(li_ref), resolve_color(hy_ref), resolve_color(sp_ref)
            note = f'color={color}'
        else:
            liquid = int_argb(li_int) if li_int != -1 else None
            hybrid = int_argb(hy_int) if hy_int != -1 else None
            spots = int_argb(sp_int) if sp_int != -1 else None
            note = 'explicit-Color'
        shape, files = size_files(size)
        # 复制图层（仅复制存在的层）
        present = {}
        for L, rel in files.items():
            s = SRC / rel
            if not s.exists():
                raise SystemExit(f'图层缺失: {rel} (shape={shape})')
            dst_name = f'{shape}_{L}.png'
            shutil.copy(s, DST / dst_name)
            present[L] = True
            copied += 1
        rows.append((pid, cls, size, shape, note, liquid, hybrid, spots, list(files.keys())))
        print(f'{pid:16s} {cls:16s} size={size:7s} shape={shape:7s} {note:22s} '
              f'liquid={liquid} hybrid={hybrid} spots={spots} layers={"+".join(files.keys())}')
    # 占位图
    shutil.copy(SRC / 'potion_placeholder.png', DST / 'placeholder.png')
    copied += 1

    # 生成 TS 数据模块
    lines = [
        '// ============ 原版药水分层数据（第二十一批提取自反编译仓库） ============',
        '// 管线严格复刻 AbstractPotion.render：liquid(纯色mask) → hybrid(可选) → spots(可选) → glass(原图)',
        f'// 提取源: {len(rows)} 个药水类 super(PotionSize, PotionColor) + initializeColor 色表 + ImageMaster 装载清单',
        "export interface PotionLayerSpec { shape: string; liquid: string | null; hybrid?: string | null; spots?: string | null }",
        '',
        'export const POTION_LAYERS: Record<string, PotionLayerSpec> = {',
    ]
    for pid, cls, size, shape, note, liquid, hybrid, spots, layers in rows:
        parts = [f"shape: '{shape}'", f'liquid: {liquid and chr(39)+liquid+chr(39) or "null"}']
        if hybrid:
            parts.append(f'hybrid: {chr(39)+hybrid+chr(39)}')
        if spots:
            parts.append(f'spots: {chr(39)+spots+chr(39)}')
        lines.append(f"  {pid}: {{ {', '.join(parts)} }},  // {cls} size={size} {note} layers={'+'.join(layers)}")
    lines += [
        '}',
        '',
        "// 空槽占位（原版 PotionSlot: POTION_PLACEHOLDER @ PLACEHOLDER_COLOR = 白 75%）",
        "export const POTION_PLACEHOLDER_COLOR = 'rgba(255,255,255,0.75)'",
        '',
        '// 图层资源键（Next: `${A}/${key}`；standalone: A(key)）',
        "export function potionLayerKey(shape: string, layer: string): string {",
        "  return `potionlayers/${shape}_${layer}.png`",
        '}',
        "export const POTION_PLACEHOLDER_KEY = 'potionlayers/placeholder.png'",
        '',
    ]
    TS_OUT.write_text('\n'.join(lines), encoding='utf-8')
    print(f'\n已复制 {copied} 张图层 → {DST}')
    print(f'已生成 {TS_OUT} ({len(rows)} 条药水数据)')

if __name__ == '__main__':
    main()
