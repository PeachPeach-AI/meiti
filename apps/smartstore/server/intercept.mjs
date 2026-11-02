/* ============================================================
   自媒体工作站 · 截流引擎桥接（MediaCrawler 集成）
   - 以子进程方式调用 vendor/MediaCrawler（NON-COMMERCIAL LEARNING LICENSE 1.1）
   - 采集产物写入 <root>/intercept-data/<taskId>/<platform>/json/*.json
   - 线索识别复用 SSCore.leadFromComments（文本判定，不臆造联系方式）
   仅局部逻辑；零额外依赖。
   ============================================================ */
import { spawn } from 'node:child_process';
import os from 'node:os';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = path.resolve(SERVER_DIR, '..');
const MC_DIR = process.env.SS_MC_DIR ? path.resolve(process.env.SS_MC_DIR) : path.resolve(ROOT, '..', '..', 'vendor', 'MediaCrawler');
const VENV_PY = process.platform === 'win32' ? path.join('Scripts', 'python.exe') : path.join('bin', 'python');
const MC_PY = process.env.SS_MC_PY ? path.resolve(process.env.SS_MC_PY) : path.join(MC_DIR, '.venv', VENV_PY);
const DATA_ROOT = path.join(ROOT, 'intercept-data');

/* 平台白名单：MediaCrawler 仅支持 xhs/dy/ks/bili/wb/tieba/zhihu。
   「视频号」不在其支持范围，前端应标注为「暂不支持」。 */
const PLATFORMS = {
  douyin: { arg: 'dy', label: '抖音' },
  kuaishou: { arg: 'ks', label: '快手' },
  xiaohongshu: { arg: 'xhs', label: '小红书' }
};
const MODES = ['search', 'detail', 'creator'];

/* ---------- 登录/会话（先登录，后指定采集） ---------- */
const CDP_PORT = Number(process.env.SS_CDP_PORT || 9222);
/* 与「智能体模式(Easel)」共用登录态：用 Easel 的浏览器 profile 目录，
   在智能体模式登录一次，工具模式采集即可复用（反之亦然）。 */
const EASEL_PROFILES = process.env.SS_EASEL_PROFILES ? path.resolve(process.env.SS_EASEL_PROFILES) : path.join(os.homedir(), '.easel-browser-profiles');
const PLATFORM_PROFILE = { douyin: 'DouyinProfile', kuaishou: 'KuaishouProfile', xiaohongshu: 'XiaohongshuProfile' };
const profileDirFor = (platform) => path.join(EASEL_PROFILES, PLATFORM_PROFILE[platform] || 'ss-cdp');
const LOGIN_URL = {
  douyin: 'https://www.douyin.com/',
  kuaishou: 'https://www.kuaishou.com/',
  xiaohongshu: 'https://www.xiaohongshu.com/'
};
const BROWSER_CANDIDATES = [
  process.env.PROGRAMFILES && process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
  process.env['PROGRAMFILES(X86)'] && process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA && process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  process.env.PROGRAMFILES && process.env.PROGRAMFILES + '\\Microsoft\\Edge\\Application\\msedge.exe',
  process.env['PROGRAMFILES(X86)'] && process.env['PROGRAMFILES(X86)'] + '\\Microsoft\\Edge\\Application\\msedge.exe',
  process.env.LOCALAPPDATA && process.env.LOCALAPPDATA + '\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

const detectBrowser = () => BROWSER_CANDIDATES.filter((p) => existsSync(p))[0] || null;
const detectBrowsers = () => BROWSER_CANDIDATES.filter((p) => existsSync(p)).map((p) => ({ name: /edge/i.test(p) ? 'Edge' : 'Chrome', path: p }));

async function cdpAlive(port) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 800);
  try {
    const r = await fetch('http://127.0.0.1:' + port + '/json/version', { signal: ctl.signal });
    clearTimeout(t);
    return r.ok;
  } catch { clearTimeout(t); return false; }
}

export function createCrawler(Core) {
  const tasks = new Map();
  const engineState = { engine: process.env.SS_ENGINE === 'playwright' ? 'playwright' : 'cdp', setup: { running: false, ok: false, log: [], error: null } };

  function openLoginCdp(platform) {
    const exe = detectBrowser();
    if (!exe) return { error: '未检测到本机 Chrome / Edge，请先安装其一' };
    const pdir = profileDirFor(platform);
    mkdirSync(pdir, { recursive: true });
    const url = LOGIN_URL[platform] || 'about:blank';
    const args = ['--remote-debugging-port=' + CDP_PORT, '--remote-debugging-address=127.0.0.1',
      '--user-data-dir=' + pdir, '--no-first-run', '--no-default-browser-check', url];
    try { const c = spawn(exe, args, { detached: true, stdio: 'ignore' }); c.unref(); }
    catch (e) { return { error: '启动浏览器失败: ' + ((e && e.message) || e) }; }
    return { ok: true, browser: exe, url, profileDir: pdir };
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* 采集前自动确保「共用的登录浏览器」在运行（首次会自动打开窗口，可直接扫码登录） */
  async function ensureCdp(platform) {
    if (engineState.engine !== 'cdp') return '';
    if (await cdpAlive(CDP_PORT)) return '';
    const r = openLoginCdp(platform);
    if (r.error) return r.error;
    for (let i = 0; i < 20; i++) { await sleep(1000); if (await cdpAlive(CDP_PORT)) break; }
    if (!(await cdpAlive(CDP_PORT))) return '登录浏览器未就绪（调试端口 ' + CDP_PORT + '）';
    return '';
  }

  function startPlaywrightSetup() {
    if (engineState.setup.running) return;
    engineState.setup = { running: true, ok: false, log: [], error: null };
    const child = spawn(pythonExe(), ['-m', 'playwright', 'install', 'chromium'], {
      cwd: MC_DIR, env: {
        ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1', PYTHONUTF8: '1',
        /* 国内默认走 npmmirror 镜像，避免 cdn.playwright.dev 卡死；可用 SS_PW_HOST 覆盖 */
        PLAYWRIGHT_DOWNLOAD_HOST: process.env.SS_PW_HOST || 'https://cdn.npmmirror.com/binaries/playwright',
        PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT: '120000'
      }, windowsHide: true
    });
    const push = (b) => {
      for (const line of b.toString('utf8').split(/\r?\n/)) { const s = line.trim(); if (s) engineState.setup.log.push(s); }
      if (engineState.setup.log.length > 300) engineState.setup.log.splice(0, engineState.setup.log.length - 300);
    };
    child.stdout.on('data', push); child.stderr.on('data', push);
    child.on('error', (e) => { engineState.setup.running = false; engineState.setup.error = String((e && e.message) || e); });
    child.on('close', (code) => { engineState.setup.running = false; engineState.setup.ok = code === 0; if (code !== 0 && !engineState.setup.error) engineState.setup.error = 'playwright install exited ' + code; });
  }

  /* ---------- 任务持久化：采集记录跨重启保留 ---------- */
  const META = (t) => ({
    id: t.id, platform: t.platform, mode: t.mode, engine: t.engine || '',
    keywords: t.keywords, ids: t.ids, maxNotes: t.maxNotes, maxComments: t.maxComments,
    subComments: !!t.subComments,
    dir: t.dir, status: t.status, startedAt: t.startedAt, endedAt: t.endedAt,
    exitCode: t.exitCode, error: t.error
  });
  function writeMeta(t) { try { writeFileSync(path.join(t.dir, 'task.json'), JSON.stringify(META(t), null, 2)); } catch { /* ignore */ } }
  function loadHistory() {
    if (!existsSync(DATA_ROOT)) return;
    const PLAT_FROM_DIR = { douyin: 'douyin', kuaishou: 'kuaishou', xhs: 'xiaohongshu' };
    for (const name of readdirSync(DATA_ROOT)) {
      const dir = path.join(DATA_ROOT, name);
      const mf = path.join(dir, 'task.json');
      try {
        if (existsSync(mf)) {
          const m = JSON.parse(readFileSync(mf, 'utf8'));
          if (!m || !m.id || tasks.has(m.id)) continue;
          if (m.status === 'running' || m.status === 'starting') { m.status = 'stopped'; m.error = m.error || '采集进程随工作站退出而中断'; }
          m.log = []; m.loginWait = false; m.proc = null;
          tasks.set(m.id, m);
          continue;
        }
        /* 回填：老目录没有 task.json，按产物推断 */
        let subs; try { subs = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { continue; }
        const platDir = subs.find((s) => existsSync(path.join(dir, s, 'json')));
        if (!platDir) continue;
        let mode = 'search';
        try {
          const m0 = readdirSync(path.join(dir, platDir, 'json')).map((f) => String(f).split('_')[0]).filter(Boolean)[0];
          if (MODES.indexOf(m0) > -1) mode = m0;
        } catch { /* ignore */ }
        const mk = name.match(/^IT(\d+)/);
        const startedAt = mk ? new Date(Number(mk[1])).toISOString() : '';
        const t = {
          id: name, platform: PLAT_FROM_DIR[platDir] || platDir, mode, engine: 'cdp',
          keywords: '', ids: '', maxNotes: 0, maxComments: 0, dir,
          status: 'done', startedAt, endedAt: startedAt, exitCode: 0, error: null,
          log: [], loginWait: false, proc: null, backfilled: true
        };
        tasks.set(t.id, t);
      } catch { /* ignore */ }
    }
  }
  const taskCounts = (t) => {
    try { const n = normalize(t); const { leads } = leadsOf(t); return { comments: n.comments.length, works: n.works, leads: leads.length }; }
    catch { return { comments: 0, works: 0, leads: 0 }; }
  };
  loadHistory();

  /* ---------- 平台风控：并发 1 / 任务间隔 / 每日额度 / 命中冷却 ---------- */
  const RISK_FILE = path.join(DATA_ROOT, '_risk.json');
  const RISK_DEFAULTS = {
    maxConcurrent: 1, minGapMs: 15000, cooldownMs: 10 * 60 * 1000,
    dailyTaskCap: 30, dailyCommentCap: 20000,
    maxCommentsPerTask: 5000, maxNotesPerTask: 50, maxQueue: 5
  };
  const RISK_RE = /blocked|403|风控|账号异常|登录失效|滑块|Signature Not Found|Uifid Not Found|访问频繁|请求频繁|操作频繁/i;
  const RISK_IGNORE = /update_dy_aweme_comment|update.*comment|aweme comment|comment:/i;
  let riskState = { config: Object.assign({}, RISK_DEFAULTS), stats: {}, cooldown: {}, lastHit: null };
  try {
    if (existsSync(RISK_FILE)) {
      const j = JSON.parse(readFileSync(RISK_FILE, 'utf8'));
      riskState.config = Object.assign({}, RISK_DEFAULTS, j.config || {});
      riskState.stats = j.stats || {};
      riskState.cooldown = j.cooldown || {};
      riskState.lastHit = j.lastHit || null;
    }
  } catch { /* ignore */ }
  const queue = [];
  let activeTask = null;
  let lastEndedAt = 0;
  let pumpTimer = null;

  const saveRisk = () => { try { writeFileSync(RISK_FILE, JSON.stringify(riskState, null, 2)); } catch { /* ignore */ } };
  const dayKey = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
  function dayStats(platform) {
    const day = dayKey();
    if (!riskState.stats[day]) riskState.stats[day] = {};
    if (!riskState.stats[day][platform]) riskState.stats[day][platform] = { tasks: 0, comments: 0 };
    return riskState.stats[day][platform];
  }
  function pruneStats() {
    const keys = Object.keys(riskState.stats).sort();
    while (keys.length > 7) delete riskState.stats[keys.shift()];
  }
  function riskPublic() {
    const now = Date.now();
    const cooldown = {};
    for (const k in riskState.cooldown) {
      const ms = riskState.cooldown[k] - now;
      if (ms > 0) cooldown[k] = { until: riskState.cooldown[k], minutes: Math.ceil(ms / 60000) };
    }
    return {
      config: riskState.config,
      today: { date: dayKey(), platforms: riskState.stats[dayKey()] || {} },
      cooldown,
      queue: { active: activeTask ? activeTask.id : '', pending: queue.length },
      lastHit: riskState.lastHit
    };
  }
  function riskCheck(platform) {
    const now = Date.now();
    const cd = riskState.cooldown[platform] || 0;
    if (cd > now) return { code: 'RISK_COOLDOWN', message: '平台风控冷却中，剩余 ' + Math.ceil((cd - now) / 60000) + ' 分钟' };
    const st = dayStats(platform);
    if (st.tasks >= riskState.config.dailyTaskCap) return { code: 'RISK_QUOTA', message: '今日任务额度已用完（' + st.tasks + '/' + riskState.config.dailyTaskCap + '）' };
    if (st.comments >= riskState.config.dailyCommentCap) return { code: 'RISK_QUOTA', message: '今日评论额度已用完（' + st.comments + '/' + riskState.config.dailyCommentCap + '）' };
    return null;
  }
  function markRisk(platform, reason) {
    riskState.cooldown[platform] = Date.now() + riskState.config.cooldownMs;
    riskState.lastHit = { platform, reason: String(reason || '').slice(0, 220), at: new Date().toISOString() };
    saveRisk();
    const strong = /blocked|403|风控|账号异常|登录失效|Uifid Not Found|Signature Not Found/i.test(String(reason || ''));
    if (strong && activeTask && activeTask.platform === platform && activeTask.proc) {
      try { activeTask.proc.kill(); } catch { /* ignore */ }
    }
    for (const t of queue.slice()) {
      if (t.platform !== platform) continue;
      t.status = 'stopped';
      t.error = '风控命中，已取消排队任务';
      t.endedAt = new Date().toISOString();
      const qi = queue.indexOf(t);
      if (qi > -1) queue.splice(qi, 1);
      writeMeta(t);
      finishTask(t);
    }
  }

  const json = (res, code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(obj));
  };
  const err = (res, code, name, msg) => json(res, code, { error: { code: name, message: msg } });
  const readBody = (req) => new Promise((r) => { let s = ''; req.on('data', (c) => { s += c; }); req.on('end', () => r(s)); });
  const readJson = async (req, res) => {
    const raw = await readBody(req);
    if (!raw) { err(res, 400, 'BAD_REQUEST', 'missing JSON body'); return undefined; }
    try { return JSON.parse(raw); } catch { err(res, 400, 'BAD_REQUEST', 'invalid JSON'); return undefined; }
  };

  const pythonExe = () => (existsSync(MC_PY) ? MC_PY : 'python');

  function publicTask(t) {
    const { proc, onDone, _done, ...rest } = t;
    return rest;
  }

  function finishTask(t) {
    if (!t || t._done) return;
    t._done = true;
    if (t.onDone) t.onDone(t);
  }

  function buildArgs(task) {
    const p = PLATFORMS[task.platform];
    const a = [
      'main.py', '--platform', p.arg, '--lt', 'qrcode', '--type', task.mode,
      '--get_comment', 'yes', '--get_sub_comment', task.subComments ? 'yes' : 'no', '--get_media', 'no',
      '--save_data_option', 'json', '--save_data_path', task.dir,
      '--crawler_max_notes_count', String(task.maxNotes),
      '--max_comments_count_singlenotes', String(task.maxComments),
      '--headless', process.env.SS_HEADLESS === '1' ? 'yes' : 'no'
    ];
    if (task.mode === 'search') a.push('--keywords', task.keywords);
    if (task.mode === 'detail') a.push('--specified_id', task.ids);
    if (task.mode === 'creator') a.push('--creator_id', task.ids);
    return a;
  }

  function createTask(body, onDone) {
    if (!PLATFORMS[body.platform]) return { error: 'unsupported platform: ' + body.platform };
    const mode = MODES.indexOf(body.mode) > -1 ? body.mode : 'search';
    if (mode === 'search' && !body.keywords) return { error: 'keywords is required for search mode' };
    if (mode !== 'search' && !body.ids) return { error: 'ids is required for ' + mode + ' mode' };
    if (!existsSync(MC_DIR)) return { error: 'MediaCrawler not found: ' + MC_DIR };

    const rk = riskCheck(body.platform);
    if (rk) return { error: rk.message, code: rk.code };
    if (queue.length >= riskState.config.maxQueue) return { error: '采集队列已满（' + queue.length + '），请稍后再试', code: 'QUEUE_FULL' };

    const cfg = riskState.config;
    const id = 'IT' + Date.now() + Math.floor(Math.random() * 1000);
    const dir = path.join(DATA_ROOT, id);
    mkdirSync(dir, { recursive: true });
    const t = {
      id, platform: body.platform, mode,
      keywords: body.keywords || '', ids: body.ids || '',
      maxNotes: Math.min(Number(body.maxNotes) || 20, cfg.maxNotesPerTask),
      maxComments: Math.min(Number(body.maxComments) || 20, cfg.maxCommentsPerTask),
      subComments: !!body.subComments,
      dir, status: 'queued', loginWait: false, startedAt: new Date().toISOString(),
      endedAt: null, exitCode: null, error: null, log: [], proc: null,
      onDone: onDone || null, _done: false
    };
    t.engine = (body.engine === 'playwright' || body.engine === 'cdp') ? body.engine : engineState.engine;
    tasks.set(id, t);
    writeMeta(t);
    queue.push(t);
    pump();
    return { taskId: id };
  }

  function startTask(t) {
    t.status = 'running';
    t.startedAt = new Date().toISOString();
    activeTask = t;
    try { const st = dayStats(t.platform); st.tasks += 1; pruneStats(); saveRisk(); } catch { /* ignore */ }
    const eng = t.engine || engineState.engine;
    const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1', PYTHONUTF8: '1' };
    if (eng === 'cdp') { env.SS_CDP_MODE = 'true'; env.SS_CDP_CONNECT_EXISTING = 'true'; env.SS_CDP_PORT = String(CDP_PORT); }
    else { env.SS_CDP_MODE = 'false'; }
    const child = spawn(pythonExe(), buildArgs(t), { cwd: MC_DIR, env, windowsHide: true });
    t.proc = child;

    const onData = (buf) => {
      const text = buf.toString('utf8');
      for (const line of text.split(/\r?\n/)) {
        const s = line.trim();
        if (!s) continue;
        t.log.push(s);
        if (t.log.length > 400) t.log.splice(0, t.log.length - 400);
        if (/扫码|二维码|请登录|qrcode|login/i.test(s)) t.loginWait = true;
        if (!RISK_IGNORE.test(s) && RISK_RE.test(s)) markRisk(t.platform, s);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (e) => {
      t.status = 'failed'; t.error = String((e && e.message) || e); t.endedAt = new Date().toISOString();
      try { writeFileSync(path.join(t.dir, 'run.log'), t.log.join('\n'), 'utf8'); } catch { /* ignore */ }
      activeTask = null; lastEndedAt = Date.now();
      finishTask(t); pump();
    });
    child.on('close', (code) => {
      const stopped = t.status === 'stopped';
      if (!stopped) {
        t.exitCode = code;
        t.status = code === 0 ? 'done' : 'failed';
        if (code !== 0 && !t.error) t.error = 'MediaCrawler exited with code ' + code;
        if (code !== 0) {
          const hit = (t.log || []).find((l) => !RISK_IGNORE.test(l) && /blocked|403|风控|账号异常|登录失效|滑块|Signature Not Found|Uifid Not Found|访问频繁/i.test(l));
          if (hit) markRisk(t.platform, hit);
        }
      }
      t.endedAt = new Date().toISOString();
      try { const n = normalize(t); const st = dayStats(t.platform); st.comments += (n.comments || []).length; pruneStats(); } catch { /* ignore */ }
      saveRisk();
      writeMeta(t);
      try { writeFileSync(path.join(t.dir, 'run.log'), t.log.join('\n'), 'utf8'); } catch { /* ignore */ }
      activeTask = null; lastEndedAt = Date.now();
      finishTask(t); pump();
    });
  }

  function pump() {
    if (activeTask) return;
    if (!queue.length) return;
    const cfg = riskState.config;
    const wait = Math.max(0, (lastEndedAt || 0) + cfg.minGapMs + Math.floor(Math.random() * 8000) - Date.now());
    if (wait > 0) {
      if (!pumpTimer) pumpTimer = setTimeout(function () { pumpTimer = null; pump(); }, wait);
      return;
    }
    const t = queue.shift();
    if (t) startTask(t);
  }

  function stopTask(t) {
    if (!t) return false;
    t.status = 'stopped';
    t.endedAt = t.endedAt || new Date().toISOString();
    const qi = queue.indexOf(t);
    if (qi > -1) queue.splice(qi, 1);
    if (t.proc) { try { t.proc.kill(); } catch { /* ignore */ } }
    writeMeta(t);
    finishTask(t);
    if (!t.proc) pump();
    return true;
  }

  /* ---------- 产物解析 ---------- */
  const fmtTime = (ct) => {
    let n = Number(ct);
    if (!isFinite(n) || n <= 0) return '';
    if (n < 1e12) n *= 1000;               // 抖音为秒级
    const d = new Date(n);
    if (isNaN(d.getTime())) return '';
    const p = (x) => String(x).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  };
  const WORK_ID_KEYS = ['aweme_id', 'video_id', 'note_id'];
  const WORK_URL_KEYS = ['aweme_url', 'video_url', 'note_url'];
  const pick = (o, keys) => { for (const k of keys) if (o[k] != null && o[k] !== '') return o[k]; return ''; };
  /* 作品链接：优先用产物里的 url，缺失时按平台 + 作品 ID 拼接 */
  const WORK_URL_BUILD = {
    douyin: (id) => 'https://www.douyin.com/video/' + id,
    kuaishou: (id) => 'https://www.kuaishou.com/short-video/' + id,
    xiaohongshu: (id) => 'https://www.xiaohongshu.com/explore/' + id
  };
  const workUrl = (platform, id, given) => given || (WORK_URL_BUILD[platform] && id ? WORK_URL_BUILD[platform](id) : '');

  function readJsonArray(fp) {
    try {
      const v = JSON.parse(readFileSync(fp, 'utf8'));
      return Array.isArray(v) ? v : [v];
    } catch { return []; }
  }

  function loadRaw(t) {
    /* MediaCrawler 落盘目录名与其内部平台名一致（douyin / kuaishou / xhs），
       与 CLI 的 dy/ks 不同；这里递归扫描，不依赖具体目录名。 */
    const out = { works: [], comments: [] };
    const walk = (d) => {
      let ents;
      try { ents = readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of ents) {
        const fp = path.join(d, e.name);
        if (e.isDirectory()) walk(fp);
        else if (e.name.endsWith('.json')) {
          if (e.name.startsWith(t.mode + '_contents_')) out.works.push(...readJsonArray(fp));
          else if (e.name.startsWith(t.mode + '_comments_')) out.comments.push(...readJsonArray(fp));
        }
      }
    };
    walk(t.dir);
    return out;
  }

  function normalize(t) {
    const raw = loadRaw(t);
    const workById = {};
    for (const w of raw.works) {
      const wid = pick(w, WORK_ID_KEYS);
      if (wid) workById[wid] = { title: pick(w, ['title', 'desc']) || '(无标题)', url: workUrl(t.platform, wid, pick(w, WORK_URL_KEYS)) };
    }
    const comments = raw.comments.map((c) => {
      const wid = pick(c, WORK_ID_KEYS);
      const wk = workById[wid] || {};
      return {
        id: String(pick(c, ['comment_id']) || ''),
        accountId: t.platform,
        work: wk.title || wid || '(未知作品)',
        url: wk.url || '',
        workId: wid,
        text: String(pick(c, ['content', 'comment_text', 'text']) || ''),
        author: String(pick(c, ['nickname', 'author', 'username']) || '匿名'),
        likes: Number(pick(c, ['like_count', 'digg_count']) || 0) || 0,
        region: String(c.ip_label || c.ip_location || ''),
        at: fmtTime(pick(c, ['create_time', 'timestamp']))
      };
    });
    return { works: raw.works.length, comments };
  }

  function csvCell(v) {
    const s = String(v == null ? '' : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function buildCsv(leads) {
    const head = ['线索ID', '平台', '意向', '昵称', '诉求原文', '点赞', '来源作品', '作品链接', '时间', '状态', '联系方式'];
    const rows = leads.map((l) => [l.id, PLATFORMS[l.platform] ? PLATFORMS[l.platform].label : l.platform, l.level, l.name, l.need, l.likes, l.source, l.url, l.at, l.status, l.contact]);
    return '\ufeff' + [head].concat(rows).map((r) => r.map(csvCell).join(',')).join('\r\n');
  }
  function buildCommentsCsv(comments) {
    const head = ['评论ID', '平台', '昵称', '评论内容', '点赞', '来源作品', '作品链接', '时间', 'AI判定'];
    const rows = comments.map((c) => [c.id, PLATFORMS[c.accountId] ? PLATFORMS[c.accountId].label : c.accountId, c.author, c.text, c.likes, c.work, c.url, c.at, Core.judgeComment(c.text)]);
    return '\ufeff' + [head].concat(rows).map((r) => r.map(csvCell).join(',')).join('\r\n');
  }

  function leadsOf(t) {
    const { comments } = normalize(t);
    const r = Core.leadFromComments(comments) || { leads: [] };
    const byId = {};
    for (const c of comments) byId[c.id] = c;
    const leads = (r.leads || []).map((l) => Object.assign({}, l, {
      platform: t.platform,
      url: (byId[l.id] || {}).url || '',
      likes: (byId[l.id] || {}).likes || 0
    }));
    return { leads, stats: Core.analyzeComments(comments) };
  }

  /* ---------- 编程式采集（供竞品情报复用） ---------- */
  async function crawlAndWait(body, timeoutMs = 20 * 60 * 1000) {
    if (!PLATFORMS[body.platform]) return { error: 'unsupported platform: ' + body.platform };
    const e = await ensureCdp(body.platform);
    if (e) return { error: e };
    return new Promise((resolve) => {
      let settled = false;
      let timer = null;
      const finish = (t) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        if (!t) return resolve({ error: 'task not found' });
        if (t.status !== 'done') return resolve({ error: t.error || ('采集未完成：' + t.status), task: publicTask(t) });
        try {
          const n = normalize(t);
          resolve({ taskId: t.id, task: publicTask(t), raw: loadRaw(t), comments: n.comments, worksCount: n.works });
        } catch (err) {
          resolve({ error: String((err && err.message) || err), task: publicTask(t) });
        }
      };
      const r = createTask(body, finish);
      if (r.error) return resolve({ error: r.error });
      timer = setTimeout(() => {
        const t = tasks.get(r.taskId);
        if (t && (t.status === 'running' || t.status === 'starting')) stopTask(t);
        finish(t);
      }, timeoutMs);
    });
  }

  /* ---------- 路由 ---------- */
  const routes = [
    { m: 'GET', p: '/api/intercept/risk', h: (req, res) => json(res, 200, riskPublic()) },

    { m: 'POST', p: '/api/intercept/risk/config', h: async (req, res) => {
        const b = await readJson(req, res); if (b === undefined) return;
        const c = riskState.config;
        const set = (k, min, max) => { if (b[k] == null) return; const n = Number(b[k]); if (isFinite(n)) c[k] = Math.min(max, Math.max(min, Math.round(n))); };
        set('minGapMs', 0, 3600000); set('cooldownMs', 0, 86400000);
        set('dailyTaskCap', 1, 500); set('dailyCommentCap', 0, 200000);
        set('maxCommentsPerTask', 1, 20000); set('maxNotesPerTask', 1, 500);
        set('maxQueue', 0, 20); c.maxConcurrent = 1;
        saveRisk();
        json(res, 200, riskPublic());
      } },

    { m: 'POST', p: '/api/intercept/risk/reset', h: (req, res) => {
        riskState.cooldown = {}; riskState.lastHit = null; saveRisk();
        json(res, 200, riskPublic());
      } },

    { m: 'GET', p: '/api/intercept/platforms', h: (req, res) => json(res, 200, {
        available: existsSync(MC_DIR),
        python: pythonExe(),
        platforms: Object.keys(PLATFORMS).map((k) => ({ key: k, label: PLATFORMS[k].label, supported: true }))
          .concat([{ key: 'shipinhao', label: '视频号', supported: false, note: 'MediaCrawler 暂不支持' }])
      }) },

    { m: 'GET', p: '/api/intercept/tasks', h: (req, res) =>
        json(res, 200, [...tasks.values()]
          .sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')))
          .map((t) => Object.assign(publicTask(t), { counts: taskCounts(t) }))) },

    { m: 'POST', p: '/api/intercept/tasks', h: async (req, res) => {
        const b = await readJson(req, res); if (b === undefined) return;
        const eng = (b.engine === 'playwright' || b.engine === 'cdp') ? b.engine : engineState.engine;
        if (eng === 'cdp') {
          /* 采集前自动确保「共用的登录浏览器」在运行（首次会自动打开窗口，可直接扫码登录） */
          if (!(await cdpAlive(CDP_PORT))) {
            const r = openLoginCdp(b.platform);
            if (r.error) return err(res, 400, 'BAD_REQUEST', r.error);
            for (let i = 0; i < 20; i++) { await new Promise((z) => setTimeout(z, 1000)); if (await cdpAlive(CDP_PORT)) break; }
            if (!(await cdpAlive(CDP_PORT))) return err(res, 409, 'CDP_NOT_READY', '登录浏览器未就绪（调试端口 ' + CDP_PORT + '）');
          }
        }
        const r = createTask(b);
        if (r.error) return err(res, 400, 'BAD_REQUEST', r.error);
        json(res, 200, publicTask(tasks.get(r.taskId)));
      } },

    { m: 'GET', p: '/api/intercept/tasks/:id', h: (req, res, pp) => {
        const t = tasks.get(pp.id); if (!t) return err(res, 404, 'NOT_FOUND', 'task not found: ' + pp.id);
        json(res, 200, publicTask(t));
      } },

    { m: 'POST', p: '/api/intercept/tasks/:id/stop', h: (req, res, pp) => {
        const t = tasks.get(pp.id); if (!t) return err(res, 404, 'NOT_FOUND', 'task not found: ' + pp.id);
        stopTask(t);
        json(res, 200, publicTask(t));
      } },

    { m: 'GET', p: '/api/intercept/tasks/:id/comments', h: (req, res, pp) => {
        const t = tasks.get(pp.id); if (!t) return err(res, 404, 'NOT_FOUND', 'task not found: ' + pp.id);
        const n = normalize(t);
        json(res, 200, { total: n.comments.length, worksCount: n.works, comments: n.comments });
      } },

    { m: 'GET', p: '/api/intercept/tasks/:id/leads', h: (req, res, pp) => {
        const t = tasks.get(pp.id); if (!t) return err(res, 404, 'NOT_FOUND', 'task not found: ' + pp.id);
        json(res, 200, leadsOf(t));
      } },

    { m: 'GET', p: '/api/intercept/tasks/:id/export', h: (req, res, pp, u) => {
        const t = tasks.get(pp.id); if (!t) return err(res, 404, 'NOT_FOUND', 'task not found: ' + pp.id);
        const what = u.searchParams.get('what') === 'comments' ? 'comments' : 'leads';
        const fmt = u.searchParams.get('format') || 'csv';
        const stamp = pp.id + '-' + what;
        if (what === 'comments') {
          const { comments } = normalize(t);
          if (fmt === 'json') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="comments-' + stamp + '.json"' });
            return res.end(JSON.stringify(comments, null, 2));
          }
          res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="comments-' + stamp + '.csv"' });
          return res.end(buildCommentsCsv(comments));
        }
        const { leads } = leadsOf(t);
        if (fmt === 'json') {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="leads-' + stamp + '.json"' });
          return res.end(JSON.stringify(leads, null, 2));
        }
        res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="leads-' + stamp + '.csv"' });
        res.end(buildCsv(leads));
      } },

    /* ---------- 登录/会话 ---------- */
    { m: 'GET', p: '/api/intercept/login/status', h: async (req, res) => json(res, 200, {
        engine: engineState.engine,
        cdpPort: CDP_PORT,
        cdpOnline: await cdpAlive(CDP_PORT),
        browsers: detectBrowsers(),
        profileBase: EASEL_PROFILES,
        sharedWithEasel: true,
        profiles: Object.keys(PLATFORM_PROFILE).reduce((m, k) => { m[k] = profileDirFor(k); return m; }, {}),
        playwright: { running: engineState.setup.running, ok: engineState.setup.ok, error: engineState.setup.error, log: engineState.setup.log.slice(-20) }
      }) },

    { m: 'POST', p: '/api/intercept/login/engine', h: async (req, res) => {
        const b = await readJson(req, res); if (b === undefined) return;
        if (b.engine !== 'cdp' && b.engine !== 'playwright') return err(res, 400, 'BAD_REQUEST', 'engine must be cdp|playwright');
        engineState.engine = b.engine;
        json(res, 200, { engine: engineState.engine });
      } },

    { m: 'POST', p: '/api/intercept/login/open', h: async (req, res) => {
        const b = await readJson(req, res); if (b === undefined) return;
        const eng = (b.engine === 'playwright' || b.engine === 'cdp') ? b.engine : engineState.engine;
        if (eng === 'playwright') {
          if (!engineState.setup.ok) startPlaywrightSetup();
          const r = createTask({ platform: b.platform, mode: 'search', keywords: b.keywords || '热门', maxNotes: 1, maxComments: 1, engine: 'playwright' });
          if (r.error) return err(res, 400, 'BAD_REQUEST', r.error);
          return json(res, 200, { engine: 'playwright', taskId: r.taskId, installing: engineState.setup.running });
        }
        const r = openLoginCdp(b.platform);
        if (r.error) return err(res, 400, 'BAD_REQUEST', r.error);
        json(res, 200, Object.assign({ engine: 'cdp' }, r));
      } },

    { m: 'POST', p: '/api/intercept/login/setup', h: (req, res) => { startPlaywrightSetup(); json(res, 200, { installing: true }); } }
  ];
  return { routes, crawlAndWait };
}

export function makeInterceptRoutes(Core) {
  return createCrawler(Core).routes;
}

