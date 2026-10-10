#!/usr/bin/env python3
"""第二十八批：原版 ZHS 默认字体 NotoSansMonoCJKsc 子集化。
考证（FontHelper.java，★★★★★）：ZHS 语言下全部文字（卡名27/描述24/类型17/检视48/能量76）
统一用 font/zhs/NotoSansMonoCJKsc-Regular.otf；prepFont 第二参是线性过滤而非粗体；
ZHS_BOLD_FONT(SourceHanSerifSC-Bold) 是从未被引用的死常量。
字符集 = 游戏全量文案扫描(src/game + src/components + src/app + standalone ui/entry/style)
       + ASCII 全集 + 常用中英标点 + 序号圈数字。"""
import os, re, subprocess, sys

REPO = "/home/z/my-project"
SRC_OTF = "/tmp/MySlayTheSpire/src/main/resources/font/zhs/NotoSansMonoCJKsc-Regular.otf"
OUT_WOFF2 = f"{REPO}/public/assets/fonts/NotoSansMonoCJKsc-Regular.woff2"
CHAR_LIST_OUT = f"{REPO}/scripts/standalone/font_charset.txt"

# ---- 1. 扫描源码字符串 ----
scan_files = []
for root in [f"{REPO}/src/game", f"{REPO}/src/components", f"{REPO}/src/app"]:
    for dirpath, _, names in os.walk(root):
        for n in names:
            if n.endswith((".ts", ".tsx")):
                scan_files.append(os.path.join(dirpath, n))
scan_files += [f"{REPO}/scripts/standalone/ui.ts", f"{REPO}/scripts/standalone/entry.ts",
               f"{REPO}/scripts/standalone/style.css"]

chars = set()
str_re = re.compile(r"""(['"`])((?:\\.|(?!\1).)*)\1""", re.S)
for f in scan_files:
    try:
        text = open(f, encoding="utf-8").read()
    except Exception:
        continue
    for m in str_re.finditer(text):
        chars.update(m.group(2))  # 源文件即 UTF-8，抓取组已是解码文本，勿再 unicode_escape
    # 注释里的中文也是潜在显示文案来源（保守并入）
    chars.update(re.findall(r"[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]", text))

# ---- 2. 基础集合 ----
chars.update(chr(i) for i in range(0x20, 0x7F))            # ASCII 可打印全集
chars.update("，。？！：；、“”‘’（）《》〈〉【】〔〕—…·×÷±≈°℃%‰")  # 中文标点
chars.update("①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮★☆♦♠♥♣♦♣♠♥↑↓←→↔⇧⏵⏶")  # 序号/花色/箭头
chars.update("　")                                            # 全角空格
chars.update("\u00A0\u2009\u202F")                            # nbsp/thin space
# 常用 CJK 缓冲（GB2312 一级 3755 字防缺字：动态拼接/测试文案兜底）
try:
    import gzip
    gb = subprocess.run(["python3", "-c", "print(1)"], capture_output=True)  # 占位
except Exception:
    pass
# GB2312 一级字库生成（区位 16-55 区）
for qu in range(16, 56):
    for wei in range(1, 95):
        try:
            b = bytes([0xA0 + qu, 0xA0 + wei])
            chars.add(b.decode("gb2312"))
        except Exception:
            pass

chars.discard("\n"); chars.discard("\t"); chars.discard("\r")
charset = "".join(sorted(c for c in chars if ord(c) >= 0x20))
han = [c for c in charset if "\u4e00" <= c <= "\u9fff"]
print(f"扫描文件 {len(scan_files)} 个；唯一字符 {len(charset)}（汉字 {len(han)}）")

# ---- 3. fontTools 子集化 ----
from fontTools.subset import Subsetter, Options, load_font, save_font
opts = Options()
opts.flavor = "woff2"
opts.layout_features = ["*"]          # 保留全部 OT 特性（等宽/竖排等）
opts.name_IDs = ["*"]
opts.notdef_outline = True
opts.glyph_names = False
opts.recalc_bounds = True
opts.drop_tables += ["FFTM"]
font = load_font(SRC_OTF, opts)
ss = Subsetter(options=opts)
ss.populate(text=charset)
ss.subset(font)
save_font(font, OUT_WOFF2, opts)
size = os.path.getsize(OUT_WOFF2)
print(f"子集 woff2: {OUT_WOFF2} = {size/1024:.0f} KB (原 OTF {os.path.getsize(SRC_OTF)/1048576:.1f} MB)")

with open(CHAR_LIST_OUT, "w", encoding="utf-8") as f:
    f.write(charset)
print(f"字符清单: {CHAR_LIST_OUT}")

# ---- 4. 覆盖校验：原 OTF 拥有的所需字形必须全部保留（emoji 等原字体本来就没有的走系统 fallback，豁免） ----
from fontTools.ttLib import TTFont
sub = TTFont(OUT_WOFF2)
sub_cmap = sub.getBestCmap()
src_cmap = TTFont(SRC_OTF).getBestCmap()
required = [c for c in charset if ord(c) in src_cmap]
missing = [c for c in required if ord(c) not in sub_cmap]
print(f"覆盖校验: 需求字形 {len(required)}，子集缺失 {len(missing)} {missing[:20]}")
sys.exit(1 if missing else 0)
