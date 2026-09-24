#!/bin/bash
# 转码 StS 原版音乐：Next.js 版高音质 + 单文件版低码率
set -e
SRC=/tmp/stsmusic
NEXT=/home/z/my-project/public/assets/audio
STANDALONE=/home/z/my-project/scripts/standalone/audio
mkdir -p "$NEXT" "$STANDALONE"

# Next.js 版：ogg q4 (~128kbps) 高音质
declare -A MAP=(
  [menu]="STS_MenuTheme_NewMix_v1"
  [level]="STS_Level1_NewMix_v1"
  [elite]="STS_EliteBoss_NewMix_v1"
  [boss]="STS_Boss1_NewMix_v1"
  [merchant]="STS_Merchant_NewMix_v1"
  [shrine]="STS_Shrine_NewMix_v1"
  [credits]="STS_Credits_v5"
  [victory]="STS_BossVictoryStinger_1_v3_MUSIC"
  [death]="STS_DeathStinger_1_v3_MUSIC"
)

for key in "${!MAP[@]}"; do
  src="$SRC/${MAP[$key]}.ogg"
  # Next.js 版
  ffmpeg -y -v error -i "$src" -c:a libvorbis -q:a 4 "$NEXT/$key.ogg"
  # 单文件版：stinger 用原样音质(本来就小)，BGM 用 q0 压缩；单文件不含 shrine/credits
  if [[ "$key" == "shrine" || "$key" == "credits" ]]; then
    continue
  fi
  if [[ "$key" == "victory" || "$key" == "death" ]]; then
    cp "$src" "$STANDALONE/$key.ogg"
  else
    ffmpeg -y -v error -i "$src" -c:a libvorbis -q:a 0 "$STANDALONE/$key.ogg"
  fi
done

echo "=== Next.js 版音频 ==="
ls -la "$NEXT" | awk '{print $9, $5}'
echo "=== 单文件版音频 ==="
ls -la "$STANDALONE" | awk '{print $9, $5}'
echo "总大小 Next.js: $(du -sh $NEXT | cut -f1) / 单文件: $(du -sh $STANDALONE | cut -f1)"
