# Content Workbench Home Prototype Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a runnable desktop-style homepage prototype that helps store clerks start creating a marketing video from a recommended topic.

**Architecture:** Use a small Vite + React + TypeScript renderer in `dashboard/`. Keep all demo content in a local typed data module and use component state only for navigation and prototype feedback. Do not add Electron, APIs, persistence, or external AI calls in this prototype slice.

**Tech Stack:** React, TypeScript, Vite, CSS.

---

### Task 1: Create a minimal runnable prototype shell

**Files:**
- Create: `dashboard/package.json`
- Create: `dashboard/index.html`
- Create: `dashboard/tsconfig.json`
- Create: `dashboard/vite.config.ts`
- Create: `dashboard/src/main.tsx`
- Create: `dashboard/src/styles.css`

**Step 1: Add a failing build check**

Run: `npm run build` from `dashboard/`.

Expected: FAIL because the prototype package does not exist.

**Step 2: Create the package and renderer entry point**

Add a private Vite package with `dev`, `build`, and `typecheck` scripts. Mount React into `#root` and import the global style sheet.

**Step 3: Add an empty app render**

Create the React root with a minimal `App` component that renders `AI智慧门店`.

**Step 4: Verify the build**

Run: `npm run build` from `dashboard/`.

Expected: PASS and emit `dashboard/dist/`.

**Step 5: Commit**

Run: `git add dashboard && git commit -m "chore(prototype): scaffold homepage renderer"`.

### Task 2: Implement the content-workbench homepage

**Files:**
- Create: `dashboard/src/App.tsx`
- Create: `dashboard/src/data/demo.ts`
- Modify: `dashboard/src/styles.css`

**Step 1: Add a failing visual acceptance checklist**

Document these required visible regions in comments near `App`: six-item navigation, greeting, primary recommended-topic card, quick actions, pending content, reusable materials, and account summary.

**Step 2: Build typed demo content**

Define typed local data for the recommended topic, pending content, assets, and account indicators. Use Chinese labels that reflect realistic telecom-store marketing work.

**Step 3: Implement the component hierarchy**

Render a fixed desktop navigation rail, content header, large today-recommendation card, and lower supporting panels. Make the selected navigation item stateful; non-home pages can show a compact “原型建设中” state.

**Step 4: Add prototype interactions**

Make the topic selector rotate between three demo topics. Clicking “生成口播稿” opens an in-page generated-script panel. Quick-action buttons show a small status message.

**Step 5: Apply the visual system**

Add CSS variables for graphite, warm paper, orange action, green status, and muted ink. Use responsive grid layout with a desktop-first minimum canvas, restrained shadows, and focus/hover states.

**Step 6: Verify manually and build**

Run: `npm run build` from `dashboard/`.

Expected: PASS. Open the local preview and confirm all required regions are present and each key action changes visible state.

**Step 7: Commit**

Run: `git add dashboard && git commit -m "feat(prototype): add content workbench homepage"`.

### Task 3: Final quality pass

**Files:**
- Modify: `dashboard/src/App.tsx`
- Modify: `dashboard/src/styles.css`

**Step 1: Check desktop readability**

Verify at 1440×900 that the primary action remains above the fold and support panels do not compete with the recommended topic.

**Step 2: Check interaction states**

Verify navigation selection, topic cycling, script generation, and quick-action feedback each visibly update without a page reload.

**Step 3: Run type and production checks**

Run: `npm run typecheck && npm run build` from `dashboard/`.

Expected: both commands PASS.

**Step 4: Commit**

Run: `git add dashboard && git commit -m "fix(prototype): refine homepage interaction states"`.
