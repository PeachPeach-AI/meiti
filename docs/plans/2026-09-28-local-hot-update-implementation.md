# Local Hot Update Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the one portable EXE load local development resources without requiring another EXE for static UI changes.

**Architecture:** The Electron main process resolves a fixed developer resource directory before the packaged resource directory. Static resources are copied to that directory once; reloading the BrowserWindow reads its latest saved files.

**Tech Stack:** Electron main process, static HTML/CSS/JavaScript resources, PowerShell copy operation.

---

### Task 1: Add a safe local-resource resolver

**Files:**
- Modify: `desktop-shell/main.cjs`

**Step 1: Write a failing source check**

Run: `node -e "const s=require('fs').readFileSync('main.cjs','utf8'); if(!s.includes('hot-update')) throw Error('local update directory missing')"`

Expected: FAIL.

**Step 2: Resolve the fixed local directory first, then use packaged static resources as fallback.**

**Step 3: Run the source check and `npm run verify`.**

Expected: both commands succeed.

### Task 2: Seed and verify local resources

**Files:**
- Create outside the repository: `E:\\BaiduSyncdisk\\lab\\60smartStore\\hot-update\\smartstore-desktop.html`
- Create outside the repository: `E:\\BaiduSyncdisk\\lab\\60smartStore\\hot-update\\assets\\app.css`
- Create outside the repository: `E:\\BaiduSyncdisk\\lab\\60smartStore\\hot-update\\assets\\data.js`

**Step 1: Copy the three current static resources to the local hot-update directory.**

**Step 2: Verify the files exist and the HTML references the local assets.**

### Task 3: Produce the single canonical program

**Files:**
- Modify: `.gitignore` if a temporary build folder is used.

**Step 1: Build the portable EXE and run its static verification.**

**Step 2: Replace only `E:\\BaiduSyncdisk\\lab\\60smartStore\\release\\AI智慧门店-原型.exe`.**

**Step 3: Commit source and documentation.**
