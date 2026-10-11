#!/usr/bin/env python3
"""会话恢复核验：工作区文件 vs 远端 a0d02c1 内容一致性全面比对。
目的：确认工作区没有远端缺失的未推送成果（远端为唯一权威）。"""
import subprocess, hashlib, os, sys

REPO = "/home/z/my-project"

def git(*args):
    return subprocess.run(["git", "-C", REPO] + list(args), capture_output=True, text=True)

# 远端树全量文件清单
out = git("ls-tree", "-r", "--name-only", "origin/main")
remote_files = [l for l in out.stdout.splitlines() if l.strip()]
print(f"远端 a0d02c1 跟踪文件总数: {len(remote_files)}")

# 工作区 git 跟踪态(HEAD=dc2a86d)
out2 = git("ls-tree", "-r", "--name-only", "HEAD")
head_files = set(l for l in out2.stdout.splitlines() if l.strip())

def blob_hash(rev, path):
    o = git("rev-parse", f"{rev}:{path}")
    return o.stdout.strip() if o.returncode == 0 else None

def file_hash(path):
    full = os.path.join(REPO, path)
    if not os.path.isfile(full):
        return None
    h = hashlib.sha1()
    h.update(b"blob ")
    with open(full, "rb") as f:
        data = f.read()
    h.update(str(len(data)).encode())
    h.update(b"\0")
    h.update(data)
    return h.hexdigest()

identical, diff_content, missing, extra_untracked = 0, [], [], []
for p in remote_files:
    rh = blob_hash("origin/main", p)
    wh = file_hash(p)
    if wh is None:
        missing.append(p)
    elif wh == rh:
        identical += 1
    else:
        diff_content.append(p)

print(f"\n[1] 与远端完全一致: {identical}")
print(f"[2] 内容不同(工作区≠远端): {len(diff_content)}")
for p in diff_content[:40]:
    print(f"    DIFF {p}")
print(f"[3] 远端有但工作区缺失: {len(missing)}")
for p in missing[:40]:
    print(f"    MISS {p}")

# 工作区有但远端没有的 untracked 文件(排除 gitignore 的常规产物)
out3 = git("status", "--porcelain")
untracked = [l[3:] for l in out3.stdout.splitlines() if l.startswith("??")]
gitignore_pat = {"download/slay-the-spire-standalone.html"}
print(f"\n[4] untracked 总数: {len(untracked)} (是否含重要源码?)")
src_like = [p for p in untracked if (p.endswith((".ts", ".tsx", ".py", ".css")) and not p.startswith(("node_modules", "tool-results", "tests/", "research/")))]
for p in src_like[:60]:
    print(f"    UNTRACKED-SRC {p}")
print(f"untracked 源码类文件数: {len(src_like)}")
