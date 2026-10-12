#!/usr/bin/env python3
"""沙箱回滚残留审计：工作区 vs 远端 origin/main 全量文件比对。
分类输出：A.工作区多余(残留污染,远端无此文件) B.远端有但工作区缺失 C.内容不同(需人工判定谁新)"""
import subprocess, hashlib, os, sys
from collections import defaultdict

REPO = "/home/z/my-project"

def git(*args):
    return subprocess.run(["git", "-C", REPO] + list(args), capture_output=True, text=True)

# 远端权威树
remote = {}
out = git("ls-tree", "-r", "--format=%(objectname)\t%(path)", "origin/main")
for line in out.stdout.splitlines():
    if "\t" in line:
        h, p = line.split("\t", 1)
        remote[p] = h
print(f"远端 origin/main 文件总数: {len(remote)}")

def wt_hash(path):
    full = os.path.join(REPO, path)
    if not os.path.isfile(full):
        return None
    h = hashlib.sha1()
    h.update(b"blob ")
    with open(full, "rb") as f:
        data = f.read()
    h.update(str(len(data)).encode())
    h.update(b"\x00")
    h.update(data)
    return h.hexdigest()

extra = []       # 工作区有、远端无（残留）
missing = []     # 远端有、工作区无
differs = []     # 两边都有但内容不同

# 遍历工作区全部文件（排除 .git/.next/node_modules）
for root, dirs, files in os.walk(REPO):
    dirs[:] = [d for d in dirs if d not in (".git", ".next", "node_modules", "tool-results")]
    for f in files:
        rel = os.path.relpath(os.path.join(root, f), REPO)
        if rel.startswith("tool-results") or rel.startswith("research/"):
            continue
        if rel not in remote:
            extra.append(rel)

for p, h in remote.items():
    wh = wt_hash(p)
    if wh is None:
        missing.append(p)
    elif wh != h:
        differs.append(p)

# 分类汇总 extra
cat = defaultdict(int)
for e in extra:
    top = "/".join(e.split("/")[:3])
    cat[top] += 1
print(f"\n[A] 工作区多余文件(远端无,回滚残留): {len(extra)}")
for k, v in sorted(cat.items(), key=lambda x: -x[1])[:25]:
    print(f"    {v:5d}  {k}")
print(f"\n[B] 远端有但工作区缺失: {len(missing)}")
for m in missing[:20]:
    print(f"    {m}")
print(f"\n[C] 内容不同(工作区≠远端): {len(differs)}")
for d in differs[:30]:
    print(f"    {d}")
