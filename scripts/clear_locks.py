#!/usr/bin/env python3
"""Run this any time GitHub Desktop says 'A lock file already exists'.
   It renames all .lock files in the .git directory so git can proceed."""
import os, glob, sys

git_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".git")

patterns = [
    os.path.join(git_dir, "*.lock*"),
    os.path.join(git_dir, "objects", "*.lock*"),
    os.path.join(git_dir, "refs", "**", "*.lock*"),
]

cleared, skipped = 0, 0
for pattern in patterns:
    for f in glob.glob(pattern, recursive=True):
        # Already cleared this run
        if f.endswith(".done"):
            continue
        dest = f + ".done"
        try:
            os.rename(f, dest)
            print(f"  cleared: {os.path.relpath(f, git_dir)}")
            cleared += 1
        except Exception as e:
            print(f"  skip:    {os.path.relpath(f, git_dir)} ({e})")
            skipped += 1

if cleared == 0 and skipped == 0:
    print("No lock files found — nothing to clear.")
else:
    print(f"\nDone: {cleared} cleared, {skipped} skipped.")
    if skipped:
        print("Skipped files may already be gone — try the push again anyway.")
