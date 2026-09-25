#!/usr/bin/env python3
# 单文件版 ui.ts 全面升级：主菜单系列 + 联机 + 存档 + 齿轮菜单 + 快捷键
import re

P = '/home/z/my-project/scripts/standalone/ui.ts'
src = open(P).read()

# ============ 1. imports ============
src = src.replace(
"""import { STATUS_INFO, STATUS_IMG_FIX, statusImgPath } from '@/game/statusInfo'""",
"""import { STATUS_INFO, STATUS_IMG_FIX, statusImgPath } from '@/game/statusInfo'
import { hasSave, loadStats, loadSettings, savePlayerName } from '@/game/persist'""")

# ============ 2. rTitle 拆分为主菜单 + 角色选择 + 新界面 ============
src = src.replace(
"""function rTitle(): string {
  const cards = CHARACTERS.map(c => {
    const info = CHARACTER_INFO[c]
    const sel = selectedChar === c
    const col = CHAR_COLOR[c]
    return `<div class="char-card ${sel ? 'sel' : ''}" data-act="pickChar" data-char="${c}" style="${sel ? `border-color:${col};box-shadow:0 0 22px ${col}66` : ''}">
      <img src="${A('hero/' + c + '.png')}" alt="${info.name}" draggable="false">
      <div class="sts-title" style="font-size:20px;color:${sel ? col : '#d8c8a8'};text-shadow:1px 1px 0 #000">${info.name}</div>
      <div class="sts-body" style="font-size:12px;color:#a89878;line-height:1.5">${info.desc}<br>❤ ${info.hp} 生命 · ${RELICS[info.relic]?.name ?? ''}</div>
    </div>`
  }).join('')
  return `<div class="screen bg-cover" style="background-image:url('${A('bg/combat.jpg')}')">
  <div class="shade"></div>
  <div class="center-col" style="padding-top:26px">
    <h1 class="sts-title game-title">杀戮尖塔</h1>
    <div class="sts-title subtitle">—— SLAY THE SPIRE · WEB 复刻版 ——</div>
    <div class="char-row">${cards}</div>
    <button class="sts-btn" data-act="startRun" style="font-size:26px;padding:12px 56px;margin-top:10px">开始攀登</button>
    <div class="sts-body hint">4 位可选角色 · 220+ 张卡牌 · 60+ 种敌人 · 4 幕完整旅程</div>
  </div>
  <a class="github-btn" href="https://github.com/43aquarius/webslaythespire" target="_blank" rel="noreferrer" title="GitHub 仓库">${GITHUB_SVG}<span>43aquarius/webslaythespire</span></a>
</div>`
}""",
'''// ---- 主菜单（原版风格竖排菜单） ----
function rMainMenu(): string {
  const canCont = hasSave()
  const items = [
    { label: '开 始 冒 险', act: 'gotoMenu', arg: 'charSelect', dis: false },
    { label: '继 续 冒 险', act: 'continueRun', arg: '', dis: !canCont },
    { label: '联 机 合 作', act: 'gotoMenu', arg: 'mpLobby', dis: false },
    { label: '统　　计', act: 'gotoMenu', arg: 'stats', dis: false },
    { label: '设　　置', act: 'gotoMenu', arg: 'settings', dis: false },
    { label: '制 作 名 单', act: 'gotoMenu', arg: 'credits', dis: false },
  ]
  return `<div class="screen bg-cover" style="background-image:url('${A('bg/combat.jpg')}')">
  <div class="shade" style="background:rgba(6,3,2,.62)"></div>
  <div class="center-col" style="padding-top:0;gap:14px">
    <h1 class="sts-title game-title">杀戮尖塔</h1>
    <div class="sts-title subtitle">—— SLAY THE SPIRE · WEB 复刻版 ——</div>
    <div style="display:flex;flex-direction:column;gap:11px;margin-top:26px">
      ${items.map(it => `<button class="sts-btn menu-item sts-title" data-act="${it.act}" ${it.arg ? `data-screen="${it.arg}"` : ''} ${it.dis ? 'disabled' : ''}
        style="font-size:23px;letter-spacing:5px;padding:10px 80px;min-width:320px;${it.dis ? 'opacity:.4;cursor:not-allowed' : ''}">${it.label}</button>`).join('')}
    </div>
    <div class="sts-body" style="color:#8a7458;font-size:12px;position:absolute;left:16px;bottom:12px">Web 复刻版 v1.4 · 单人 + 联机合作</div>
  </div>
  <a class="github-btn" href="https://github.com/43aquaris/webslaythespire" target="_blank" rel="noreferrer" title="GitHub 仓库">${GITHUB_SVG}<span>43aquarius/webslaythespire</span></a>
</div>`
}

// ---- 角色选择（原版：角色站立 + 出发/返回） ----
function rCharSelect(): string {
  const info = CHARACTER_INFO[selectedChar]
  const cards = CHARACTERS.map(c => {
    const sel = selectedChar === c
    const col = CHAR_COLOR[c]
    return `<div class="char-card ${sel ? 'sel' : ''}" data-act="pickChar" data-char="${c}" style="${sel ? `border-color:${col};box-shadow:0 0 22px ${col}66` : ''}">
      <img src="${A('hero/' + c + '.png')}" alt="${info.name}" draggable="false">
      <div class="sts-title" style="font-size:20px;color:${sel ? col : '#d8c8a8'};text-shadow:1px 1px 0 #000">${CHARACTER_INFO[c].name}</div>
      <div class="sts-body" style="font-size:12px;color:#a89878;line-height:1.5">${CHARACTER_INFO[c].desc}<br>❤ ${CHARACTER_INFO[c].hp} 生命 · ${RELICS[CHARACTER_INFO[c].relic]?.name ?? ''}</div>
    </div>`
  }).join('')
  return `<div class="screen bg-cover" style="background-image:url('${A('bg/combat.jpg')}')">
  <div class="shade" style="background:rgba(6,3,2,.58)"></div>
  <div class="center-col" style="padding-top:0;gap:16px">
    <div class="sts-title" style="font-size:38px;color:#ffd980;text-shadow:3px 3px 0 #000;letter-spacing:8px">选 择 你 的 角 色</div>
    <div class="char-row">${cards}</div>
    <div class="sts-body" style="color:#c8b090;font-size:14px;max-width:560px;text-align:center;line-height:1.7">
      <span style="color:#ffd980">${info.name}</span> · ${info.desc}<br>全 4 幕 · 220+ 卡牌 · 60+ 敌人 · 12 首领</div>
    <div class="row" style="gap:36px;margin-top:6px">
      <button class="sts-btn sts-title" data-act="gotoMenu" data-screen="title" style="font-size:20px;padding:10px 44px;letter-spacing:4px">返 回</button>
      <button class="sts-btn sts-title" data-act="startRun" style="font-size:26px;padding:12px 68px;letter-spacing:6px">出 发</button>
    </div>
  </div>
</div>`
}

// ---- 设置 ----
function rSettings(): string {
  const s = loadSettings()
  return `<div class="screen bg-cover" style="background-image:url('${A('bg/combat.jpg')}')">
  <div class="shade" style="background:rgba(6,3,2,.66)"></div>
  <div class="center-col" style="padding-top:0;gap:18px">
    <div class="sts-title" style="font-size:32px;color:#ffd980;letter-spacing:6px">设 置</div>
    <div class="sts-panel" style="padding:30px 48px;display:flex;flex-direction:column;gap:16px;min-width:480px">
      <div class="row" style="gap:12px"><span class="sts-body" style="color:#c8b090;width:100px;font-size:15px">联机昵称</span>
        <input class="sts-body" data-input="mpName" value="${esc(s.playerName)}" maxlength="10" placeholder="联机时显示的名字"
          style="flex:1;background:rgba(0,0,0,.5);border:1.5px solid #6b4a2e;border-radius:8px;color:#e8d8b8;padding:8px 12px;font-size:15px"></div>
      <div class="row" style="gap:12px"><span class="sts-body" style="color:#c8b090;width:100px;font-size:15px">音乐音量</span>
        <input type="range" data-input="musicVol" min="0" max="1" step="0.05" value="${music.volume}" style="flex:1;accent-color:#c8a060">
        <span class="sts-body" style="color:#d8c8a8;width:36px;font-size:14px" id="vol-label">${music.muted ? 0 : Math.round(music.volume * 100)}</span></div>
      <div class="row" style="gap:12px"><span class="sts-body" style="color:#c8b090;width:100px;font-size:15px">全屏</span>
        <button class="sts-btn sts-body" data-act="fullscreen" style="font-size:14px;padding:6px 20px">切换全屏（手机自动横屏）</button></div>
    </div>
    <button class="sts-btn sts-title" data-act="gotoMenu" data-screen="title" style="font-size:20px;padding:10px 60px">返 回</button>
  </div>
</div>`
}

// ---- 统计 ----
function rStats(): string {
  const s = loadStats()
  const winRate = s.runs > 0 ? Math.round((s.wins / s.runs) * 100) : 0
  const charRow = (c: CharacterId) => {
    const e = s.perChar[c]
    return `<div class="srow"><span>${CHARACTER_INFO[c].name}</span><b>${e ? `${e.runs} 局 · ${e.wins} 胜 · 最高 ${e.bestFloor} 层` : '未使用'}</b></div>`
  }
  return `<div class="screen bg-cover" style="background-image:url('${A('bg/combat.jpg')}')">
  <div class="shade" style="background:rgba(6,3,2,.66)"></div>
  <div class="center-col" style="padding-top:0;gap:14px">
    <div class="sts-title" style="font-size:32px;color:#ffd980;letter-spacing:6px">统 计</div>
    <div class="sts-panel" style="padding:26px 46px;display:flex;flex-direction:column;gap:9px;min-width:460px">
      <div class="srow"><span>冒险次数</span><b>${s.runs}</b></div>
      <div class="srow"><span>登顶次数</span><b style="color:#8ee888">${s.wins}</b></div>
      <div class="srow"><span>胜率</span><b>${winRate}%</b></div>
      <div class="srow"><span>最高层数</span><b style="color:#ffd980">${s.bestFloor}</b></div>
      <div class="srow"><span>累计击杀</span><b>${s.totalKills}</b></div>
      <div class="srow"><span>累计精英</span><b>${s.totalElites}</b></div>
      <div class="srow"><span>累计金币</span><b style="color:#ffd97a">${s.totalGold}</b></div>
      <div class="sts-title" style="font-size:16px;color:#c8a878;letter-spacing:3px;margin-top:8px">—— 各角色 ——</div>
      ${CHARACTERS.map(charRow).join('')}
    </div>
    <button class="sts-btn sts-title" data-act="gotoMenu" data-screen="title" style="font-size:20px;padding:10px 60px">返 回</button>
  </div>
</div>`
}

// ---- 制作名单 ----
function rCredits(): string {
  return `<div class="screen bg-cover" style="background-image:url('${A('bg/combat.jpg')}')">
  <div class="shade" style="background:rgba(6,3,2,.7)"></div>
  <div class="center-col" style="padding-top:0;gap:12px">
    <div class="sts-title" style="font-size:32px;color:#ffd980;letter-spacing:6px">制 作 名 单</div>
    <div class="sts-panel sts-body" style="padding:28px 52px;max-width:560px;color:#c8b090;font-size:15px;line-height:2;text-align:center">
      <b style="color:#e8d8b8">Web 复刻版</b><br>基于 Mega Crit Games 的《杀戮尖塔》玩法复刻<br>仅供学习交流使用 · 请支持正版原作<br>
      <b style="color:#e8d8b8">技术</b><br>原生 JS · Zustand · Web Animations · PeerJS 联机<br>
      <b style="color:#e8d8b8">开源</b><br>github.com/43aquaris/webslaythespire</div>
    <button class="sts-btn sts-title" data-act="gotoMenu" data-screen="title" style="font-size:20px;padding:10px 60px">返 回</button>
  </div>
</div>`
}

// ---- 联机大厅 ----
function rMpLobby(): string {
  const st = g()
  const n = st.net
  if (!n.role) {
    const s = loadSettings()
    return `<div class="screen bg-cover" style="background-image:url('${A('bg/combat.jpg')}')">
    <div class="shade" style="background:rgba(6,3,2,.64)"></div>
    <div class="center-col" style="padding-top:0;gap:16px">
      <div class="sts-title" style="font-size:34px;color:#ffd980;letter-spacing:8px">联 机 合 作</div>
      <div class="sts-body" style="color:#c8b090;font-size:15px;line-height:1.9;max-width:480px;text-align:center">
        仿照《杀戮尖塔 2》的合作模式：与好友一起攀登尖塔。<br>共享地图与敌人，各自拥有独立的牌组、生命与能量；<br>轮流行动，共同战斗（P2P 直连，无需服务器）。</div>
      <div class="row" style="gap:10px"><span class="sts-body" style="color:#c8b090;font-size:15px">昵称</span>
        <input class="sts-body" id="mp-name" value="${esc(s.playerName)}" maxlength="10" data-input="mpName"
          style="background:rgba(0,0,0,.5);border:1.5px solid #6b4a2e;border-radius:8px;color:#e8d8b8;padding:8px 12px;font-size:15px;width:170px"></div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:6px">
        <button class="sts-btn sts-title" data-act="mpCreate" style="font-size:22px;letter-spacing:4px;padding:10px 66px">创 建 房 间</button>
        <div class="row" style="gap:8px">
          <input class="sts-body" id="mp-code" placeholder="房间码" maxlength="6" data-input="mpCode"
            style="background:rgba(0,0,0,.5);border:1.5px solid #6b4a2e;border-radius:8px;color:#e8d8b8;padding:8px 12px;font-size:17px;width:140px;letter-spacing:3px;text-align:center;text-transform:uppercase">
          <button class="sts-btn sts-body" data-act="mpJoin" style="font-size:14px;padding:8px 16px">加入房间</button>
        </div>
      </div>
      <button class="sts-btn sts-body" data-act="gotoMenu" data-screen="title" style="font-size:15px;padding:6px 28px;margin-top:8px">返回主菜单</button>
      ${n.error ? `<div class="sts-body" style="color:#ff9a8a;font-size:14px">${esc(n.error)}</div>` : ''}
    </div>
  </div>`
  }
  const isHost = n.role === 'host'
  const myChar = isHost ? n.lobby.hostChar : n.lobby.guestChar
  const otherName = n.peerName || '等待加入…'
  const both = !!(n.lobby.hostChar && n.lobby.guestChar)
  const slot = (title: string, char: string | null, pickable: boolean, active: boolean) => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px;opacity:${active ? 1 : 0.55}">
      <div class="sts-body" style="color:#e8d8b8;font-size:15px">${esc(title)}</div>
      ${char
        ? `<img src="${A('hero/' + char + '.png')}" style="width:190px;height:133px;object-fit:contain;border-radius:12px;border:3px solid ${CHAR_COLOR[char]};background:radial-gradient(ellipse at 50% 70%,rgba(40,26,14,.9),rgba(10,6,4,.95))">`
        : `<div class="sts-body" style="width:190px;height:133px;border-radius:12px;border:3px dashed #5a4230;display:flex;align-items:center;justify-content:center;color:#8a7458;font-size:14px">${active ? '选择角色' : '未加入'}</div>`}
      ${pickable ? `<div class="row" style="gap:5px">${CHARACTERS.map(c => `<button data-act="lobbyPick" data-char="${c}" data-tip="${CHARACTER_INFO[c].name}" style="width:25px;height:25px;border-radius:50%;border:2px solid ${char === c ? '#ffd980' : CHAR_COLOR[c]};background:radial-gradient(circle at 40% 35%,${CHAR_COLOR[c]},rgba(10,8,6,.95));cursor:pointer;padding:0"></button>`).join('')}</div>` : ''}
      <div class="sts-title" style="font-size:16px;color:${char ? '#ffd980' : '#8a7458'};letter-spacing:2px">${char ? CHARACTER_INFO[char].name : '？？？'}</div>
    </div>`
  return `<div class="screen bg-cover" style="background-image:url('${A('bg/combat.jpg')}')">
  <div class="shade" style="background:rgba(6,3,2,.64)"></div>
  <div class="center-col" style="padding-top:0;gap:16px">
    <div class="sts-title" style="font-size:30px;color:#ffd980;letter-spacing:6px">合 作 大 厅</div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <div class="sts-body" style="color:#a89070;font-size:13px">房间码（告诉你的好友）</div>
      <div class="sts-title" style="font-size:44px;color:#8ee8ff;letter-spacing:12px;text-shadow:0 0 24px rgba(100,200,255,.5),3px 3px 0 #000">${n.roomCode}</div>
    </div>
    <div class="row" style="gap:52px;align-items:center">
      ${slot(n.myName + '（你）', myChar, true, true)}
      <div class="sts-title" style="font-size:26px;color:#8a7458">VS</div>
      ${slot(otherName, isHost ? n.lobby.guestChar : n.lobby.hostChar, false, n.connected)}
    </div>
    <div class="sts-body" style="color:${n.connected ? '#8ee888' : '#c8a878'};font-size:14px">
      ${!n.connected ? (isHost ? '等待好友加入…（把房间码发给对方）' : '正在连接房间…')
        : both ? (isHost ? '双方已就绪，可以出发！' : '等待房主出发…')
        : (isHost ? '等待双方选择角色…' : '选择你的角色，等待房主出发…')}</div>
    <div class="row" style="gap:22px">
      ${isHost ? `<button class="sts-btn sts-title" data-act="lobbyStart" ${n.connected && both ? '' : 'disabled'} style="font-size:23px;letter-spacing:6px;padding:12px 64px;${n.connected && both ? '' : 'opacity:.4;cursor:not-allowed'}">出 发</button>` : ''}
      <button class="sts-btn sts-body" data-act="mpLeave" style="font-size:15px;padding:8px 24px">离开房间</button>
    </div>
    ${n.error ? `<div class="sts-body" style="color:#ff9a8a;font-size:14px">${esc(n.error)}</div>` : ''}
  </div>
</div>`
}

// ---- 幕间过场 ----
const ACT_NAMES: Record<number, string> = { 2: '第 二 幕 · 城 堡', 3: '第 三 幕 · 尖 峰', 4: '终 章 · 腐 朽 心 脏' }
function rActTransition(run: RunState): string {
  const act = run.nextActInfo || run.act
  return `<div class="screen center-col" style="background:radial-gradient(ellipse at 50% 40%,#1a1208 0%,#0a0603 55%,#030201 100%);cursor:pointer" data-act="continueAct">
  <div class="sts-title" style="font-size:60px;color:#ffd980;letter-spacing:14px;text-shadow:4px 4px 0 #000,0 0 90px rgba(255,190,80,.35);animation:actIn 1.1s ease-out both">${ACT_NAMES[act] || `第 ${act} 幕`}</div>
  <div class="sts-body" style="color:#a89070;font-size:16px;letter-spacing:3px;margin-top:18px">联机模式下全体队员已获得治疗 —— 点击继续</div>
</div>`
}

function rTitle(): string {
  return rMainMenu()
}''')

open(P, 'w').write(src)
print('part1 done: menus')
