# Compact Tool UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 `hot-update/assets/app.css` 收紧为高密度冷灰工具风（DOM/JS/数据零改动），重点压账号运营中心与 AI 内容运营中心。

**Architecture:** 纯 CSS 改版。先改 `:root` token（圆角/阴影/状态色饱和度），再逐组件下调字号与间距，最后对装饰件（渐变、投影、模拟浏览器窗体、信息流卡片）做视觉弱化。全部为对现有规则的值替换，不新增选择器、不改 HTML。

**Tech Stack:** 纯 CSS；验证用 PowerShell `Select-String` 断言 + 用户在预览服务目检。

**设计依据:** `docs/plans/2026-09-29-compact-tool-ui-design.md`（已确认）

**目标文件:** `hot-update/assets/app.css`（651 行，唯一改动文件）

---

### Task 1: Token 层 —— 圆角 / 阴影 / 状态色 / 去渐变

**Files:**
- Modify: `hot-update/assets/app.css:1-47`（:root）、`289-294`（btn.primary 渐变）、`365-368`（头像渐变）、`430-432`（pmplay 渐变）

**Step 1: 改 :root token（逐条精确替换）**

| old_string | new_string |
|---|---|
| `--success: oklch(0.56 0.125 155);` | `--success: oklch(0.58 0.085 155);` |
| `--success-ink: oklch(0.44 0.11 155);` | `--success-ink: oklch(0.47 0.075 155);` |
| `--warn: oklch(0.655 0.135 70);` | `--warn: oklch(0.66 0.09 70);` |
| `--warn-ink: oklch(0.50 0.11 70);` | `--warn-ink: oklch(0.52 0.075 70);` |
| `--danger: oklch(0.55 0.19 27);` | `--danger: oklch(0.56 0.13 27);` |
| `--danger-ink: oklch(0.46 0.16 27);` | `--danger-ink: oklch(0.48 0.11 27);` |
| `--radius: 7px;` | `--radius: 4px;` |
| `--radius-sm: 5px;` | `--radius-sm: 3px;` |
| `--shadow-2: 0 4px 14px oklch(0.23 0.02 255 / 0.09);` | `--shadow-2: 0 1px 4px oklch(0.23 0.02 255 / 0.07);` |
| `--shadow-pop: 0 14px 38px oklch(0.23 0.02 255 / 0.20), 0 2px 8px oklch(0.23 0.02 255 / 0.08);` | `--shadow-pop: 0 3px 12px oklch(0.23 0.02 255 / 0.12), 0 1px 3px oklch(0.23 0.02 255 / 0.06);` |

**Step 2: 去渐变（主按钮 / 播放按钮 / 头像，纯色工具风）**

btn.primary（约 289-294 行）：

```css
/* old */
.btn.primary {
  background: linear-gradient(180deg, color-mix(in oklch, var(--accent) 92%, white), var(--accent));
  border-color: var(--accent-ink); color: #fff; font-weight: 550;
  box-shadow: 0 1px 2px oklch(0.4 0.13 252 / 0.32), inset 0 1px 0 oklch(1 0 0 / 0.16);
}
.btn.primary:hover { background: linear-gradient(180deg, var(--accent), var(--accent-hover)); }
/* new */
.btn.primary { background: var(--accent); border-color: var(--accent-ink); color: #fff; font-weight: 550; }
.btn.primary:hover { background: var(--accent-hover); }
```

pmplay（约 430-432 行）：

```css
/* old */
.pmplay { ... border: 1px solid var(--accent-ink); background: linear-gradient(180deg, color-mix(in oklch, var(--accent) 92%, white), var(--accent)); ... }
.pmplay:hover { background: linear-gradient(180deg, var(--accent), var(--accent-hover)); }
/* new */
.pmplay { ... border: 1px solid var(--accent-ink); background: var(--accent); ... }   /* 其余属性不动 */
.pmplay:hover { background: var(--accent-hover); }
```

头像 a1–a4（365-368 行，渐变改纯色、降饱和）：

```css
/* new */
.avatar.a1 { background: oklch(0.55 0.11 252); }
.avatar.a2 { background: oklch(0.59 0.08 195); }
.avatar.a3 { background: oklch(0.65 0.09 75); }
.avatar.a4 { background: oklch(0.57 0.08 155); }
```

**Step 3: 验证**

```powershell
Select-String -Path hot-update\assets\app.css -Pattern '--radius: 4px','--radius-sm: 3px','linear-gradient\(145deg' 
```
Expected: 前两个必须命中；`linear-gradient(145deg`（头像）必须 0 命中。全文 `linear-gradient` 仅允许出现在 `.ph-img` 条纹占位与 `.phone-video`（旧块，未触达）中。

**Step 4: Commit**

```bash
git add hot-update/assets/app.css
git commit -m "style(proto): token 层收紧——圆角4px/弱投影/状态色降饱和/去渐变"
```

---

### Task 2: 全局骨架与控件密度

**Files:**
- Modify: `hot-update/assets/app.css` — rail（66-109）、toolbar（111-144）、btn/input/cchip/recdev（281-316、470、557）

**Step 1: 精确替换（old → new）**

| 行 | old_string | new_string |
|---|---|---|
| 68 | `grid-template-columns: 56px minmax(0, 1fr);` | `grid-template-columns: 48px minmax(0, 1fr);` |
| 111 | `.content { grid-column: 2; grid-row: 2; display: grid; grid-template-rows: 46px minmax(0, 1fr); min-height: 0; }` | `.content { grid-column: 2; grid-row: 2; display: grid; grid-template-rows: 40px minmax(0, 1fr); min-height: 0; }` |
| 94 | `position: relative; width: 38px; height: 38px; border: 0; border-radius: 9px; background: transparent;` | `position: relative; width: 34px; height: 34px; border: 0; border-radius: 6px; background: transparent;` |
| 98 | `.railbtn svg { width: 19px; height: 19px; }` | `.railbtn svg { width: 18px; height: 18px; }` |
| 102 | `position: absolute; left: 47px; top: 50%;` | `position: absolute; left: 41px; top: 50%;` |
| 109 | `.railacct .avatar { width: 26px; height: 26px; border-radius: 7px; font-size: 11px; }` | `.railacct .avatar { width: 24px; height: 24px; border-radius: 5px; font-size: 11px; }` |
| 121 | `.mtab { position: relative; height: 100%; padding: 0 15px; ... font-size: 13px; ...}` | `padding: 0 12px;` 且 `font-size: 12.5px;`（其余不动） |
| 282 | `gap: 6px; height: 32px; padding: 0 13px; border-radius: 7px;` | `gap: 6px; height: 29px; padding: 0 11px; border-radius: var(--radius-sm);` |
| 297 | `.btn.sm { height: 27px; padding: 0 10px; font-size: 12px; }` | `.btn.sm { height: 24px; padding: 0 9px; font-size: 11.5px; }` |
| 301 | `.btn.lg { height: 38px; padding: 0 18px; font-size: 13.5px; }` | `.btn.lg { height: 34px; padding: 0 15px; font-size: 12.5px; }` |
| 308 | `width: 100%; height: 31px; padding: 0 9px; border: 1px solid var(--border); border-radius: 7px;` | `width: 100%; height: 28px; padding: 0 8px; border: 1px solid var(--border); border-radius: var(--radius-sm);` |
| 470 | `.cchip { ... height: 27px; padding: 0 12px; border-radius: 7px; font-size: 12px; ...}` | `height: 24px; padding: 0 10px; border-radius: var(--radius-sm); font-size: 11.5px;` |
| 557 | `.recdev { ... height: 34px; padding: 0 13px 0 11px; border-radius: 8px; ...}` | `height: 30px; padding: 0 11px 0 9px; border-radius: var(--radius-sm);` |
| 282(svg) | `.btn svg { width: 15px; height: 15px; }` | `.btn svg { width: 14px; height: 14px; }` |

**Step 2: 验证**

```powershell
Select-String -Path hot-update\assets\app.css -Pattern 'height: 32px; padding: 0 13px','grid-template-columns: 56px','height: 31px'
```
Expected: 全部 0 命中（旧值已消失）；`Select-String -Pattern 'height: 29px'` 命中 1 次。

**Step 3: Commit**

```bash
git add hot-update/assets/app.css
git commit -m "style(proto): 骨架与控件密度——窄轨/矮工具栏/按钮输入降高"
```

---

### Task 3: 区块排版与表格密度（六中心通用）

**Files:**
- Modify: `hot-update/assets/app.css:153-278`（列表/区块/表格）、`329-381`（浮层/状态栏）、`437-493`（生成结果区）、`240-258`（issue/bars）

**Step 1: 精确替换（old → new）**

| 行 | old_string | new_string |
|---|---|---|
| 153 | `.sidecap { ... padding: 15px 15px 8px; ...}` | `padding: 11px 11px 6px;` |
| 156 | `.list { flex: 1; overflow-y: auto; padding: 0 8px 12px; }` | `.list { flex: 1; overflow-y: auto; padding: 0 6px 8px; }` |
| 158 | `gap: 9px; width: 100%; text-align: left; padding: 9px 10px; border: 0; border-radius: 8px;` | `gap: 8px; width: 100%; text-align: left; padding: 6px 8px; border: 0; border-radius: 5px;` |
| 166 | `font-size: 12.5px; font-weight: 550; line-height: 1.45;` | `font-size: 12px; font-weight: 550; line-height: 1.4;` |
| 167 | `.item .it > span { display: block; font-size: 11px; color: var(--muted); margin-top: 3px; }` | `.item .it > span { display: block; font-size: 10.5px; color: var(--muted); margin-top: 2px; }` |
| 170 | `.sidefoot { border-top: 1px solid var(--border); padding: 11px 13px; background: var(--surface-2); }` | `.sidefoot { border-top: 1px solid var(--border); padding: 9px 10px; background: var(--surface-2); }` |
| 173 | `.sect { padding: 20px 26px; border-bottom: 1px solid var(--border); }` | `.sect { padding: 12px 16px; border-bottom: 1px solid var(--border); }` |
| 177 | `.whead .ht h1 { font-size: 19px; line-height: 1.35; letter-spacing: -0.018em; }` | `.whead .ht h1 { font-size: 15.5px; line-height: 1.35; letter-spacing: -0.014em; }` |
| 178 | `.sub { font-size: 12px; color: var(--muted); margin-top: 3px; }` | `.sub { font-size: 11.5px; color: var(--muted); margin-top: 2px; }` |
| 181 | `.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 11px; }` | `.chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }` |
| 182 | `.tag { ... height: 21px; padding: 0 8px; border-radius: 5px; font-size: 11.5px; ...}` | `.tag { ... height: 18px; padding: 0 7px; border-radius: 4px; font-size: 10.5px; ...}` |
| 183 | `.tag svg { width: 12px; height: 12px; flex: none; }` | `.tag svg { width: 11px; height: 11px; flex: none; }` |
| 191 | `.callout { display: flex; gap: 9px; padding: 11px 13px; border-radius: 8px; font-size: 12.5px; ...}` | `.callout { display: flex; gap: 8px; padding: 8px 11px; border-radius: 5px; font-size: 12px; ...}` |
| 192 | `.callout svg { width: 15px; height: 15px; flex: none; margin-top: 2px; }` | `.callout svg { width: 14px; height: 14px; flex: none; margin-top: 2px; }` |
| 200 | `.title-lg { font-size: 15.5px; ...}` | `.title-lg { font-size: 14px; ...}` |
| 202 | `.remind { display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; ...}` | `.remind { display: flex; gap: 10px; align-items: flex-start; padding: 9px 0; ...}` |
| 204 | `.remind .ricon { flex: none; width: 30px; height: 30px; border-radius: 8px; ...}` | `.remind .ricon { flex: none; width: 26px; height: 26px; border-radius: 5px; ...}` |
| 207 | `.remind .rx > b { display: block; font-size: 13px; font-weight: 600; }` | `.remind .rx > b { display: block; font-size: 12.5px; font-weight: 600; }` |
| 213 | `.matgrid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); gap: 28px; }` | `.matgrid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); gap: 20px; }` |
| 214 | `.matgrid .col-s { border-left: 1px solid var(--border); padding-left: 26px; }` | `.matgrid .col-s { border-left: 1px solid var(--border); padding-left: 18px; }` |
| 226 | `.metrics { display: flex; gap: 34px; flex-wrap: wrap; }` | `.metrics { display: flex; gap: 22px; flex-wrap: wrap; }` |
| 228 | `.metric .v { font-size: 21px; ...}` | `.metric .v { font-size: 16px; ...}` |
| 234 | `.hpill { ... height: 25px; padding: 0 10px; border-radius: 20px; ... font-size: 11.5px; ...}` | `.hpill { ... height: 21px; padding: 0 8px; border-radius: 20px; ... font-size: 11px; ...}` |
| 240 | `.issue { padding: 15px 0; border-bottom: 1px solid var(--border); }` | `.issue { padding: 10px 0; border-bottom: 1px solid var(--border); }` |
| 247 | `.issue .sug { font-size: 12px; line-height: 1.7; margin-top: 9px; padding: 9px 11px; border-radius: 7px; ...}` | `.issue .sug { font-size: 11.5px; line-height: 1.65; margin-top: 7px; padding: 7px 9px; border-radius: 4px; ...}` |
| 268 | `table.tb th { ... padding: 8px 14px; ...}` | `table.tb th { ... padding: 5px 10px; ...}` |
| 269 | `table.tb td { padding: 10px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; }` | `table.tb td { padding: 6px 10px; border-bottom: 1px solid var(--border); vertical-align: middle; }` |
| 437 | `.doc-title { font-size: 20px; line-height: 1.42; letter-spacing: -0.02em; font-weight: 600; }` | `.doc-title { font-size: 15.5px; line-height: 1.4; letter-spacing: -0.014em; font-weight: 600; }` |
| 438 | `.kicker { font-size: 11.5px; color: var(--muted); margin-bottom: 6px; ...}` | `.kicker { font-size: 11px; color: var(--muted); margin-bottom: 4px; ...}` |
| 443 | `.hook { ... padding: 12px 14px; border-radius: 8px; ... margin-bottom: 20px; }` | `.hook { ... padding: 9px 11px; border-radius: 5px; ... margin-bottom: 14px; }` |
| 445 | `.hook .t { font-size: 15px; ...}` | `.hook .t { font-size: 13.5px; ...}` |
| 447 | `.beat { display: flex; gap: 12px; padding: 7px 0; }` | `.beat { display: flex; gap: 10px; padding: 5px 0; }` |
| 451 | `.acts { display: flex; gap: 8px; margin-top: 18px; }` | `.acts { display: flex; gap: 8px; margin-top: 12px; }` |
| 452 | `.grp { ... margin: 20px 0 11px; padding-top: 15px; ...}` | `.grp { ... margin: 14px 0 8px; padding-top: 10px; ...}` |
| 454 | `.kv { margin-bottom: 13px; }` | `.kv { margin-bottom: 9px; }` |
| 476 | `.crow { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; ...}` | `.crow { display: flex; align-items: flex-start; gap: 10px; padding: 9px 0; ...}` |
| 496 | `.daily { max-width: 800px; margin: 0 auto; padding: 30px 26px 44px; }` | `.daily { max-width: 800px; margin: 0 auto; padding: 18px 20px 28px; }` |

浮层（329-381 行）：

| old_string | new_string |
|---|---|
| `.popover { position: fixed; z-index: 80; width: 336px; ... padding: 12px; ...}` | `width: 320px;` 且 `padding: 10px;` |
| `.popover .pi { font-size: 12px; padding: 7px 9px; ...}` | `.popover .pi { font-size: 11.5px; padding: 6px 8px; ...}` |
| `.sheet { width: 100%; max-width: 560px; background: var(--surface); border-radius: 11px; ...}` | `border-radius: 6px;` |
| `.sheet > header { padding: 14px 18px; ...}` | `padding: 10px 14px;` |
| `.sheet > header h3 { font-size: 14px; }` | `.sheet > header h3 { font-size: 13px; }` |
| `.sheet .sbody { padding: 0 18px 14px; overflow-y: auto; }` | `.sheet .sbody { padding: 0 14px 12px; overflow-y: auto; }` |
| `.sheet .group { padding: 15px 0 4px; }` | `.sheet .group { padding: 11px 0 3px; }` |
| `.sheet .srow { display: flex; align-items: center; gap: 14px; padding: 11px 0; ...}` | `gap: 12px; padding: 8px 0;` |
| `.sheet > footer { padding: 12px 18px; ... border-radius: 0 0 11px 11px; }` | `padding: 10px 14px;` 且 `border-radius: 0 0 6px 6px;` |

**Step 2: 验证（密度硬指标）**

```powershell
Select-String -Path hot-update\assets\app.css -Pattern 'padding: 12px 16px','font-size: 15.5px','height: 18px; padding: 0 7px','padding: 5px 10px','padding: 6px 10px'
```
Expected: 各命中 ≥1；再跑 `Select-String -Pattern 'padding: 20px 26px','font-size: 21px','padding: 10px 14px'` → 0 命中。

**Step 3: Commit**

```bash
git add hot-update/assets/app.css
git commit -m "style(proto): 区块/表格/浮层密度收紧，标题降为小节级"
```

---

### Task 4: 主页与每日推荐紧凑化

**Files:**
- Modify: `hot-update/assets/app.css:496-519`（daily/dc-*）、`580-595`（opgrid/opcard）

**Step 1: 精确替换（old → new）**

| old_string | new_string |
|---|---|
| `.daily-head { ... gap: 18px; margin-bottom: 18px; }` | `gap: 14px; margin-bottom: 12px;` |
| `.daily-head h1 { font-size: 25px; letter-spacing: -0.028em; line-height: 1.3; }` | `.daily-head h1 { font-size: 17px; letter-spacing: -0.018em; line-height: 1.3; }` |
| `.dcard { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 2px 10px oklch(0.23 0.02 255 / 0.06); overflow: hidden; }` | `.dcard { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }` |
| `.dc-top { display: flex; align-items: center; gap: 12px; padding: 15px 24px; }` | `.dc-top { display: flex; align-items: center; gap: 10px; padding: 9px 14px; }` |
| `.dc-k { flex: 1; font-size: 15px; ...}` | `.dc-k { flex: 1; font-size: 12.5px; ...}` |
| `.dc-body { padding: 22px 24px 18px; border-top: 1px solid var(--border); }` | `.dc-body { padding: 13px 14px 12px; border-top: 1px solid var(--border); }` |
| `.dc-title { font-size: 23px; ... margin-top: 9px; }` | `.dc-title { font-size: 16px; ... margin-top: 6px; }` |
| `.dc-sub { font-size: 12.5px; ... margin-top: 11px; ...}` | `.dc-sub { font-size: 12px; ... margin-top: 8px; ...}` |
| `.dc-hook { margin-top: 20px; padding-left: 15px; border-left: 2px solid var(--accent); }` | `.dc-hook { margin-top: 12px; padding-left: 10px; border-left: 2px solid var(--accent); }` |
| `.dc-hook > p { font-size: 17px; ...}` | `.dc-hook > p { font-size: 13.5px; ...}` |
| `.dc-say { position: relative; margin-top: 20px; padding: 17px 20px; border-radius: 9px; ...}` | `.dc-say { position: relative; margin-top: 12px; padding: 10px 13px; border-radius: 4px; ...}` |
| `.dc-say > p { font-size: 14.5px; line-height: 1.9; ...}` | `.dc-say > p { font-size: 12.5px; line-height: 1.8; ...}` |
| `.dc-foot { ... margin-top: 18px; font-size: 11.5px; ...}` | `.dc-foot { ... margin-top: 12px; font-size: 11px; ...}` |
| `.daily-more { text-align: center; margin-top: 24px; }` | `.daily-more { text-align: center; margin-top: 14px; }` |
| `.opgrid { ... gap: 12px; margin-top: 14px; }` | `.opgrid { ... gap: 8px; margin-top: 10px; }` |
| `.opcard { display: flex; flex-direction: column; gap: 10px; padding: 14px; border: 1px solid var(--border); border-radius: 10px; ...}` | `.opcard { display: flex; flex-direction: column; gap: 7px; padding: 10px; border: 1px solid var(--border); border-radius: 5px; ...}` |
| `.opic { flex: none; width: 30px; height: 30px; border-radius: 8px; ...}` | `.opic { flex: none; width: 26px; height: 26px; border-radius: 5px; ...}` |

**Step 2: 验证**

```powershell
Select-String -Path hot-update\assets\app.css -Pattern 'border-radius: 12px; box-shadow','font-size: 25px','font-size: 23px'
```
Expected: 0 命中。

**Step 3: Commit**

```bash
git add hot-update/assets/app.css
git commit -m "style(proto): 主页运营启动与每日推荐卡片紧凑化去投影"
```

---

### Task 5: 两个重点中心 —— 养号 / 采集工作台 / 评论页

**Files:**
- Modify: `hot-update/assets/app.css:521-551`（养号）、`605-639`（采集工作台，含 554 压缩行共享规则）、`641-651`（评论页）

**Step 1: 养号页（bw-* / vcard / runstat）**

| old_string | new_string |
|---|---|
| `.nsplit { display: grid; grid-template-columns: minmax(0,0.85fr) minmax(0,1.5fr); gap: 26px; align-items: start; }` | `gap: 16px;` |
| `.browse { border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); overflow: hidden; }` | `border-radius: 5px;` |
| `.bw-bar { display: flex; align-items: center; gap: 10px; padding: 10px 12px; ...}` | `gap: 8px; padding: 6px 9px;` |
| `.bw-url { flex: 1; min-width: 0; height: 26px; ... border-radius: 6px; ... font-size: 11.5px; ...}` | `height: 22px;` `border-radius: 4px;` `font-size: 10.5px;` |
| `.bw-feed { padding: 12px; display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }` | `.bw-feed { padding: 8px; display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }` |
| `.vcard { border: 1px solid var(--border); border-radius: 9px; background: var(--surface); overflow: hidden; }` | `border-radius: 4px;` |
| `.vthumb svg { width: 26px; height: 26px; opacity: .5; }` | `.vthumb svg { width: 20px; height: 20px; opacity: .45; }` |
| `.vmeta { padding: 9px 10px 11px; }` | `.vmeta { padding: 6px 8px 8px; }` |
| `.vhit { display: inline-block; margin-top: 7px; font-size: 10.5px; ... padding: 2px 7px; }` | `margin-top: 5px; font-size: 10px;` `padding: 1px 5px;` |
| `.runstat { border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); padding: 16px 18px; }` | `border-radius: 5px;` `padding: 10px 12px;` |
| `.runstat .big { font-size: 18px; ...}` | `.runstat .big { font-size: 14px; ...}` |

（`.bw-dots` 已是中性灰 `var(--border-strong)`，不动。）

**Step 2: 采集工作台（connected-* / collector-right / 554 行共享头）**

| old_string | new_string |
|---|---|
| `.connected-page { flex: 0 0 var(--collector-left); min-width: 320px; display: flex; flex-direction: column; overflow: hidden; background: #f3f5f7; }` | `background: var(--surface-2);` |
| `.connected-bar { height: 42px; ...}` | `height: 32px;` |
| `.connected-canvas { flex: 1; display: grid; place-items: center; padding: 28px; background: radial-gradient(circle at 50% 35%, oklch(0.98 .012 235), transparent 48%), #eef1f4; }` | `.connected-canvas { flex: 1; display: grid; place-items: center; padding: 16px; background: var(--surface-2); }` |
| `.connected-empty b { font-size: 14px; font-weight: 600; }` | `.connected-empty b { font-size: 12.5px; font-weight: 600; }` |
| `.connected-mark { width: 46px; height: 46px; ... border-radius: 12px; ... box-shadow: 0 6px 16px oklch(0.2 .02 250 / .06); }` | `width: 36px; height: 36px;` `border-radius: 6px;` 删除 box-shadow 声明 |
| `.collector-right { min-width: 390px; flex: 1 1 0; display: flex; flex-direction: column; overflow: hidden; padding: 12px; gap: 12px; background: var(--surface); }` | `padding: 8px; gap: 8px;` |
| `.collection-config { display: grid; grid-template-columns: minmax(235px, .9fr) minmax(290px, 1.1fr); min-height: 258px; }` | `min-height: 200px;` |
| `.collector-right .watch-list { display: block; max-height: 164px; padding: 6px; }` | `max-height: 140px; padding: 4px;` |
| `.account-add { display: flex; gap: 7px; padding: 8px 10px; border-bottom: 1px solid var(--border); }` | `gap: 6px; padding: 6px 8px;` |
| `.account-add input { min-width: 0; flex: 1; height: 30px; ...}` | `height: 26px;` |
| 554 行（压缩块，字面量子串替换） | `.cp-bar,.ca-head,.result-head{display:flex;align-items:center;gap:9px;min-height:42px;padding:0 13px;` → `.cp-bar,.ca-head,.result-head{display:flex;align-items:center;gap:8px;min-height:32px;padding:0 10px;` |
| `.collector-right .result-head { min-height: 40px; }` | `.collector-right .result-head { min-height: 32px; }` |

（先 read 554 行全文确认字面量子串存在，再 edit。）

**Step 3: 评论页**

| old_string | new_string |
|---|---|
| `.comment-filterbar { display: flex; align-items: end; gap: 10px; padding: 14px 18px; ...}` | `gap: 8px; padding: 9px 12px;` |
| `.comment-filterbar select { width: 154px; height: 31px; ...}` | `width: 140px; height: 27px;` |
| `.comment-table { flex: 1; min-height: 0; overflow: auto; padding: 0 18px; }` | `padding: 0 12px;` |
| `.comment-count { flex: none; padding: 10px 18px 14px; ...}` | `padding: 7px 12px 9px;` |

**Step 4: 验证**

```powershell
Select-String -Path hot-update\assets\app.css -Pattern 'radial-gradient\(circle at 50% 35%','min-height:42px','height: 31px','background: #f3f5f7'
```
Expected: 全部 0 命中。

**Step 5: Commit**

```bash
git add hot-update/assets/app.css
git commit -m "style(proto): 养号/采集/评论三页去花哨并紧凑化"
```

---

### Task 6: 全量校验 + 用户目检

**Step 1: 旧值清零断言（全部必须 0 命中）**

```powershell
Select-String -Path hot-update\assets\app.css -Pattern '--radius: 7px','--radius-sm: 5px','padding: 20px 26px','font-size: 21px','height: 21px; padding: 0 8px','height: 32px','linear-gradient\(180deg','border-radius: 12px','border-radius: 11px','border-radius: 10px'
```
Expected: 0 命中（`height: 32px` 注意 .acctpick/.toolbtn 若已同步改为 28px 也应 0 命中；若 toolbtn 未在 Task 2 覆盖，此处补改 `.toolbtn { ... height: 32px; ...}` → `height: 28px;`、`.acctpick` 同理）。

**Step 2: CSS 语法完整性**

```powershell
$c = Get-Content hot-update\assets\app.css -Raw; ($c.ToCharArray() | Where-Object {$_ -eq '{'}).Count -eq ($c.ToCharArray() | Where-Object {$_ -eq '}'}).Count
```
Expected: `True`（花括号配平）。

**Step 3: 服务冒烟**

```powershell
curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:43999/assets/app.css
```
Expected: `200`（后台任务 pwsh-274 仍在运行）。

**Step 4: 用户目检**

请用户在 `http://127.0.0.1:43999/smartstore-desktop.html` 按 `Ctrl+R` 强刷，按顺序走查：主页 → 账号运营中心（采集/诊断/养号/管理）→ AI内容运营中心（推荐/口播/爆款）→ 矩阵 → 录音 → 驾驶舱 → 提词器与弹层。收集不满意项做微调。

**Step 5: 收尾提交（如有微调）+ 停服务**

```bash
git add hot-update/assets/app.css
git commit -m "style(proto): 目检微调"
```
`job_kill pwsh-274`（用户确认走查完成后）。

---

## 回退

单文件改动，`git revert` 或 `git checkout 6e2985f -- hot-update/assets/app.css` 即可整体回退。

---

## 执行记录（2026-09-29）

- Task 1–6 已全部执行完成，全部断言通过（花括号配平 557/557，旧值清零，服务 200）。
- **git 提交调整**：`hot-update/` 在 `.gitignore` 中（09-28 方案刻意置于仓库外），app.css 无法入 git。回退保障改为原始备份文件：`backup/app.css.original-2026-09-29.css`（由 `backup/make-backup.mjs` 从改后文件逆向还原生成）。
- 计划外的少量补充编辑（同属已确认的紧凑/去花哨范围）：`.vstep`/`.crow` 行距收紧、`.pick span`/`.numpair .in` 输入降高、`.collector-workbench` min-height 620→520、`.connected-empty` 文字转 muted、`.avatar.lg` 圆角 10→6、`.opic svg` 16→15、`.oph b` 13→12.5。
- 已知边界：HTML 内联样式（如主页「今天建议做这一条」的 `font-size:18px`）优先级高于 CSS，本次不改 DOM，故保留；如需一并收紧需另开任务改 HTML。
- 断言中 `height: 21px; padding: 0 8px`（旧 tag 值）与 hpill 新值相同、`padding: 10px 14px` 与 sheet header/footer 新值相同，均以带选择器前缀的更长字面量校验。
