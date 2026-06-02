# Move Practice-tool to a new GitHub repo, preserve all branches

## Pre-flight

1. Create the new repo on GitHub:
   https://github.com/new
   - Owner: `mayureshh27`
   - Name: `Practice-Workspace`
   - Visibility: your choice
   - **Untick** README / .gitignore / license (empty repo is fine)

2. Verify the new repo URL is reachable:
   `https://github.com/mayureshh27/Practice-Workspace`

## Commands to run (paste into PowerShell or bash in the repo root)

```bash
cd D:\Robotics\Learning-Platform\Practice-tool

# --- 1. Save the old main as a branch (so the 3 unique commits
#        on main aren't lost when we rename the feature branch)
git branch legacy-fork-main main
git branch -a   # confirm: should show legacy-fork-main, main, feat/...

# --- 2. Swap the origin remote to the new repo
git remote remove origin
git remote add origin https://github.com/mayureshh27/Practice-Workspace.git
git remote -v   # confirm: origin -> new repo

# --- 3. Rename the feature branch to main (it carries the
#        studio-workflows work you want as the trunk)
git branch -M main
git branch -a   # confirm: main now points at 6f73dc3 / 46d622c

# --- 4. Push the new main to the new repo
git push -u origin main

# --- 5. Push the legacy fork main as a separate branch (history
#        preserved; review it later, decide what to merge in)
git push -u origin legacy-fork-main

# --- 6. Push the older revamp-frontend-design branch too
git push -u origin revamp-frontend-design

# --- 7. Init Graphite for stacked-PR workflow
gt init --trunk main
gt repo config --trunk main
gt stack short    # should show just main with no children
```

## Set up the dev branch with Graphite

```bash
# From main, start a stacked branch for the next feature
gt create dev      # creates a 'dev' branch and tracks it on origin
git push -u origin dev

# Verify
gt log             # visual stack tree
gt stack short     # 'main' and 'dev' should both be visible
```

## Going forward — the Graphite loop

For each new piece of work, the loop is:

```bash
# 1. Sync with main
gt sync

# 2. Create a new layer (one branch per reviewable concern)
gt create feat/<topic>-0-<layer>
# ... edit, commit, repeat ...
gt create feat/<topic>-1-<layer>
# ... etc

# 3. Open the whole stack as PRs
gt submit --stack

# 4. When a layer is approved, fold down and refresh
gt restack
gt submit --stack

# 5. After all layers approved, merge top-down
gt merge            # or use the GitHub UI
```

## What stays in this session

- The 12 commits currently on `feat/studio-workflows-integration`
  become the new repo's `main` (steps 3–4).
- The 3 commits on the old fork's `main` are preserved as
  `legacy-fork-main` (step 5). Read them, decide if any of that
  work should be ported into the new `main` later.
- The `revamp-frontend-design` branch is preserved (step 6).

## Why I swapped the remote differently than your original 3 commands

Your original sequence:

```bash
git remote add origin https://github.com/mayureshh27/Practice-Workspace.git
```

This would fail with `fatal: remote origin already exists.` because
`origin` is already pointing at the old fork. The fix is the
`git remote remove origin` line in step 2, then `git remote add
origin ...`.
