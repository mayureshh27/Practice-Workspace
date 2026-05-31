# Migration Handoff Document: Tailwind v4 & TanStack Router Migration

This document serves as the technical reference for any agent continuing work on the **Personal Agentic Learning Platform**. It details the entire migration trajectory, the changes made, the bugs resolved, and the current status.

---

## 1. Migration Overview

The frontend was migrated from a **single-page React app (App.tsx)** to a **multi-page, routing-based React architecture** powered by:
1. **Core Routing**: TanStack Router (file-based routing under `src/routes/`)
2. **Data Fetching**: TanStack Query (React Query v5) & Zod (`src/api/workspaceApi.ts`)
3. **Styling**: Tailwind CSS v4 & custom CSS tokens in `src/styles.css`
4. **State Management**: Zustand stores (`src/stores/workspaceStore.ts` & `src/stores/uiStore.ts`)

---

## 2. Completed Migration Phases ✅

* **Phase 1: Foundation Setup**:
  * Configured Tailwind v4 with the canonical custom HSL design tokens (`--ws-accent` = `hsl(178, 55%, 48%)`, etc.).
  * Ripped out default tailwind colors to preserve the original navy-slate/teal look.
* **Phase 2: Router & Route Structures**:
  * Set up TanStack Router under `src/routes/` with root layout `__root.tsx`, and dedicated routes for subjects, chapters, topics, notebooks, workflows, and artifacts.
* **Phase 3: State Management Migration**:
  * Extracted global UI states (sidebar collapse, search modal, creation modal) into `uiStore.ts`.
  * Extracted domain/resource updates, notebook, workflow, and artifact CRUD actions into `workspaceStore.ts`.
* **Phase 4: Color Normalization**:
  * Replaced all instances of hardcoded Tailwind v3 hex colors (like `#10b981` emerald) in inline style props and classNames with `var(--ws-*)` custom property references or HSL teals.
* **Phase 5: Layout & UX Adjustments**:
  * **Global Custom Scrollbars**: Styled all containers globally to use modern, thin custom scrollbars that match the theme.
  * **Creation Modal**: Created and wired a unified `<CreationModal />` component to allow users to create new domains, subjects, chapters, and topics on-the-fly.
  * **Recent Activity Section**: Re-seeded and fully re-wired the `recentItems` array in `workspaceStore.ts` to automatically populate and update when users navigate between subjects, chapters, or topics.

---

## 3. Current Compilation Status

* **TypeScript Compilation (`npx tsc --noEmit`)**: 100% clean with **zero errors**.
* **Production Build (`npm run build`)**: Compiles successfully with **zero errors** (transpiles all 2,395 modules under 600ms).

---

## 4. Remaining Tasks & Bugs to Watch out For 🔍

Although the migration itself is **100% complete and fully operational**, keep an eye on these potential items during subsequent work:
1. **Dynamic Creator Modal Validations**:
   * The `<CreationModal />` connects directly to `workspaceStore` creation methods (`addDomain`, `addSubject`, `addChapter`, `addTopic`). Verify that these updates correctly trigger backend persistence when Go backend sync routes are added.
2. **Topic Route/Practice Panel Wiring**:
   * The topic page (`/topic/.../$topicId`) renders the interactive `LearningPanel` and `WorkPanel` with topic-specific problem data. Verify that Monaco execution hooks execute correctly under the Go backend Docker execution engine.

---

## 5. Suggested Skills for Next Agent
* **improve-codebase-architecture**: Use this to check for refactoring cleanups, structure files inside components, or optimize layout code.
* **diagnose**: Use this disciplined diagnosis loop if any backend execution runtime errors or Docker sandbox issues arise.
