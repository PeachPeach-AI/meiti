#!/usr/bin/env node
/* 初始化 OpenClaw 的 easel profile，并把 .env 里的模型配置写进网关 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const OC = path.join(ROOT, 'node_modules', 'openclaw', 'openclaw.mjs');
const HOME = os.homedir();
const CFG = path.join(HOME, '.openclaw-easel', 'openclaw.json');

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
loadEnv(path.join(ROOT, '.env'));

if (!existsSync(OC)) {
  console.error('[init] 未安装 openclaw，请先运行 npm install');
  process.exit(1);
}

function oc(args) {
  console.log('[init] openclaw ' + args.join(' '));
  const r = spawnSync(process.execPath, [OC, '--profile', 'easel', ...args], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env
  });
  if (r.status !== 0) {
    console.error('[init] 命令失败: ' + args.join(' '));
    process.exit(r.status || 1);
  }
}

if (!existsSync(CFG)) {
  oc(['onboard', '--non-interactive', '--mode', 'local', '--accept-risk', '--skip-health']);
}

oc(['config', 'set', 'gateway.mode', 'local']);
oc(['config', 'set', 'gateway.bind', 'loopback']);
oc(['config', 'set', 'gateway.port', String(process.env.GATEWAY_PORT || 18789)]);
oc(['config', 'set', 'gateway.auth.mode', 'none']);
oc(['config', 'set', 'gateway.http.endpoints.chatCompletions.enabled', 'true', '--strict-json']);
oc(['config', 'set', 'agents.defaults.timeoutSeconds', '7200']);

const apiKey = process.env.OPENAI_API_KEY || '';
const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
const model = process.env.OPENAI_MODEL || 'gpt-4o';
if (!apiKey) {
  console.error('\n[init] 缺少 OPENAI_API_KEY。请在 .env 中填写后重跑。');
  process.exit(1);
}

const ops = [
  { path: 'models.providers.openai.api', value: 'openai-completions' },
  { path: 'models.providers.openai.apiKey', value: apiKey },
  { path: 'models.providers.openai.baseUrl', value: baseUrl },
  {
    path: 'models.providers.openai.models',
    value: [{ id: model, name: model, reasoning: true, input: ['text', 'image'] }]
  },
  { path: 'agents.defaults.model.primary', value: 'openai/' + model }
];
const batch = path.join(os.tmpdir(), 'smartstore-easel-provider.json');
writeFileSync(batch, JSON.stringify(ops), 'utf8');
oc(['config', 'set', '--batch-file', batch]);

/* 同步 skills / workspace，让网关里的 agent 能读到 Easel 的技能 */
const easel = path.join(ROOT, 'apps', 'easel');
const ws = path.join(HOME, '.openclaw-easel', 'workspace');
const skillSrc = path.join(easel, 'skills', 'openclaw');
const skillDst = path.join(ws, 'skills');
mkdirSync(skillDst, { recursive: true });
if (existsSync(skillSrc)) {
  for (const entry of readdirSync(skillSrc)) {
    cpSync(path.join(skillSrc, entry), path.join(skillDst, entry), { recursive: true, force: true });
  }
}
if (existsSync(path.join(easel, 'skills', 'shared'))) {
  cpSync(path.join(easel, 'skills', 'shared'), path.join(ws, 'shared'), { recursive: true, force: true });
}
const mdSrc = path.join(easel, 'openclaw', 'workspace');
if (existsSync(mdSrc)) {
  for (const entry of readdirSync(mdSrc)) {
    if (entry.endsWith('.md')) cpSync(path.join(mdSrc, entry), path.join(ws, entry), { force: true });
  }
}
mkdirSync(path.join(easel, 'outputs'), { recursive: true });
mkdirSync(path.join(easel, 'profiles'), { recursive: true });
for (const [link, target] of [['outputs', path.join(easel, 'outputs')], ['easel-profiles', path.join(easel, 'profiles')]]) {
  try { if (!existsSync(path.join(ws, link))) symlinkSync(target, path.join(ws, link), 'dir'); } catch { /* Windows 权限不足时跳过 */ }
}
writeFileSync(path.join(ws, 'MEMORY.md'), '', 'utf8');
console.log('\n[init] 完成：' + model + ' @ ' + baseUrl);
console.log('[init] workspace: ' + ws);
