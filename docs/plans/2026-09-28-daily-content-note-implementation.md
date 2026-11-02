# Daily Content Note Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the management-style prototype homepage with a lightweight AI content-note experience for store clerks.

**Architecture:** Reuse the existing Vite renderer and local demo data. Replace only the visible homepage composition and CSS; keep navigation and prototype state local to the browser.

**Tech Stack:** React, TypeScript, Vite, CSS.

---

### Task 1: Replace the homepage information architecture

**Files:**
- Modify: `dashboard/src/App.tsx`
- Modify: `dashboard/src/data/demo.ts`

**Step 1: Remove management-oriented content regions**

Remove the dashboard header, progress KPI, quick-action grid, pending-content list, materials list, and account health strip.

**Step 2: Create the daily content-note component**

Render one main note containing a recommended title, human reason, hook, and short ready-to-speak script.

**Step 3: Add light local interactions**

Provide three text-led actions: change topic, make it more conversational, and add store context. Each action visibly changes only the note content.

**Step 4: Verify build**

Run: `npm run typecheck && npm run build` from `dashboard/`.

Expected: both commands PASS.

### Task 2: Replace the visual system

**Files:**
- Modify: `dashboard/src/styles.css`

**Step 1: Simplify the navigation**

Use a narrow icon rail and replace module labels with short creative-tool labels.

**Step 2: Create the paper-note composition**

Use a warm desktop background, a generously spaced paper note, hand-written accent treatment, and a small source stamp. Do not use dashboard grids, statistic cards, or data tables.

**Step 3: Verify at desktop width**

Open the local preview at 1440×900. Confirm the central note and its primary script text dominate the first view.

**Step 4: Commit**

Run: `git add dashboard docs/plans && git commit -m "feat(prototype): redesign as daily content note"`.
