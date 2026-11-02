# Comment Collection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add operational filters and the requested seven comment collection fields to the static prototype.

**Architecture:** Enrich the existing comment samples with presentation-only metadata. Use state-backed select controls to filter the already-loaded array during rendering; no external collection service is introduced.

**Tech Stack:** Static HTML, CSS, and vanilla JavaScript in the Electron shell.

---

### Task 1: Enrich prototype comment data

**Files:**
- Modify: `desktop-shell/static/assets/data.js:420-429`

**Step 1: Write the failing check**

Run: `node -e "const s=require('fs').readFileSync('static/assets/data.js','utf8'); for(const x of ['region:', 'douyinId:', 'aiJudge:']) if(!s.includes(x)) throw Error(x)"`

Expected: FAIL.

**Step 2: Add region, Douyin identifier, and AI judge labels to every sample comment.**

**Step 3: Run the check and expect success.**

### Task 2: Render compact filters and result fields

**Files:**
- Modify: `desktop-shell/static/smartstore-desktop.html:165,599-611,1325-1637`
- Modify: `desktop-shell/static/assets/app.css`

**Step 1: Write a failing structural check**

Run: `node -e "const s=require('fs').readFileSync('static/smartstore-desktop.html','utf8'); for(const x of ['commentAccountFilter','commentTimeFilter','commentRegionFilter','AI判定','抖音号']) if(!s.includes(x)) throw Error(x)"`

Expected: FAIL.

**Step 2: Implement a single filter row and the seven-field table. Bind each select to state and re-render.**

**Step 3: Run the structural check and `npm run verify`.**

Expected: both commands succeed.

### Task 3: Package and commit

**Files:**
- Modify: `.gitignore` only if a temporary release folder is required.

**Step 1: Compile the inline application script and build a portable Windows executable.**

**Step 2: Copy the new executable to the release folder under a new filename if the current one is in use.**

**Step 3: Commit source, documentation, and ignore rule.**
