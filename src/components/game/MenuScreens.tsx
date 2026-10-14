'use client'
// ============ 主菜单系列界面（参照原版布局还原） ============
// 主菜单（开始冒险/继续冒险/联机合作/统计/设置/制作名单）
// 角色选择（四角色站立 + 出发/返回）
import { useEffect, useState } from 'react'
import { useGame } from '@/store/gameStore'
import { CHARACTER_INFO } from '@/game/run'
import { CharacterId } from '@/game/types'
import { hasSave, loadStats, loadSettings, savePlayerName, saveMusicVolume, StatsData } from '@/game/persist'
import { RELICS } from '@/game/relics'
import { music } from '@/game/music'

const A = '/assets'

const CHARACTERS: CharacterId[] = ['ironclad', 'silent', 'defect', 'watcher']

// ============ 原版主菜单背景（TitleBackground.java 还原，第二十五批） ============
// 原版层次：sky(1920x1469,底部裁100px) → mg3Top(1920x1140,底部对齐铺满) →
//   塔身红光mg3TopGlow1/2(加法混合呼吸) → midClouds×12(向左) → topClouds×6(向右) → logo
// 云按原版 1920x1266 设计画布定位（画布底在屏幕顶下方 1080+20px 处），
// 漂移 wrap 语义与原版一致（x 越过 ±1920 从另一侧回来），速度取原版 10~50px/s 区间
const STS_S = 1600 / 1920 // 舞台(1600) 与原版美术(1920) 缩放比
// [文件名, packedW, packedH, offX, offY(自画布底), 速度px/s, 负延迟s, y抖动px]
type CloudDef = [string, number, number, number, number, number, number, number]
const MID_CLOUDS: CloudDef[] = [ // 中层云：向左漂移（原版 vX=-50~-10）
  ['midCloud1', 452, 165, 582, 740, -14, -90, 10],
  ['midCloud2', 856, 216, 445, 740, -30, -200, -14],
  ['midCloud3', 775, 203, 535, 751, -22, -330, 8],
  ['midCloud4', 642, 179, 554, 760, -40, -120, -20],
  ['midCloud5', 1252, 284, 376, 52, -18, -280, 16],
  ['midCloud6', 272, 57, 665, 651, -36, -60, -6],
  ['midCloud7', 911, 186, 506, 46, -26, -150, 12],
  ['midCloud8', 1293, 372, 558, 86, -33, -370, -10],
  ['midCloud9', 1686, 581, 41, 390, -16, -220, 18],
  ['midCloud10', 635, 341, 473, 498, -28, -50, -16],
  ['midCloud11', 1237, 638, 637, 190, -24, -300, 6],
  ['midCloud12', 1519, 595, 342, 232, -35, -170, -12],
]
const TOP_CLOUDS: CloudDef[] = [ // 顶层云：向右漂移（原版 vX=10~50）
  ['topCloud1', 558, 176, 811, 807, 15, -100, 12],
  ['topCloud2', 1561, 374, 118, 398, 38, -250, -8],
  ['topCloud3', 1299, 350, 257, 182, 25, -40, 16],
  ['topCloud4', 585, 181, 1199, 677, 33, -180, -18],
  ['topCloud5', 599, 151, 10, 445, 20, -310, 10],
  ['topCloud6', 411, 97, 95, 872, 42, -70, -10],
]
/** 单朵漂云：定位/尺寸按原版画布等比换算，动画区间复刻原版 ±1920 wrap */
function TitleCloud({ def }: { def: CloudDef }) {
  const [name, w, h, offX, offY, v, delay, jit] = def
  const from = -(1920 / Math.sign(v || 1) + offX) * STS_S // 向右:-(1920+offX) 向左:(1920-offX)
  const to = (1920 * Math.sign(v || 1) - offX) * STS_S    // 向右:(1920-offX)  向左:-(1920+offX)
  return (
    <img
      src={`${A}/title/${name}.webp`}
      alt=""
      draggable={false}
      className="sts-cloud"
      style={{
        left: offX * STS_S,
        top: (1100 - offY - h) * STS_S + jit,
        width: w * STS_S,
        ['--from' as string]: `${from.toFixed(1)}px`,
        ['--to' as string]: `${to.toFixed(1)}px`,
        ['--dur' as string]: `${(3200 / Math.abs(v * STS_S)).toFixed(1)}s`,
        animationDelay: `${delay}s`,
      }}
    />
  )
}

// ============ 原版风格主菜单 ============
export function MainMenuScreen() {
  const gotoMenuScreen = useGame(s => s.gotoMenuScreen)
  const continueRun = useGame(s => s.continueRun)
  const [canContinue, setCanContinue] = useState(false)
  useEffect(() => { setCanContinue(hasSave()) }, [])

  const items: { label: string; onClick: () => void; disabled?: boolean }[] = [
    { label: '开 始 冒 险', onClick: () => gotoMenuScreen('charSelect') },
    { label: '继 续 冒 险', onClick: () => continueRun(), disabled: !canContinue },
    { label: '联 机 合 作', onClick: () => gotoMenuScreen('mpLobby') },
    { label: '统　　计', onClick: () => gotoMenuScreen('stats') },
    { label: '设　　置', onClick: () => gotoMenuScreen('settings') },
    { label: '制 作 名 单', onClick: () => gotoMenuScreen('credits') },
  ]

  return (
    <div className="w-full h-full relative flex flex-col items-center justify-center select-none overflow-hidden sts-screen-fade">
      {/* 原版 sky（jpg/sky 1920x1469）：cover 后底部对齐再裁 83px（=原版 y=-100） */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${A}/bg/menubg.jpg)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center -241px',
        }}
      />
      {/* 原版中景 mg3Top（1920x1140）：底部对齐铺满，顶部溢出 50px（=原版 60px×S） */}
      <img
        src={`${A}/title/mg3Top.webp`}
        alt=""
        draggable={false}
        className="absolute left-0 bottom-0 w-full pointer-events-none select-none"
      />
      {/* 塔身红光（原版 mg3TopGlow1/2，加法混合呼吸，周期 5.76s） */}
      <img
        src={`${A}/title/mg3TopGlow1.webp`} alt="" draggable={false}
        className="sts-glow" style={{ left: 225 * STS_S, top: (1080 - 289 - 60) * STS_S, width: 158 * STS_S }}
      />
      <img
        src={`${A}/title/mg3TopGlow2.webp`} alt="" draggable={false}
        className="sts-glow" style={{ left: 234 * STS_S, top: (1080 - 330 - 60) * STS_S, width: 153 * STS_S, animationDelay: '-2.9s' }}
      />
      {/* 原版 18 朵漂云：先画 midClouds（下层），再画 topClouds（上层） */}
      {MID_CLOUDS.map(def => <TitleCloud key={def[0]} def={def} />)}
      {TOP_CLOUDS.map(def => <TitleCloud key={def[0]} def={def} />)}

      {/* 官方 Logo（第三十八批：绝对定位对齐原版锚点——TitleBackground.java draw(titleLogoImg) 中心(930,554)） */}
      <img
        src={`${A}/bg/logo.png`}
        alt="Slay the Spire"
        draggable={false}
        className="menu-logo absolute"
        style={{ left: 930 * STS_S, top: 554 * STS_S, width: 286, transform: 'translate(-50%, -50%)' }}
      />

      {/* 竖排菜单（第三十八批：MenuButton.java 原版几何——左对齐 x=75·scale，y 中心=(1080-(120+50·i))·scale
          自底向上；高 50·scale；纯文本 buttonLabelFont(32·scale) + 悬停原版高亮图 optionHighlight，无石板背景。
          顺序自底向上 index0..5：制作名单/设置/统计/联机/继续/开始 → 顶至底为 开始(591.7)…制作名单(800) */}
      {items.map((it, i) => (
        <button
          key={it.label}
          className={`sts-title sts-menu-opt${it.disabled ? ' dis' : ''}`}
          style={{
            left: 75 * STS_S,
            top: [591.7, 633.3, 675, 716.7, 758.3, 800][i] - 25 * STS_S,
            width: 330,
            height: 50 * STS_S,
            fontSize: 32 * STS_S,
            letterSpacing: 5,
          }}
          disabled={it.disabled}
          onClick={it.onClick}
        >
          <img src={`${A}/title/optionHighlight.webp`} alt="" draggable={false} className="hl" />
          <span style={{ opacity: it.disabled ? 0.45 : 1, display: 'block' }}>{it.label}</span>
        </button>
      ))}
    </div>
  )
}

// ============ 角色选择界面（第四十批：原版四分屏面板还原） ============
// 原版布局：屏幕纵向均分四条面板，每条 = 角色专属海报背景(charbg) + 站立立绘 + 底部名牌，
// 面板间白色光束分隔；选中面板全亮、其余压暗；左上返回 / 右下出发(EMBARK 金色横幅)
// 英文名名牌格式化：剥离自带 The 前缀（避免 THE THE SILENT 重复）
const stripThe = (n: string) => n.replace(/^The\s+/i, '')

const CS_PANEL: Record<CharacterId, { bg: string; x: string; color: string }> = {
  ironclad: { bg: `${A}/charbg/redBg.jpg`, x: '74%', color: '#e0603c' },
  silent: { bg: `${A}/charbg/greenBg.jpg`, x: '70%', color: '#4cc06a' },
  defect: { bg: `${A}/charbg/blueBg.jpg`, x: '70%', color: '#4a92e8' },
  watcher: { bg: `${A}/charbg/purpleBg.jpg`, x: '50%', color: '#b070e8' },
}

export function CharacterSelectScreen() {
  const startRun = useGame(s => s.startRun)
  const gotoMenuScreen = useGame(s => s.gotoMenuScreen)
  const selectedCharacter = useGame(s => s.selectedCharacter)
  const selectCharacter = useGame(s => s.selectCharacter)
  const [hoverInfo, setHoverInfo] = useState<CharacterId | null>(null)
  const info = CHARACTER_INFO[hoverInfo || selectedCharacter]

  // 预加载四张海报，避免首次选中时白闪
  useEffect(() => {
    for (const cid of CHARACTERS) {
      const img = new Image()
      img.src = CS_PANEL[cid].bg
    }
  }, [])

  return (
    <div className="w-full h-full relative select-none overflow-hidden sts-screen-fade">
      {/* ===== 四分屏面板 ===== */}
      <div className="absolute inset-0 flex">
        {CHARACTERS.map(cid => {
          const c = CHARACTER_INFO[cid]
          const p = CS_PANEL[cid]
          const active = selectedCharacter === cid
          return (
            <button
              key={cid}
              className={`cs-panel ${active ? 'active' : ''}`}
              style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
              onClick={() => selectCharacter(cid)}
              onMouseEnter={() => setHoverInfo(cid)}
              onMouseLeave={() => setHoverInfo(null)}
            >
              {/* 海报背景（原版：每角色专属海报铺满面板） */}
              <div className="cs-bg" style={{ backgroundImage: `url(${p.bg})`, backgroundPosition: `${p.x} center` }} />
              <div className="cs-dim" />

              {/* 角色立绘：站位于面板中下部（原版站位），等比缩放适配面板宽度，选中时轻微放大 */}
              <img
                className="cs-hero absolute left-1/2"
                src={`${A}/hero/${c.sprite}.png`}
                alt={c.name}
                draggable={false}
                style={{
                  bottom: 122, maxHeight: 430, maxWidth: '90%',
                  width: 'auto', height: 'auto',
                  transform: `translateX(-50%) scale(${active ? 1.05 : 1})`,
                }}
              />
              {/* 脚下彩色光晕（角色主题色） */}
              <div
                className="absolute left-1/2"
                style={{
                  bottom: 108, width: 300, height: 54, transform: 'translateX(-50%)',
                  background: `radial-gradient(ellipse at center, ${p.color}${active ? '55' : '22'} 0%, transparent 68%)`,
                  opacity: active ? 0.9 : 0.4, transition: 'opacity .28s ease',
                }}
              />

              {/* 底部名牌（中文名 + 英文名） */}
              <div className="absolute left-0 right-0 flex flex-col items-center" style={{ bottom: 30, pointerEvents: 'none' }}>
                <div
                  className="sts-title"
                  style={{
                    fontSize: 27, letterSpacing: 4,
                    color: active ? '#ffd980' : '#9a8266',
                    textShadow: '2px 2px 0 #000, 0 0 18px rgba(0,0,0,.9)',
                    transition: 'color .25s ease',
                  }}
                >
                  {c.name}
                </div>
                <div
                  className="sts-body"
                  style={{
                    fontSize: 11, letterSpacing: 3, marginTop: 2,
                    color: active ? p.color : '#6e5c46', textShadow: '1px 1px 0 #000',
                    transition: 'color .25s ease',
                  }}
                >
                  THE {stripThe(c.nameEn).toUpperCase()}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* 面板间白色光束（原版分隔光柱） */}
      {[400, 800, 1200].map(x => (
        <div key={x} className="cs-beam" style={{ left: x }} />
      ))}

      {/* 顶部/底部渐变压暗（衬托标题与名牌） */}
      <div className="cs-vignette-top" />
      <div className="cs-vignette-bottom" />

      {/* 顶部标题 */}
      <div
        className="absolute left-1/2 sts-title"
        style={{ top: 24, transform: 'translateX(-50%)', fontSize: 36, color: '#ffd980', textShadow: '3px 3px 0 #000, 0 0 30px rgba(255,180,60,.35)', letterSpacing: 10, pointerEvents: 'none' }}
      >
        选 择 你 的 角 色
      </div>

      {/* 左上返回（原版左上角返回按钮） */}
      <button
        className="cs-back absolute sts-title"
        style={{ left: 26, top: 26, fontSize: 19, padding: '9px 26px', letterSpacing: 3 }}
        onClick={() => gotoMenuScreen('title')}
      >
        ← 返 回
      </button>

      {/* 左下选中角色信息（原版底部角色信息区） */}
      <div
        className="absolute sts-body"
        style={{
          left: 30, bottom: 26, zIndex: 40, pointerEvents: 'none',
          background: 'rgba(12,7,4,.68)', border: '1.5px solid #5a4230', borderRadius: 10,
          padding: '10px 16px', color: '#c8b090', fontSize: 13.5, lineHeight: 1.75, maxWidth: 430,
        }}
      >
        <span style={{ color: '#ffd980', fontSize: 15 }}>{info.name}</span>
        <span style={{ color: '#8a7458' }}> · THE {stripThe(info.nameEn).toUpperCase()}</span><br />
        {info.desc}<br />
        生命值 <span style={{ color: '#ff8a7a' }}>{info.hp}</span> · 初始遗物「<span style={{ color: '#9ad8f0' }}>{RELICS[info.relic]?.name}</span>」
      </div>

      {/* 右下出发（原版 EMBARK 金色横幅按钮） */}
      <button
        className="cs-embark absolute"
        style={{ right: 34, bottom: 28, zIndex: 40, fontSize: 27, padding: '13px 64px', letterSpacing: 8 }}
        onClick={() => startRun()}
      >
        出 发
      </button>
    </div>
  )
}

// ============ 设置界面 ============
export function SettingsScreen() {
  const gotoMenuScreen = useGame(s => s.gotoMenuScreen)
  const [vol, setVol] = useState(music.volume)
  const [muted, setMuted] = useState(music.muted)
  const [name, setName] = useState('')

  useEffect(() => {
    const s = loadSettings()
    setName(s.playerName)
  }, [])

  return (
    <div className="w-full h-full relative flex items-center justify-center sts-screen-fade"
      style={{ backgroundImage: `url(${A}/bg/menubg.jpg)`, backgroundSize: 'cover', backgroundPosition: 'center 20%' }}>
      <div className="absolute inset-0" style={{ background: 'rgba(6,3,2,0.66)' }} />
      <div className="relative sts-panel flex flex-col items-center gap-5" style={{ padding: '36px 56px', maxWidth: 560 }}>
        <div className="sts-title" style={{ fontSize: 32, color: '#ffd980', letterSpacing: 6 }}>设 置</div>

        <div className="flex items-center gap-3 w-full">
          <span className="sts-body" style={{ color: '#c8b090', width: 110, fontSize: 15 }}>音乐音量</span>
          <input
            type="range" min={0} max={1} step={0.05} value={muted ? 0 : vol}
            onChange={e => {
              const v = Number(e.target.value)
              setVol(v); music.setVolume(v); music.setMuted(false); setMuted(false)
              saveMusicVolume(v)
            }}
            style={{ flex: 1, accentColor: '#c8a060' }}
          />
          <span className="sts-body" style={{ color: '#d8c8a8', width: 40, fontSize: 14 }}>{muted ? 0 : Math.round(vol * 100)}</span>
        </div>

        <div className="flex items-center gap-3 w-full">
          <span className="sts-body" style={{ color: '#c8b090', width: 110, fontSize: 15 }}>静音</span>
          <button
            className="sts-btn sts-body"
            style={{ fontSize: 14, padding: '6px 22px' }}
            onClick={() => { const m = !muted; setMuted(m); music.setMuted(m) }}
          >
            {muted ? '已静音（点击开启）' : '开启中（点击静音）'}
          </button>
        </div>

        <div className="flex items-center gap-3 w-full">
          <span className="sts-body" style={{ color: '#c8b090', width: 110, fontSize: 15 }}>联机昵称</span>
          <input
            className="sts-body"
            style={{ flex: 1, background: 'rgba(0,0,0,0.5)', border: '1.5px solid #6b4a2e', borderRadius: 8, color: '#e8d8b8', padding: '8px 12px', fontSize: 15 }}
            value={name}
            maxLength={10}
            onChange={e => { setName(e.target.value); savePlayerName(e.target.value) }}
            placeholder="联机时显示的名字"
          />
        </div>

        <div className="flex items-center gap-3 w-full">
          <span className="sts-body" style={{ color: '#c8b090', width: 110, fontSize: 15 }}>全屏</span>
          <button
            className="sts-btn sts-body"
            style={{ fontSize: 14, padding: '6px 22px' }}
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
              else document.documentElement.requestFullscreen().catch(() => {})
            }}
          >
            切换全屏（手机端自动横屏）
          </button>
        </div>

        <button className="sts-btn sts-title" style={{ fontSize: 20, padding: '10px 60px', marginTop: 10 }} onClick={() => gotoMenuScreen('title')}>
          返 回
        </button>
      </div>
    </div>
  )
}

// ============ 统计界面 ============
export function StatsScreen() {
  const gotoMenuScreen = useGame(s => s.gotoMenuScreen)
  const [stats, setStats] = useState<StatsData | null>(null)
  useEffect(() => { setStats(loadStats()) }, [])

  const charNames: Record<CharacterId, string> = {
    ironclad: '铁甲战士', silent: '寂静猎手', defect: '故障机器人', watcher: '观者',
  }
  const winRate = stats && stats.runs > 0 ? Math.round((stats.wins / stats.runs) * 100) : 0

  return (
    <div className="w-full h-full relative flex items-center justify-center sts-screen-fade"
      style={{ backgroundImage: `url(${A}/bg/menubg.jpg)`, backgroundSize: 'cover', backgroundPosition: 'center 20%' }}>
      <div className="absolute inset-0" style={{ background: 'rgba(6,3,2,0.66)' }} />
      <div className="relative sts-panel flex flex-col items-center gap-4" style={{ padding: '32px 60px', minWidth: 520 }}>
        <div className="sts-title" style={{ fontSize: 32, color: '#ffd980', letterSpacing: 6 }}>统 计</div>
        {stats && (
          <>
            <div className="grid grid-cols-2 gap-x-12 gap-y-2 sts-body" style={{ color: '#c8b090', fontSize: 15 }}>
              <span>冒险次数</span><b style={{ color: '#e8d8b8' }}>{stats.runs}</b>
              <span>登顶次数</span><b style={{ color: '#8ee888' }}>{stats.wins}</b>
              <span>胜率</span><b style={{ color: '#e8d8b8' }}>{winRate}%</b>
              <span>最高层数</span><b style={{ color: '#ffd980' }}>{stats.bestFloor}</b>
              <span>累计击杀</span><b style={{ color: '#e8d8b8' }}>{stats.totalKills}</b>
              <span>累计精英</span><b style={{ color: '#e8d8b8' }}>{stats.totalElites}</b>
              <span>累计金币</span><b style={{ color: '#ffd97a' }}>{stats.totalGold}</b>
            </div>
            <div className="sts-title" style={{ fontSize: 17, color: '#c8a878', marginTop: 8, letterSpacing: 3 }}>—— 各角色 ——</div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-1.5 sts-body" style={{ color: '#c8b090', fontSize: 14 }}>
              {CHARACTERS.map(c => {
                const e = stats.perChar[c]
                return (
                  <span key={c} className="col-span-2 flex justify-between" style={{ minWidth: 320 }}>
                    <span>{charNames[c]}</span>
                    <b style={{ color: '#e8d8b8' }}>{e ? `${e.runs} 局 · ${e.wins} 胜 · 最高 ${e.bestFloor} 层` : '未使用'}</b>
                  </span>
                )
              })}
            </div>
          </>
        )}
        <button className="sts-btn sts-title" style={{ fontSize: 20, padding: '10px 60px', marginTop: 10 }} onClick={() => gotoMenuScreen('title')}>
          返 回
        </button>
      </div>
    </div>
  )
}

// ============ 制作名单 ============
export function CreditsScreen() {
  const gotoMenuScreen = useGame(s => s.gotoMenuScreen)
  return (
    <div className="w-full h-full relative flex items-center justify-center sts-screen-fade overflow-hidden"
      style={{ backgroundImage: `url(${A}/bg/menubg.jpg)`, backgroundSize: 'cover', backgroundPosition: 'center 20%' }}>
      <div className="absolute inset-0" style={{ background: 'rgba(6,3,2,0.7)' }} />
      <div className="relative sts-panel flex flex-col items-center gap-4 sts-body" style={{ padding: '34px 64px', maxWidth: 640, color: '#c8b090', fontSize: 15, lineHeight: 2.1, textAlign: 'center' }}>
        <div className="sts-title" style={{ fontSize: 32, color: '#ffd980', letterSpacing: 6 }}>制 作 名 单</div>
        <div>
          <b style={{ color: '#e8d8b8' }}>Web 复刻版</b><br />
          基于 Mega Crit Games 的《杀戮尖塔》(Slay the Spire) 玩法复刻<br />
          仅供学习交流使用 · 请支持正版原作
        </div>
        <div style={{ marginTop: 6 }}>
          <b style={{ color: '#e8d8b8' }}>技术栈</b><br />
          Next.js · React · Zustand · Canvas/Web Animations · PeerJS 联机
        </div>
        <div style={{ marginTop: 6 }}>
          <b style={{ color: '#e8d8b8' }}>素材</b><br />
          游戏素材与音乐来自原版资源（学习用途）<br />
          wiki.gg 素材库 · 原版 OST
        </div>
        <div style={{ marginTop: 6 }}>
          <b style={{ color: '#e8d8b8' }}>开源</b><br />
          github.com/43aquarius/webslaythespire
        </div>
        <button className="sts-btn sts-title" style={{ fontSize: 20, padding: '10px 60px', marginTop: 12 }} onClick={() => gotoMenuScreen('title')}>
          返 回
        </button>
      </div>
    </div>
  )
}
