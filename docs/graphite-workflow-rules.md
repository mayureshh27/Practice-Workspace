# Graphite Branch Stacking Workflow Guide for Agents

This document defines the rules and workflow guidelines for all AI agents committing, stacking, pushing, and submitting changes in this codebase using Graphite (`gt`).

## What is Branch Stacking?
Branch stacking is the practice of developing a series of small, dependent changes across multiple, incremental branches rather than grouping unrelated or semi-related changes into a single massive, monolithic pull request.

In this codebase, **every developer agent must use branch stacking** to keep code review loops fast, atomic, and clean.

---

## Graphite Flow vs. Traditional Git Flow

| Traditional Git Flow | Graphite Stack Flow (`gt`) | Why Stacking is Better for Agents |
| :--- | :--- | :--- |
| `git checkout -b feature` | `gt create branch_name -m "Message"` | Keeps changes separated logically and atomically. |
| Single massive PR | Stack of 2–5 sequential PRs | Reviewers can review small commits separately. Easy to merge and rebase. |
| Rebase manually (`git rebase`) | `gt sync` or `gt upstack` / `gt downstack` | Automatic recursive rebasing across dependent branches. |
| `git push origin feature` | `gt submit --stack` | Submits the entire stack to GitHub as multiple dependent draft/ready PRs. |



---

## CLI Power Features for Agents

### 1. Git Passthrough
The Graphite CLI is fully backward-compatible with Git. If you run a standard Git command with the `gt` prefix, Graphite will seamlessly pass it through to underlying Git executable:
* `gt status` -> passes through to `git status`
* `gt diff` -> passes through to `git diff`
* `gt add .` -> passes through to `git add .`

### 2. Shorthand Command Aliases
To speed up agentic interactions, Graphite supports built-in shorthand aliases for all major commands. Developer agents should feel free to utilize these aliases:

| Standard Command | Shorthand Alias | Purpose |
| :--- | :--- | :--- |
| `gt create` | `gt c` | Create a new stacked branch & commit staged changes |
| `gt modify` | `gt m` | Amend current commit & restack children |
| `gt submit` | `gt s` | Push current branch/stack and create/update PRs |
| `gt log` | `gt l` | Show the stack visualization |
| `gt checkout` | `gt co` | Interactive branch/stack switcher |
| `gt sync` | `gt repo sync` | Fetch trunk, rebase stack, prune merged |

---

## Core Graphite Commands for Agents


### 1. Creating & Tracking Changes
* **Create a new stacked branch** (stages changes, creates branch, and commits):
  ```bash
  gt create <branch-name> -m "Commit message"
  ```
  *Tip: Use `gt create --all -m "Message"` (or `-a`) to stage all untracked/modified files and commit in one go.*
* **Log the branch stack** (displays a visual tree representation of your stacked branches relative to `main`):
  ```bash
  gt log --stack
  ```
* **List stack branches** (gives a clean, concise list view of your current stack):
  ```bash
  gt ls
  ```

### 2. Modifying & Editing Stacks
* **Modify the current commit/branch** (stages all edits and amends the current stacked branch, automatically restacking all descendent branches upstack):
  ```bash
  gt modify --all
  ```
  *(or `gt modify -m "new message"` to change the commit message)*
* **Fold branch** (merges/collapses the current branch into its parent branch downstack):
  ```bash
  gt fold
  ```
* **Squash commits** (squashes all commits in the current branch down to a single clean commit):
  ```bash
  gt squash
  ```
* **Rename branch** (renames the current branch in the stack cleanly):
  ```bash
  gt rename <new-branch-name>
  ```

### 3. Navigating the Stack
* **Checkout a specific branch** (stack-aware branch switching):
  ```bash
  gt checkout <branch-name>
  ```
* **Move up/down the stack** by one branch:
  ```bash
  gt up
  gt down
  ```
* **Jump to top/bottom of stack**:
  ```bash
  gt top
  gt bottom
  ```

### 4. Syncing & Conflict Resolution
* **Sync and restack** (fetches latest changes from `main` or trunk, rebases your entire local stack, and automatically cleans up/deletes merged branches):
  ```bash
  gt sync
  ```
* **Continue execution** (resumes a stack operation—such as a rebase or sync—after you have manually resolved merge conflicts):
  ```bash
  gt continue
  ```

### 5. Pushing & Submitting PRs
* **Submit the entire stack** (pushes all branches in the current stack and creates or updates their corresponding PRs on GitHub in one interactive or non-interactive flow):
  ```bash
  gt submit --stack
  ```
* **Submit current branch only**:
  ```bash
  gt submit
  ```

### 6. Cleaning Up
* **Delete branch** (deletes the branch locally; prompts if unmerged unless `--force` is passed):
  ```bash
  gt delete
  ```

---

## Hard Rules for Agents working on this Codebase

1. **Keep Changes Atomic**: Never combine frontend changes and backend api changes in a single branch if they can be stacked. Implement the backend api first in `branch_1`, then create `branch_2` stacked on top of `branch_1` to add the frontend search interface.
2. **Commit Often**: Use descriptive commit messages. Ensure each commit maps perfectly to an incremental addition/change in the stack.
3. **Submit as Stacks**: Always run `gt submit --stack` to push all dependent branches in one command.
4. **Prune Cleanly**: Once branches are merged or closed, prune local branches using `gt delete`.
5. **Handle Conflicts Proactively**: If a `gt sync` or `gt modify` prompts a conflict, resolve it in the files, stage them, and run `gt continue` immediately to let Graphite restack the rest of your branches cleanly.

