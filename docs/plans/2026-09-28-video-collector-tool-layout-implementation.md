# Video Collector Tool Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the video collection screen into a compact, resizable two-pane desktop tool.

**Architecture:** Keep the feature entirely in the existing static application. Render a left connected-page placeholder and a right operational pane, then use a small pointer-driven splitter to persist the pane width for the current session. The right pane owns account scheduling and the results table.

**Tech Stack:** Static HTML, CSS, and vanilla browser JavaScript inside the Electron shell.

---

### Task 1: Render the tool-first collection layout

**Files:**
- Modify: `desktop-shell/static/smartstore-desktop.html:582-596`

**Step 1: Write the failing structural check**

Run: `node -e "const s=require('fs').readFileSync('desktop-shell/static/smartstore-desktop.html','utf8'); for(const x of ['collector-workbench','collector-splitter','连接页面']) if(!s.includes(x)) throw Error(x)"`

Expected: FAIL because the new tool-shell identifiers do not exist.

**Step 2: Implement the minimal view change**

Replace the title-heavy collection header and stacked grid with a left connected-page placeholder, a splitter, and a right pane. Keep account scheduling above the results and place immediate collection beneath the account area.

**Step 3: Run the structural check**

Run the Step 1 command.

Expected: exits successfully.

### Task 2: Add desktop-oriented two-pane styling

**Files:**
- Modify: `desktop-shell/static/assets/app.css:554`

**Step 1: Write the failing style check**

Run: `node -e "const s=require('fs').readFileSync('desktop-shell/static/assets/app.css','utf8'); for(const x of ['.collector-workbench','.collector-splitter','.connected-page']) if(!s.includes(x)) throw Error(x)"`

Expected: FAIL because the selector set does not exist.

**Step 2: Implement the minimal styles**

Use the full content height for the workbench, give the page viewer a neutral connected-browser placeholder, make the splitter visibly draggable, and make results use the remaining right-pane space without explanatory chrome.

**Step 3: Run the style check**

Run the Step 1 command.

Expected: exits successfully.

### Task 3: Wire and verify splitter behavior

**Files:**
- Modify: `desktop-shell/static/smartstore-desktop.html:1325-1637`

**Step 1: Write the failing behavior check**

Run: `node -e "const s=require('fs').readFileSync('desktop-shell/static/smartstore-desktop.html','utf8'); for(const x of ['collectorSplitter','pointerdown','setPointerCapture']) if(!s.includes(x)) throw Error(x)"`


Expected: FAIL because splitter behavior has not been added.

**Step 2: Implement the minimal event handling**

On the splitter pointer drag, update the left pane basis with safe minimum and maximum bounds. Do not add a persistence service or network behavior.

**Step 3: Verify the static application and package it**

Run: `npm run verify`

Expected: `Static prototype verified (3 files).`

Run the portable build and copy its resulting EXE to `E:\\BaiduSyncdisk\\lab\\60smartStore\\release\\AI智慧门店-原型.exe`.

**Step 4: Commit**

```bash
git add desktop-shell/static/smartstore-desktop.html desktop-shell/static/assets/app.css docs/plans/2026-09-28-video-collector-tool-layout-implementation.md
git commit -m "feat(collector): adopt resizable tool layout"
```
