# Portable Electron Shell Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Package the approved static AI Smart Store prototype as an offline Windows portable EXE.

**Architecture:** Copy the approved HTML and its assets into `desktop-shell/static`. Electron loads this directory in development and the packaged resources directory in production. electron-builder creates the single executable from the shell.

**Tech Stack:** Electron, electron-builder, Node.js.

---

### Task 1: Add a standalone Electron shell

**Files:**
- Create: `desktop-shell/package.json`
- Create: `desktop-shell/main.cjs`
- Create: `desktop-shell/static/smartstore-desktop.html`
- Create: `desktop-shell/static/assets/app.css`
- Create: `desktop-shell/static/assets/data.js`

**Step 1: Copy approved static files**

Copy the supplied HTML and its sibling `assets/` files into `desktop-shell/static/` without changing their contents.

**Step 2: Add the Electron main process**

Create a 1440×900 window with no menu bar, secure web preferences, external-link handling, and a packaged-resource path resolver.

**Step 3: Add package configuration**

Define `start`, `verify`, and `package` scripts. Configure electron-builder portable Windows target, application name `AI智慧门店-原型`, and extra resource copying for `static/`.

**Step 4: Verify source layout**

Run: `npm run verify` in `desktop-shell/`.

Expected: verifies that the HTML and both static assets exist.

### Task 2: Build and verify the portable release

**Files:**
- Generated: `desktop-shell/release/AI智慧门店-原型.exe`

**Step 1: Install dependencies with project-local cache**

Run: `npm install` with `npm_config_cache` set to `desktop-shell/.npm-cache`.

**Step 2: Produce the portable executable**

Run: `npm run package` in `desktop-shell/`.

Expected: electron-builder reports a completed portable Windows build.

**Step 3: Verify output**

Confirm the EXE exists and has a nonzero size. Launch once only if the runtime is locally available and inspect that the prototype window appears.

**Step 4: Commit source only**

Add `desktop-shell/` source and lockfile; ignore dependency caches and release artifacts. Commit with `feat(desktop): package static prototype as portable app`.
