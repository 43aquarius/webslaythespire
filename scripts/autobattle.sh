#!/bin/bash
# 自动战斗测试：反复出牌+结束回合，直到战斗结束
cd /home/z/my-project
for i in $(seq 1 30); do
  # 检查是否还在战斗
  STATE=$(agent-browser eval "(() => {
    const s = document.querySelector('[data-bg]');
    if (!s) return 'NO_COMBAT';
    return 'IN_COMBAT';
  })()" 2>/dev/null)
  if [[ "$STATE" == *"NO_COMBAT"* ]]; then
    echo "=== 战斗已结束（第 $i 轮）==="
    break
  fi
  # 尝试打出所有可打的牌
  for j in $(seq 1 6); do
    R=$(agent-browser eval "(() => {
      const cards = [...document.querySelectorAll('.sts-hand-card')];
      const playable = cards.find(c => {
        const t = c.textContent;
        const energy = parseInt(document.querySelector('.sts-energy')?.textContent || '0');
        const m = t.match(/^(\\S+?)(\\d)/);
        return c && !c.querySelector('.opacity-50');
      });
      if (!playable) return 'NONE';
      const card = playable.querySelector('.sts-card') || playable;
      card.click();
      return 'CLICKED:' + playable.textContent.slice(0, 8);
    })()" 2>/dev/null)
    if [[ "$R" == *NONE* ]]; then break; fi
    sleep 0.3
    # 若进入目标选择模式，点击第一个目标
    T=$(agent-browser eval "(() => {
      const t = document.querySelector('.sts-targetable');
      if (t) { t.click(); return 'TARGETED'; }
      return 'NO_TARGET';
    })()" 2>/dev/null)
    sleep 0.4
  done
  # 检查战斗是否结束（胜利横幅或进入奖励界面）
  S2=$(agent-browser eval "(() => {
    if (document.body.textContent.includes('战利品')) return 'REWARD';
    if (document.body.textContent.includes('战斗胜利')) return 'WIN';
    if (document.body.textContent.includes('你倒下了')) return 'LOSE';
    return 'FIGHTING';
  })()" 2>/dev/null)
  if [[ "$S2" == *REWARD* || "$S2" == *WIN* || "$S2" == *LOSE* ]]; then
    echo "=== 战斗结果: $S2 (第 $i 轮) ==="
    break
  fi
  # 点击结束回合
  agent-browser eval "(() => { [...document.querySelectorAll('button')].find(b => b.textContent.includes('结束回合'))?.click(); return 'end'; })()" > /dev/null 2>&1
  sleep 3.5
done
agent-browser screenshot scripts/shot_battle_end.png
