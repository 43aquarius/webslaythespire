# Worklog

---
Task ID: 1
Agent: main
Task: 复刻 Web 版杀戮尖塔（Slay the Spire）- 项目启动

Work Log:
- 任务分类：Type 3 交互式网页开发（Next.js 16 + React 19 + Zustand + Tailwind 4）
- 还原范围：第一幕完整体验（铁甲战士，~50卡牌，26遗物，12药水，全Act1怪物/精英/Boss，地图/战斗/商店/篝火/事件/奖励）
- 已运行 init-fullstack.sh 初始化项目
- 已启动 16 个并行图片搜索（英雄/敌人精灵图/背景），结果存 public/assets/search/*.json

Stage Summary:
- 环境就绪，素材搜索进行中，开始编写游戏核心代码

---
Task ID: 2
Agent: main
Task: 完成游戏全部功能 + 修复bug + GitHub提交 + 单文件版

Work Log:
- 修复 map.ts：加入 StS 交叉连接规则与连通性保障（平均4个起始节点，72节点/图）
- 修复 enemies.ts：史莱姆精灵图文件名（acidslimeS/M、spikeSlimeS/M）、拉格维林沉睡3回合、史莱姆老大死亡分裂
- 修复 gameStore.ts：cardCost 导入缺失、事件选牌流程屏幕切换bug（原可导致牌组清空）、Boss胜利后 bossRelic 屏幕未同步
- 完成 UI：CardView(512画布统一映射)/CombatScreen(意图/FX/手牌扇形)/MapScreen(滚动地图)/Reward/Shop/Rest/Event/Treasure/BossRelic/GameOver
- 全流程自动化测试(nodetest.ts)：直接驱动 store 跑完整局 —— 多局验证 victory/gameover 均正常结算
- VLM 视觉验收：标题/地图/战斗/奖励/悬停/单文件版界面均通过
- Git 推送到 github.com/43aquarius/webslaythespire (main 分支)
- 单文件版：esbuild打包游戏逻辑+zustand垫片+原生JS UI+素材base64内联 → slay-the-spire-standalone.html (4.03MB)，实测可玩

Stage Summary:
- Next.js 版与单文件 HTML 版均完整可玩
- 产物：/home/z/my-project/download/slay-the-spire-standalone.html
- 已知限制：仅第一幕(铁甲战士)；单文件版无字体包(用系统衬线字体)

---
Task ID: 3
Agent: main
Task: 彻底检查全部 bug 并修复（用户反馈：没法结束回合等多项问题）

Work Log:
- 复现核心 bug：手牌容器(全宽 300px 高 z-index:45 的透明 div)遮挡「结束回合」「抽/弃牌堆」按钮 → elementFromPoint 实测 hitBtn:false
- UI 修复(CombatScreen)：手牌容器 pointer-events:none + 卡牌恢复 auto、按钮 z-46、取消选牌改 closest 判定、FloatFx 按 id 追踪计时、statusImg 裂图映射(angry→anger/asleep→intent-sleep/metallicizeE→metallicize)
- 逻辑修复(engine)：金币双倍入账、freeThisTurn 扣费顺序、Artifact 反制正值 debuff 失效、意图伤害预计算过时(改实时)、敌人行动后清意图、Boss必掉/精英60%药水、splitEnemy null 类型错误
- 逻辑修复(gameStore)：endTurn try/finally 防 busy 永久锁死+异常自动恢复回合、chooseEvent 先 clone 再 apply、takeCard 单卡锁定、startRun/backToTitle 重置 busy、新增 usePotionMap
- 功能补全：地图使用血瓶/果汁(usePotionOutOfCombat)、地图「查看牌组」按钮、Overlays deck 模式放开 combat 限制
- 单文件版同步：style.css pointer-events/z-46、ui.ts 状态图标映射+地图药水+查看牌组，重建 4.03MB
- 测试：16 项专项回归(regression.ts) 全过、多局全流程(victory/gameover 正常)、浏览器实测按钮 CLICKABLE、VLM 验收两个版本「全部正常」
- 生产构建通过，推送 GitHub (ee7eba7)

Stage Summary:
- 「无法结束回合」根因 = 手牌容器遮挡按钮，已修复并实测验证
- 共修复 16 项 bug + 3 项功能补全，两个版本(Next.js/单文件)同步更新
- 产物：download/slay-the-spire-standalone.html (4.03MB，实测可玩)

---
Task ID: 4
Agent: main
Task: 原版BGM + 地图bug修复 + 连线可见性 + GitHub提交

Work Log:
- 地图重写(map.ts)：对齐原版16层结构(第1层战斗/第9层宝箱/第15层篝火/第16层Boss)；6路径±1/0步进+交叉检测(垂直边永不相交)；修复3个bug——14/15层死节点(原版每图2-6个永远点不到的宝箱/篝火)、边X交叉(原每图2-5处)、连线穿过节点；类型权重对齐原版(战斗45%/事件22%/精英16%≥5层/篝火12%≥5层/商店5%，非同类连续)；前3路径固定不同起始列保证≥3起点
- 连线可见性修复：原 rgba(60,40,28,0.65)+dasharray"1 12" 在暗背景上不可见(用户反馈"没有连线")→ 改为原版风格亮米色圆点 #cfc2a4/#f0e6cc dasharray"0.5 13" width5 + 走过金色 #ffd97a 实线；像素实测可见性提升7倍
- BGM：从 GitHub 反编译源码仓库下载原版OST 9首(ogg)，按原版 MusicMaster/MainMusic.java 映射场景(标题=MenuTheme/地图&普战=Level1/精英=EliteBoss/Boss=Boss1/商店=Merchant/事件=Shrine/结算=Credits/胜死=Stinger)；ffmpeg转码(Next.js q4 ~113k / 单文件 q0 ~55k)
- 音乐引擎(两版本同构)：双Audio交叉淡入淡出、autoplay手势解锁、音量/静音localStorage持久化、右上角音量UI；修复同手势连续切歌竞态(旧fading标志会误停新曲目→改目标音量驱动循环)
- 测试：地图200种子0问题(无死节点/无交叉/无穿节点/≥3起点)；映射12用例全过；全流程胜利/失败各1局正常；16项回归全过；tsc无错；生产构建通过；浏览器实测两版本音乐播放/场景切换/音量UI正常

Stage Summary:
- 产物：Next.js版含BGM+新地图；单文件版10.89MB(含音乐base64)已重建同步download/
- 修复地图bug 3项+连线可见性，新增完整BGM系统(9首原版曲目)

---
Task ID: 5
Agent: main
Task: 手机端适配+全屏 + 画面闪动修复 + UI布局参照原版重构

Work Log:
- 【手机适配】新建 Stage 缩放系统(两版本)：全部画面按 1600×900 逻辑分辨率绘制再整体等比缩放，任意屏幕/手机比例完全一致；竖屏手机显示"请横屏游玩"提示；viewport 配置 user-scalable=no + viewport-fit=cover + touch-action
- 【全屏】右上角全屏按钮(Fullscreen API)，Android 全屏时尝试锁定横屏，iOS 不支持时自动隐藏
- 【闪动修复·Next.js】根因=key 重挂载(震动/受击时整个战斗画面含背景图销毁重建)→ 改用 Web Animations API el.animate()，实测出牌/受击/结束回合全程 DOM 零重挂载
- 【闪动修复·单文件版】根因=每次状态变化 innerHTML 全量重建(所有图片重新解码)→ 重写为区域化渲染：屏幕切换才建骨架，状态更新走键控差异更新(手牌/敌人/血条/地图节点边/HUD分区域)，卡面图片永不重载；血条改结构固定+平滑宽度更新
- 【布局重构·参照原版】新 TopHud 组件(两版本)：左上牌组按钮+血条+层数 / 右上金币+药水+遗物；敌人移至中偏右原版站位；玩家左下(状态在角色上方)；手牌加宽至168/扇形角度调优；能量球/结束回合/牌堆按钮位置对齐原版；地图与战斗共用同一 HUD
- 【触屏体验】Tip 轻点显示2秒；触屏两段式出牌(第一次点选中放大预览、再点确认/点敌人选目标)；hover 效果在触屏禁用防粘滞
- 【遗留bug修复】单文件版 rSelect/rPile(选牌/牌堆遮罩)从未被渲染→ 新增 #overlay-layer 正常显示(查看牌组/商店移除/锻造等弹窗恢复可用)；单文件版同时新增屏幕震动+受击闪白动画(与Next.js版对齐)
- 【其他】遮罩/Toast 改舞台内绝对定位(随舞台缩放)；vh/vw 单位改舞台逻辑像素；深色 body 背景防首屏白闪；背景图预加载；屏幕切换淡入动画
- 测试：tsc 无错；生产构建通过；16项回归全过；完整对局模拟(打到第16层Boss)；浏览器实测——桌面1280×720/1600×900、手机横屏844×390(舞台693×390等比居中)、竖屏390×844(横屏提示)；DOM零重挂载断言；触屏两段式出牌断言；单文件版出牌/牌堆遮罩/无闪动断言全部通过

Stage Summary:
- 产物：Next.js版 + 单文件版(10.90MB) 均已更新至 download/
- 三大需求全部完成：手机适配+全屏、闪动根因修复(两版本)、原版布局重构
- 额外修复：单文件版选牌/牌堆遮罩不显示的严重遗留bug

---
Task ID: 6
Agent: main
Task: 第三批需求：动画还原 + GitHub图标 + 内容扩充收尾 + 横屏修复 + 涅奥祝福 + UI还原 + 单文件版全同步

Work Log:
- 【素材补全】发现上一会话素材脚本未成功执行：修复 wiki.gg 下载三大坑（URL用下划线计算MD5、32×32小图标<300字节被误判失败、命名是驼峰Icon_AfterImage式）→ 用 MediaWiki API(经jina代理) 拿到128个Icon真实文件名清单；共补齐：状态图标52个、敌人51个、卡面235张、遗物32、药水18、typeicons 27张彩色、角色立绘4张、涅奥鲸鱼图；PIL生成姿态图标(怒/静/神格)+四幕背景(combat2/3/4色调偏移)；修复corruptHeart损坏图
- 【内容修正】替换3张自创卡为原版卡：连锁闪电→电动力学(闪电AOE+electro状态)、肉盾→致残云雾、弹跳之刃→弹跳药瓶；引擎同步实现(electro使闪电命中全体)；munchkin精灵改用darkling
- 【Next.js修复】修3个编译错误(ScryOverlay缺失/glassKnifePenalty类型/startRun onClick)；NeowScreen组件存在但从未挂载到page.tsx(黑屏根因)→挂载；新增ScryOverlay预见界面；CardView补底部类型行(小图标+攻击/技能/能力字样)；补齐globals.css缺失的sts-slash/sts-card-play/sts-neow-float(此前斩击/出牌特效不可见)；抽取statusInfo.ts共享模块
- 【横屏修复】双信号判定(尺寸+matchMedia)+orientationchange多次重测(100/350/800ms)+逃生按钮(自动切换横屏:全屏+lock / 竖屏继续游玩:sessionStorage记忆) —— 两版本同构
- 【单文件版全同步】ui.ts大改：标题4角色选择卡+GitHub入口、涅奥祝福界面(鲸鱼浮动动画)、四色卡框/宝球/类型图标、按角色能量球与立绘、观者姿态徽章+真言、机器人宝球行、四幕背景切换、出牌动画(中央放大卡牌)+斩击弧光+敌人突进+引导球特效、预见Scry遮罩、竖屏逃生按钮、共享statusInfo
- 测试：tsc 0错误；16项回归全过；4角色全流程模拟(寂静猎手通关第一幕Boss进第二幕/机器人通关/观者/铁甲正常)；生产构建通过；VLM视觉验收——两版本标题(GitHub图标+4角色)/涅奥(鲸鱼+4选项)/三角色战斗(立绘+卡框色+能量球色)/出牌动画(中央卡牌+斩击弧光+伤害数字)/竖屏(双逃生按钮+继续功能)/预见遮罩 全部通过；素材完整性扫描527图0损坏、222卡0缺面、52敌人0缺图

Stage Summary:
- 用户7项需求全部完成：动画(出牌/斩击/突进/闪白/震动/抽牌)、GitHub图标(两版本)、内容(4角色222卡52敌4幕)、横屏修复(双信号+逃生按钮永不卡死)、涅奥祝福、UI还原(类型图标/四色卡框/姿态/宝球)、待提交
- 产物：Next.js版 + 单文件版18.47MB(download/slay-the-spire-standalone.html)

---
Task ID: 7
Agent: main
Task: 第四批需求：返回主页+主菜单还原 + 细节还原 + bug彻查 + 联机合作（仿杀戮尖塔2）

Work Log:
- 【联机系统（最大项）】仿杀戮尖塔2双人合作模式，PeerJS P2P（免服务器，npm+esbuild双端打包）：
  - 引擎多人重构：CombatState.player→players[]（activeIdx轮转），牌堆/pending/成长追踪移入玩家结构；RunState.players[]+顶层镜像机制（syncRunActive/flushRunActive，单人局行为100%不变）；敌人意图带targetIdx目标、咒类AOE打全体存活玩家、塞牌给目标；checkCombatEnd全员死亡才判负；阵亡玩家战后50%复活
  - 网络层 net.ts：房主权威架构——房主执行全部逻辑并50ms去抖广播快照（fx/select/busy/toast全同步），客机动作fwd转发（pendingActor上下文，约25个动作），断线处理（客机回标题/房主标记队友阵亡并自动续回合）
  - 合作流程：大厅(4位房间码创建/加入+双人选角)→涅奥双人顺序祝福→共享地图→战斗P1→P2→敌人轮转→双人奖励(各自金币/各自三选一卡池/先到先得药水遗物/全员确认继续)→商店各自金币→篝火各自选择链式锻造→事件先到先得→Boss遗物→幕间治疗→通关
  - 战斗UI：双立绘并排(阵亡灰显/当前行动金框)、能量球按活动角色换色、意图▶你/▶队友目标标记、等待横幅、手牌权限门控、TopHud双血条+双金币、双人宝球/姿态/状态行
- 【主页还原】原版风格主菜单(开始/继续/联机/统计/设置/制作名单竖排木纹按钮)+角色选择屏(站立+出发/返回)+设置(音量/昵称/全屏)+统计(累计+各角色)+制作名单；游戏内齿轮菜单(Esc)：继续/设置/放弃本局(二次确认)/返回主菜单
- 【存档系统】localStorage自动存档(安全时点：非敌人回合)+继续冒险+游戏结束清档；统计持久化(局数/胜场/最高层/击杀/金币/各角色)
- 【细节还原】键盘快捷键(1-9出牌/E·空格·回车结束回合/Esc菜单，战斗界面快捷键提示)、幕间过场动画(sts-act-in)、胜利文案"登顶成功"、主菜单按钮悬浮金边
- 【存量bug修复】actTransition屏幕从未渲染(Boss选遗物后白屏)→新增幕间过场界面(两版本)；TopHud层数写死"第1幕"→动态run.act；单文件版大厅pickable写反
- 【单文件版全同步】ui.ts大改(+600行)：主菜单系列/联机大厅/双人战斗(双立绘/意图目标/等待横幅/能量球变色)/双人奖励/篝火状态/齿轮菜单/键盘快捷键/幕间过场/存档统计设置
- 测试：tsc 0错误；回归16/16；联机模拟24/24(完整第一幕双人通关到16层Boss遗物)；双浏览器真机E2E——Next.js版(PeerJS真连接：大厅RAUP房/双端状态同步/涅奥轮选/战斗P1P2敌人轮转/双人奖励各自拿卡/断线处理)全部通过；单文件版(菜单流程/战斗/快捷键/齿轮菜单/联机创建EL8Q房+双端连接+开局+战斗轮转)全部通过；全流程浏览器测试完整跑通第一幕15层+Boss+幕间进第二幕
- 产物：Next.js生产构建通过；单文件版18.60MB(download/slay-the-spire-standalone.html)

Stage Summary:
- 用户4项需求全部完成：返回主页+原版主菜单(菜单系列6屏)、细节还原(快捷键/过场/文案)、bug彻查(2存量严重bug修复+全部测试绿)、联机合作(PeerJS双人P2P全流程)
- 两个版本(Next.js/单文件)功能完全同步，均实测联机可玩

---
Task ID: 8
Agent: main
Task: 第五批需求：GitHub链接修复 + 横竖屏切换按钮 + 主菜单还原 + 角色选择/死亡怪红框bug + 机制全面对照原版修正

Work Log:
- 【Bug#1 GitHub链接】单文件版两处 href 误写 43aquaris(少u) → 修正为 43aquarius（Next.js源文本本就正确，仅单文件版错）
- 【Bug#4 角色选择退回主菜单】根因：单文件版 pickChar 误调 sigScreen('title:'+c, rTitle())，rTitle 是旧版标题屏遗留别名(=主菜单)——点角色直接把 DOM 换成主菜单且 curScreenKey 不同步，之后"开始冒险"因 gotoMenuScreen('charSelect') 与 curScreenKey 相同跳过重建 → 按钮失灵。修复：改渲染 rCharSelect + 正确签名 'charSelect:'+c
- 【Bug#5 死亡怪红框】根因：updateEnemies/EnemyView 对所有敌人(含 dying)加 targetable 类，target-pulse 动画覆盖 die 动画的 opacity:0 终态 → 死怪复活显红框。两版本修复：targetable 仅对存活敌人
- 【#2 横竖屏】两版本删除"请横屏游玩"拦截层(Stage.tsx RotatePrompt / ui.ts rotate-prompt)，新增 🔄 切换按钮(触屏设备显示，全屏+orientation.lock 反向锁定)，清理废弃 CSS
- 【#3 主菜单还原】Steam官方CDN获取原版 Logo(404×360金色透明底) + 尖塔主视觉图(1920×620) → bg/logo.png+bg/menu.jpg；主菜单重做：真实Logo+尖塔背景+暗色石板+青铜描边金字按钮(.menu-item/.menu-btn)；角色选择改原版无框站立立绘(选中发光+浮起)；设置/统计/制作名单沿用新背景
- 【#6 机制对照原版全面修正】(经 wiki.gg API 核实数值)：
  · 金币：移除错误的每幕+10%缩放(原版固定 10-20/25-35/95-105)
  · 药水掉率：40%基准±10%递变制(掉-10%/未掉+10%/每幕重置)替代固定概率，Boss不再必掉(原版"sometimes")
  · 药水稀有度：65/25/10 加权(原 uniform)
  · 卡牌奖励稀有度：3/37/60(普通) 10/40/50(精英) + 原版偏移系统(初始-5%、每普通卡+1%、出稀有重置)——首层必无稀有 ✓
  · Boss奖励：1-2幕=3张稀有卡三选一+金币+可能药水；3-4幕Boss无金币/卡/药水；Boss战后回复全部已损失生命(单人)；第4幕Boss(腐朽之心)跳过奖励+遗物直接胜利
  · 商店：固定2攻击+2技能+1能力(按类型而非稀有度)+商店权重9/37/54；一张随机卡5折(显示"5折"标签)；遗物价格按稀有度分档(143-158/238-263/285-315)；药水价格(48-53/71-79/95-105)；移除75+25 ✓
  · 涅奥祝福还原原版四槽：槽1卡牌类(移除/转化/升级/三选一获得/随机稀有) 槽2普通(maxHP按角色8/6/7/7/涅奥哀歌3场敌1血/普通遗物/100金/3药水) 槽3代价+奖励(-maxHP/受伤(HP/10)*3/诅咒/失去金币 × 移除2/转化2/+250金/稀有三选一/罕见遗物/+maxHP16-12-14-14，配对例外遵循原版) 槽4恒为Boss交换(初始遗物换随机Boss遗物)
  · 新增诅咒牌：懊悔(回合结束失去手牌数生命)/损伤/疑虑(回合结束+1虚弱，递减后施加保证下回合生效)；PIL生成三张诅咒卡面
  · 双卡操作顺序选择(移除2/转化2)复用 select.remaining 链式选牌；新增 neowGainCard offer 类选牌(SelectState.offerCards)
- 【单文件版同步】ui.ts：链接/红框/pickChar/横竖屏/主菜单/商店折扣标签/offer选牌全部同步；make_assets 重打包(541文件含新素材)；重建 19.11MB
- 【测试】regression5 新增 412 项断言全过(涅奥四槽60轮/哀歌/药水递变200轮/偏移系统/Boss奖励/商店10轮×4角色/药水权重2000次/诅咒触发/Boss回复+第4幕直胜/旧存档兼容)；regression 16/16；fulltest 全流程到16层Boss；联机模拟 22/22；单文件版浏览器测试 11项(链接/Logo/菜单/角色bug/红框)；Next.js浏览器测试 12项；生产构建通过

Stage Summary:
- 用户6项需求全部完成：链接修复、横竖屏按钮替代提示、主菜单原版还原(官方Logo+尖塔主视觉+石板按钮)、角色选择bug根因修复、死亡怪红框修复、机制全面对照原版修正(9大类)
- 两版本(Next.js/单文件19.11MB)完全同步，全部测试绿
- 产物：download/slay-the-spire-standalone.html v1.5

---
Task ID: 9
Agent: main
Task: 第七批需求：UI重合修复(药水金钱左上角+78/80血量) + 菜单设置修复 + 联机服务端架构+大厅 + 文字清理 + 弹窗滚动条（承接上会话未完成部分+新需求"血量金钱药水左上角78/80样式"）

Work Log:
- 【承接上会话(commit d57a113)已完成】Next.js版：TopHud左右互换(金币药水遗物→左上)、InGameMenu设置面板补全(静音/昵称/全屏)、net.ts重写为WebSocket中转架构(scripts/ws-server.js,端口3001,Caddy ?XTransformPort=3001 反代)、MultiplayerScreen房间大厅(实时列表+服务器状态+地址设置)、文字清理("WEB复刻版·单人+联机合作"与"基于Slay the Spire玩法复刻"删除)、globals.css .sts-card overflow修复
- 【本会话新做·78/80血量样式(两版本)】参照原版：玩家血量无血条，改为红色"75/75"文字——Next.js新增HpText组件(格挡盾牌图标+红字+低血量≤30%闪烁动画sts-hp-low)；布局重排：左上=[圆形角色头像(立绘裁剪)+血量文字+金币(队友金币)]/药水行/遗物行，右上=牌组按钮+层数+联机队友血量小字；敌人保留血条(原版行为)；单文件版hpNumShell/updateHpNum同步+style.css新样式(.hud-portrait/.hp-num/.hp-low关键帧)
- 【本会话新做·单文件版联机大厅同步】rMpLobby重写：房间大厅列表(实时推送)+服务器状态灯(●已连接/○离线)+服务器地址设置(localStorage+保存重载)+创建/房间码/列表一键加入；net.onRooms订阅+updateLobbyDynamics差异更新(房间列表局部刷新不打断输入框)+lobbyWatchTick进出屏自动订阅/退订；删除"P2P直连无需服务器"文案
- 【本会话新做·单文件版滚动条修复】style.css: .sts-card加overflow:hidden(裁掉512画布映射溢出→根修预见/牌堆弹窗右+下滚动条)、.overlay/.sel-cards加overflow-x:hidden
- 【本会话新做·既有bug修复】run.ts makeCombatReward: 3/4幕Boss药水掉落漏判(!(isBoss&&act>=3))——原版3/4幕Boss无任何消耗品奖励，修复后regression5 3连跑412/412全过(此前flaky失败)
- 【版本】v1.6→v1.7(两版本主菜单左下角)
- 【测试】ws-server协议测试13/13；regression 16/16；regression5 412/412×3次；tsc src/0错误；Next.js生产构建通过；浏览器E2E——Next.js版:文字清理✓/设置屏(音量滑条+静音+昵称+全屏)✓/齿轮菜单设置面板✓/单人地图+战斗78/80血量无血条+头像+金币+药水✓/敌血条保留✓/控制按钮无重叠✓/联机大厅列表+建房R8XD+双浏览器加入+涅奥轮选+双人地图(双78/80+队友名)+双人战斗轮转✓；单文件版:菜单✓/设置屏✓/78/80血量✓/牌堆弹窗无滚动条(overlay scrollW=clientW)✓/大厅连服务器(file://→ws://localhost:3001)✓/建房HSGY+Next.js版跨版本加入+双端进涅奥✓；VLM视觉核验3张截图(战斗/单文件地图/联机地图)布局全部正常
- 产物：单文件版19.03MB重建(run.ts修复后二次构建)

Stage Summary:
- 第七批6项+新需求全部完成：①药水金钱左上角+按钮不再重合 ②菜单设置可用(齿轮面板补全) ③联机改WebSocket服务端中转(ws-server.js,不再纯P2P) ④联机大厅(房间列表实时刷新+一键加入+服务器地址设置,两版本) ⑤两处文字清理 ⑥预见/牌堆弹窗滚动条根修 ⑦玩家血量改原版78/80红字样式(头像+血量+金币+药水全左上,敌人保留血条)
- 双版本(Next.js/单文件19.03MB)完全同步；跨版本联机实测互通(单文件房主↔Next.js客机)
- 附带修复：3/4幕Boss药水掉落(原版无消耗品奖励)既有flaky bug
