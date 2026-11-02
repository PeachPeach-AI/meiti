#!/usr/bin/env node
/* ============================================================
   自媒体工作站 · M6 本地 API 参考实现（EXE 侧原型）
   契约：docs/plans/2026-09-29-m6-shell-api-contract.md
   - 零依赖 node:http；仅监听 127.0.0.1
   - 数据：hot-update 样例数据的进程内副本（退出即弃）
   - AI 生成位按契约返回 501 AI_NOT_CONFIGURED（密钥走环境变量）
   启动：node server/api.mjs [--port 46100]
   ============================================================ */
import http from 'node:http';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCrawler } from './intercept.mjs';
import { makeIntelRoutes } from './intel.mjs';

const require = createRequire(import.meta.url);
globalThis.window = globalThis.window || {};
require(fileURLToPath(new URL('../web/assets/data.js', import.meta.url)));
const Core = require(fileURLToPath(new URL('../web/assets/core/ss-core.js', import.meta.url)));

const SRC = globalThis.window.SS;
const DATA_KEYS = ['orgs', 'stores', 'employees', 'accounts', 'works', 'contentTypes', 'topics', 'dashboard', 'script', 'mixcut', 'viral', 'comments', 'nurture', 'recAssets', 'complaints', 'opportunities', 'recDevice', 'transcripts'];
const D = {};
for (const k of DATA_KEYS) D[k] = structuredClone(SRC[k]);
let addedSeq = 0, genSeq = 0;

/* ---------- 助手 ---------- */
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}
const err = (res, code, codeName, message) => json(res, code, { error: { code: codeName, message } });

function readBody(req) {
  return new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => { s += c; });
    req.on('end', () => resolve(s));
  });
}
async function readJson(req, res) {
  const raw = await readBody(req);
  if (!raw) { err(res, 400, 'BAD_REQUEST', 'missing JSON body'); return undefined; }
  try { return JSON.parse(raw); } catch { err(res, 400, 'BAD_REQUEST', 'invalid JSON'); return undefined; }
}
const acctById = (id) => D.accounts.filter((a) => a.id === id)[0];

/* ---------- 路由表（契约 §二） ---------- */
const routes = [
  { m: 'GET', p: '/api/health', h: (req, res) => json(res, 200, { ok: true, version: '0.8.0-contract-v1', sampleFallback: false }) },

  { m: 'GET', p: '/api/accounts', h: (req, res) => json(res, 200, D.accounts) },
  { m: 'POST', p: '/api/accounts', h: async (req, res) => {
      const b = await readJson(req, res); if (b === undefined) return;
      if (!b.platform || !b.nickname) return err(res, 400, 'BAD_REQUEST', 'platform and nickname are required');
      const a = { id: 'srv-added-' + (++addedSeq), platform: b.platform, nickname: b.nickname, homepage: b.homepage || null, authStatus: 'unauthorized', followers: null, likes: null, worksCount: null, bio: null, region: null, verified: null, avatar: String(b.nickname).slice(0, 1), tone: 'a3', active: 'unknown', lastPublishedAt: null, silentDays: null, status: '未授权' };
      D.accounts.push(a);
      json(res, 200, a);
    } },
  { m: 'DELETE', p: '/api/accounts/:id', h: (req, res, pp) => {
      const before = D.accounts.length;
      D.accounts = D.accounts.filter((a) => a.id !== pp.id);
      if (D.accounts.length === before) return err(res, 404, 'NOT_FOUND', 'account not found: ' + pp.id);
      json(res, 200, { ok: true });
    } },

  { m: 'GET', p: '/api/accounts/:id/works', h: (req, res, pp) => {
      if (!acctById(pp.id)) return err(res, 404, 'NOT_FOUND', 'account not found: ' + pp.id);
      json(res, 200, D.works.filter((w) => w.accountId === pp.id));
    } },
  { m: 'POST', p: '/api/accounts/:id/import', h: async (req, res, pp) => {
      const b = await readJson(req, res); if (b === undefined) return;
      const a = acctById(pp.id); if (!a) return err(res, 404, 'NOT_FOUND', 'account not found: ' + pp.id);
      for (const k of ['nickname', 'followers', 'likes', 'worksCount', 'bio']) if (b[k] != null && b[k] !== '') a[k] = b[k];
      a.importedAt = new Date().toISOString().slice(5, 16).replace('T', ' ');
      json(res, 200, a);
    } },

  { m: 'GET', p: '/api/topics', h: (req, res) => json(res, 200, D.topics) },
  { m: 'POST', p: '/api/topics/from-recording', h: async (req, res) => {
      const b = await readJson(req, res); if (b === undefined) return;
      if (!b.q) return err(res, 400, 'BAD_REQUEST', 'q is required');
      const t = Core.topicFromQuestion(b.q, ++genSeq);
      D.topics.unshift(t);
      json(res, 200, t);
    } },

  { m: 'GET', p: '/api/diagnosis/:id', h: (req, res, pp) => {
      const a = acctById(pp.id); if (!a) return err(res, 404, 'NOT_FOUND', 'account not found: ' + pp.id);
      if (a.authStatus === 'unauthorized') return json(res, 200, null); /* 契约：未授权 → null */
      json(res, 200, Core.diagnose(a, D.works.filter((w) => w.accountId === pp.id), new Date()));
    } },

  { m: 'POST', p: '/api/scripts', h: async (req, res) => {
      const b = await readJson(req, res); if (b === undefined) return;
      if (!b.topicId) return err(res, 400, 'BAD_REQUEST', 'topicId is required');
      const t = D.topics.filter((x) => x.id === b.topicId)[0] || D.topics[0];
      json(res, 200, Core.scriptgen(t, { variant: b.variant || 'knowledge', account: D.accounts[0] }));
    } },

  { m: 'POST', p: '/api/compliance/check', h: async (req, res) => {
      const b = await readJson(req, res); if (b === undefined) return;
      if (b.text == null) return err(res, 400, 'BAD_REQUEST', 'text is required');
      json(res, 200, Core.compliance({ hook: b.hook, body: b.text }));
    } },

  { m: 'GET', p: '/api/matrix/insights', h: (req, res) => json(res, 200, Core.matrixInsights(D.works, { names: {}, accounts: D.accounts })) },
  { m: 'GET', p: '/api/recordings/analysis', h: (req, res) => json(res, 200, Core.analyzeRecordings(D.transcripts)) },

  { m: 'GET', p: '/api/cockpit', h: (req, res) => {
      const now = new Date();
      const mi = Core.matrixInsights(D.works, { names: {}, accounts: D.accounts });
      const recR = Core.analyzeRecordings(D.transcripts);
      const m = Core.cockpitMetrics(D.accounts, D.works, now);
      const a = Core.cockpitAnswers(D.accounts, D.works, recR, mi, now);
      json(res, 200, Object.assign({}, m, { answers: a.answers, brief: a.brief }));
    } },

  { m: 'GET', p: '/api/works', h: (req, res) => json(res, 200, D.works) },
  { m: 'GET', p: '/api/transcripts', h: (req, res) => json(res, 200, D.transcripts) },
  { m: 'GET', p: '/api/comments', h: (req, res, pp, u) => {
      const acct = u.searchParams.get('accountId');
      json(res, 200, acct ? D.comments.filter((c) => c.accountId === acct) : D.comments);
    } },

  { m: 'POST', p: '/api/leads/identify', h: async (req, res) => {
      const b = await readJson(req, res); if (b === undefined) return;
      if (!b.comments) return err(res, 400, 'BAD_REQUEST', 'comments is required');
      json(res, 200, Core.leadFromComments(b.comments));
    } },

  { m: 'POST', p: '/api/ai/generate', h: (req, res) => err(res, 501, 'AI_NOT_CONFIGURED', 'AI provider not configured; set provider key via EXE environment variables (contract §一)') }
];
const crawler = createCrawler(Core);
routes.push(...crawler.routes);
routes.push(...makeIntelRoutes(crawler));

/* ---------- 匹配与分发 ---------- */
function matchRoute(method, pathname) {
  let pathMatch = null;
  for (const r of routes) {
    const rp = r.p.split('/').filter(Boolean);
    const cp = pathname.split('/').filter(Boolean);
    if (rp.length !== cp.length) continue;
    const pp = {};
    let okPath = true;
    for (let i = 0; i < rp.length; i++) {
      if (rp[i].startsWith(':')) pp[rp[i].slice(1)] = decodeURIComponent(cp[i]);
      else if (rp[i] !== cp[i]) { okPath = false; break; }
    }
    if (!okPath) continue;
    /* 同路径多方法：优先精确方法命中；否则记下路径命中供 405 判定 */
    if (r.m === method) return { route: r, pp, pathOnly: false };
    if (!pathMatch) pathMatch = { route: r, pp, pathOnly: true };
  }
  return pathMatch;
}

/* 渲染层从 file:// 源跨源访问本地 API：必须返回 CORS 头并处理 OPTIONS 预检，
   否则 POST(application/json) 的前置预检会被浏览器拦下（前端表现为 Failed to fetch）。 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

export const apiServer = http.createServer(async (req, res) => {
  for (const k in CORS_HEADERS) res.setHeader(k, CORS_HEADERS[k]);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const u = new URL(req.url, 'http://127.0.0.1');
  const m = matchRoute(req.method, u.pathname);
  if (!m) return err(res, 404, 'NOT_FOUND', 'no such endpoint: ' + req.method + ' ' + u.pathname);
  if (m.pathOnly) return err(res, 405, 'METHOD_NOT_ALLOWED', req.method + ' not allowed on ' + u.pathname);
  try { await m.route.h(req, res, m.pp, u); }
  catch (e) { err(res, 500, 'INTERNAL', String((e && e.message) || e)); }
});

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const argPort = process.argv.indexOf('--port');
  const argPortFile = process.argv.indexOf('--port-file');
  const portFile = argPortFile > -1 ? process.argv[argPortFile + 1] : null;
  const port = argPort > -1 ? Number(process.argv[argPort + 1]) : 0;
  const host = process.env.HOST || '127.0.0.1';
  apiServer.listen(port, host, () => {
    const bound = apiServer.address().port;
    console.log('[api] contract-v1 listening on http://' + host + ':' + bound);
    /* 壳进程间握手：把实际绑定端口写进文件，供桌面壳读取后注入渲染层 */
    if (portFile) { writeFileSync(portFile, String(bound)); }
  });
}
