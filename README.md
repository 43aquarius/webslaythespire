# 杀戮尖塔 Web 复刻版 (Web Slay the Spire)

经典卡牌构筑 Roguelike 游戏《杀戮尖塔》(Slay the Spire) 的 Web 复刻版。扮演**铁甲战士 (Ironclad)**，征服第一幕的尖塔！

![tech](https://img.shields.io/badge/Next.js%2016-React%2019-black) ![lang](https://img.shields.io/badge/TypeScript-5-blue) ![style](https://img.shields.io/badge/Tailwind%20CSS-4-cyan)

## 游戏内容

| 系统 | 内容 |
|------|------|
| 角色 | 铁甲战士（75 HP，初始遗物：燃烧之血） |
| 卡牌 | 60+ 张（基础/普通/罕见/稀有 + 状态牌），全部支持升级 |
| 遗物 | 26 件（初始/普通/罕见/Boss 遗物） |
| 药水 | 14 种 |
| 敌人 | 第一幕全量：颚虫、邪教徒、虱子、史莱姆、真菌兽、哥布林大王、拉格维林、哨卫、史莱姆老大、守卫者、六角幽灵 |
| 地图 | StS 原版结构：16 层，第 1 层战斗、第 9 层宝箱、第 15 层篝火、第 16 层 Boss；6 路径无交叉连通 |
| 节点 | 普通战斗 / 精英 / 事件 / 商店 / 宝箱 / 篝火 / Boss |
| 音乐 | 原版原声带 9 首：标题/第一幕主题/精英/Boss/商人/圣坛/结算 + 胜利/死亡短曲，场景自动切换、淡入淡出、右上角音量控制 |

## 还原的核心机制

- **战斗**：能量系统、格挡（敏捷/脆弱）、伤害修正（力量/易伤/虚弱）、攻击意图预览
- **卡牌特性**：虚无 (Ethereal)、保留、消耗、X 费、连击、狂怒、暴走成长等
- **状态效果**：力量、敏捷、易伤、虚弱、脆弱、金属化、恶魔形态、壁垒、堕落、尖刺等 20+ 种
- **特殊敌人 AI**：拉格维林沉睡/惊醒、守卫者模式切换、史莱姆老大死亡分裂、哥布林大王激怒
- **完整流程**：卡牌奖励三选一 → 精英掉遗物 → 药水 40% 掉率 → Boss 后选 Boss 遗物 → 通关结算

## 快速开始

```bash
# 安装依赖
bun install   # 或 npm install

# 启动开发服务器
bun run dev   # 或 npm run dev

# 打开 http://localhost:3000
```

## 操作说明

- **点击卡牌**打出（需要指定目标时点击敌人；点击空白处取消选择）
- **鼠标悬停**手牌可放大查看
- **点击牌堆图标**查看抽牌堆/弃牌堆/消耗堆
- **点击药水**使用（单体药水需再点击目标敌人，✕ 丢弃）
- **右上角 🎵** 调节音乐音量 / 静音（首次点击页面后开始播放）

## 项目结构

```
src/
├── game/              # 纯游戏逻辑（无 UI 依赖，可独立测试）
│   ├── types.ts       # 类型定义
│   ├── cards*.ts      # 卡牌数据库
│   ├── enemies.ts     # 敌人数据库与遭遇表
│   ├── relics.ts      # 遗物数据库
│   ├── potions.ts     # 药水数据库
│   ├── events.ts      # 事件数据库
│   ├── map.ts         # StS 风格地图生成算法
│   ├── engine.ts      # 战斗引擎（伤害计算/回合流程/敌人AI）
│   └── run.ts         # 运行级逻辑（奖励/商店/事件效果）
├── store/
│   └── gameStore.ts   # Zustand 主控状态机
├── components/game/   # UI 组件（战斗/地图/商店/事件等）
└── app/               # Next.js 入口
public/assets/         # 游戏美术素材（卡框/敌人/遗物/图标）
public/assets/audio/   # 原版原声带（按场景映射，见 src/game/music.ts）
scripts/               # 自动化测试（Node 直接驱动 store 跑完整局）
```

## 单文件版本

仓库根目录的 `slay-the-spire-standalone.html` 是本项目的**单文件 HTML 版本**，无需构建、双击即玩（含全部美术与音乐素材，约 11MB）。

## 音乐来源说明

背景音乐来自 Slay the Spire 原版原声带（`.ogg`，经转码压缩），曲目与场景的映射关系（标题→菜单曲、第一幕地图与普通战斗→Exordium 主题、精英/Boss/商人/圣坛/结算各自独立曲目）依照原版反编译源码中 `MusicMaster.java` / `MainMusic.java` 的逻辑实现。

## 说明

本项目为学习研究用途的复刻实现。Slay the Spire 原游戏版权归 Mega Crit 所有。
