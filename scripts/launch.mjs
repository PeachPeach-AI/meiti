#!/usr/bin/env node
/* 一键启动：网关 + Easel + 图像 + 视频 + 门户（全部浏览器访问） */
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const IS_WIN = process.platform === 'win32';
const LOGS = path.join(ROOT, 'runtime', 'logs');
mkdirSync(LOGS, { recursive: true });

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

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8080);
const PORTS = {
  gateway: Number(process.env.GATEWAY_PORT || 18789),
  easel: Number(process.env.EASEL_PORT || 7866),
  image: Number(process.env.IMAGE_PORT || 7867),
  video: Number(process.env.VIDEO_PORT || 7868),
  portal: PORT
};
const MODE = process.env.SS_MODE === 'prod' ? 'prod' : 'dev';
const PY = path.join(ROOT, 'apps', 'easel', '.venv', IS_WIN ? 'Scripts/python.exe' : 'bin/python');
const OC = path.join(ROOT, 'node_modules', 'openclaw', 'openclaw.mjs');
const NPM = IS_WIN ? 'npm.cmd' : 'npm';

function portOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const s = net.connect({ port, host });
    const done = (v) => { try { s.destroy(); } catch {} resolve(v); };
    s.once('connect', () => done(true));
    s.once('error', () => done(false));
    setTimeout(() => done(false), 700);
  });
}

const children = [];
function start(name, cmd, args, opts = {}) {
  const out = createWriteStream(path.join(LOGS, name + '.log'), { flags: 'a' });
  const err = createWriteStream(path.join(LOGS, name + '.err.log'), { flags: 'a' });
  const env = Object.assign({}, process.env, opts.env || {});
  env.PATH = path.dirname(process.execPath) + path.delimiter + (env.PATH || '');
  const child = spawn(cmd, args, {
    cwd: opts.cwd || ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: !!opts.shell
  });
  child.stdout.pipe(out);
  child.stderr.pipe(err);
  child.on('error', (e) => console.log('[launch] ' + name + ' error: ' + e.message));
  child.on('exit', (code) => console.log('[launch] ' + name + ' exited code=' + code));
  children.push({ name, child });
  console.log('[launch] ' + name + ' started (pid ' + child.pid + ')');
  return child;
}

function hasNodeModules(dir) {
  return existsSync(path.join(dir, 'node_modules'));
}

async function main() {
  const rawStream = path.join(ROOT, 'runtime', 'easel-raw-stream.jsonl');
  mkdirSync(path.dirname(rawStream), { recursive: true });

  /* 1. OpenClaw gateway */
  if (!(await portOpen(PORTS.gateway))) {
    if (!existsSync(OC)) {
      console.log('[launch] 跳过 gateway：未安装 openclaw，请先运行 npm run setup');
    } else {
      const ocHome = path.join(os.homedir(), '.openclaw-easel', 'openclaw.json');
      if (!existsSync(ocHome)) console.log('[launch] 提示：尚未初始化 Easel 配置，请先运行 npm run init:easel');
      start('gateway', process.execPath, [
        OC, '--profile', 'easel', 'gateway', 'run', '--allow-unconfigured',
        '--bind', 'loopback', '--raw-stream', '--raw-stream-path', rawStream
      ], { env: { OPENCLAW_RAW_STREAM: '1', OPENCLAW_RAW_STREAM_PATH: rawStream } });
    }
  } else console.log('[launch] gateway already running (' + PORTS.gateway + ')');

  /* 2. Easel Web */
  if (!(await portOpen(PORTS.easel))) {
    if (!existsSync(PY)) {
      console.log('[launch] 跳过 Easel：未创建 Python venv，请先运行 npm run setup');
    } else {
      start('easel', PY, ['web/app.py'], {
        cwd: path.join(ROOT, 'apps', 'easel'),
        env: {
          PYTHONUTF8: '1',
          PYTHONIOENCODING: 'utf-8',
          EASEL_CHAT_TRANSPORT: 'http',
          EASEL_GATEWAY_PORT: String(PORTS.gateway),
          OPENCLAW_RAW_STREAM: '1',
          OPENCLAW_RAW_STREAM_PATH: rawStream,
          EASEL_RAW_STREAM_PATH: rawStream
        }
      });
    }
  } else console.log('[launch] easel already running (' + PORTS.easel + ')');

  /* 3/4. Next.js 工作台 */
  for (const [name, dir, port] of [
    ['image', path.join(ROOT, 'apps', 'image-studio'), PORTS.image],
    ['video', path.join(ROOT, 'apps', 'video-studio'), PORTS.video]
  ]) {
    if (await portOpen(port)) { console.log('[launch] ' + name + ' already running (' + port + ')'); continue; }
    if (!hasNodeModules(dir)) { console.log('[launch] 跳过 ' + name + '：缺少 node_modules，请先运行 npm run setup'); continue; }
    const args = MODE === 'prod'
      ? ['run', 'start', '--', '-p', String(port), '-H', HOST]
      : ['run', 'dev', '--', '-p', String(port), '-H', HOST];
    start(name, NPM, args, { cwd: dir, shell: IS_WIN });
  }

  /* 5. 门户（UI + API） */
  if (await portOpen(PORTS.portal)) console.log('[launch] portal already running (' + PORTS.portal + ')');
  else start('portal', process.execPath, [path.join(ROOT, 'apps', 'smartstore', 'server', 'portal.mjs')], {
    env: { HOST, PORT: String(PORTS.portal) }
  });

  /* 等待端口就绪 */
  const targets = [
    ['gateway', PORTS.gateway], ['easel', PORTS.easel], ['image', PORTS.image],
    ['video', PORTS.video], ['portal', PORTS.portal]
  ];
  const deadline = Date.now() + 180000;
  const pending = new Set(targets.map(([n]) => n));
  while (pending.size && Date.now() < deadline) {
    for (const [name, port] of targets) {
      if (!pending.has(name)) continue;
      if (await portOpen(port)) { pending.delete(name); console.log('[ready] ' + name + ' :' + port); }
    }
    if (pending.size) await new Promise((r) => setTimeout(r, 1000));
  }
  for (const name of pending) console.log('[warn] ' + name + ' 未在 180s 内就绪，请查看 runtime/logs/' + name + '.err.log');

  const hostForUrl = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log('\n浏览器打开： http://' + hostForUrl + ':' + PORTS.portal + '/');
  console.log('AI 创作：   http://' + hostForUrl + ':' + PORTS.easel + '/');
  console.log('图像工作台： http://' + hostForUrl + ':' + PORTS.image + '/');
  console.log('视频工作台： http://' + hostForUrl + ':' + PORTS.video + '/');
  console.log('日志目录：   ' + LOGS + '\n');
}

function shutdown() {
  console.log('\n[launch] stopping...');
  for (const { child } of children) {
    if (!child || child.exitCode !== null) continue;
    try {
      if (IS_WIN) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
      else child.kill('SIGTERM');
    } catch {}
  }
  setTimeout(() => process.exit(0), 800);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((e) => { console.error(e); process.exit(1); });
