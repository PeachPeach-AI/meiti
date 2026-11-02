#!/usr/bin/env node
/* 首次安装：Node 依赖、Python venv、Next 构建、Playwright Chromium */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const IS_WIN = process.platform === 'win32';
const NPM = IS_WIN
  ? (existsSync(path.join(path.dirname(process.execPath), 'npm.cmd')) ? path.join(path.dirname(process.execPath), 'npm.cmd') : 'npm.cmd')
  : 'npm';
const SKIP_BUILD = process.argv.includes('--skip-build');

function run(cmd, args, cwd, label) {
  console.log('\n[setup] ' + (label || cmd + ' ' + args.join(' ')));
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: IS_WIN && /\.cmd$/i.test(cmd),
    env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' }
  });
  if (r.status !== 0) {
    console.error('[setup] failed: ' + cmd + ' ' + args.join(' '));
    process.exit(r.status || 1);
  }
}

function findPython() {
  if (process.env.PYTHON && existsSync(process.env.PYTHON)) return [process.env.PYTHON, []];
  const candidates = IS_WIN
    ? [['py', ['-3']], ['python', []]]
    : [['python3', []], ['python', []]];
  for (const [cmd, pre] of candidates) {
    const r = spawnSync(cmd, [...pre, '--version'], { stdio: 'ignore', shell: false });
    if (r.status === 0) return [cmd, pre];
  }
  console.error('[setup] 未找到 Python 3.11+，请先安装（NAS: apt install python3 python3-venv）');
  process.exit(1);
}

const [PY, PY_PRE] = findPython();
const ver = spawnSync(PY, [...PY_PRE, '-c', 'import sys;print("%d.%d"%sys.version_info[:2])'], { encoding: 'utf8' });
if ((ver.stdout || '').trim() !== '3.11') {
  console.error('[setup] 需要 Python 3.11（Easel 的 app_core.pyc 按 3.11 编译；当前 ' + (ver.stdout || 'unknown').trim() + '）');
  process.exit(1);
}
const venvPython = (dir) => path.join(dir, '.venv', IS_WIN ? 'Scripts/python.exe' : 'bin/python');

run(NPM, ['install'], ROOT, 'root npm install (openclaw)');

for (const app of ['image-studio', 'video-studio']) {
  const dir = path.join(ROOT, 'apps', app);
  run(NPM, ['install'], dir, app + ' npm install');
  if (!SKIP_BUILD) run(NPM, ['run', 'build'], dir, app + ' npm run build');
}

const easel = path.join(ROOT, 'apps', 'easel');
if (!existsSync(venvPython(easel))) {
  run(PY, [...PY_PRE, '-m', 'venv', path.join(easel, '.venv')], easel, 'easel venv');
}
run(venvPython(easel), ['-m', 'pip', 'install', '--upgrade', 'pip'], easel);
run(venvPython(easel), ['-m', 'pip', 'install', '-e', '.'], easel, 'easel pip install -e .');
if (!existsSync(path.join(easel, 'web', 'frontend', 'dist', 'index.html'))) {
  const fe = path.join(easel, 'web', 'frontend');
  run(NPM, ['install'], fe, 'easel frontend npm install');
  run(NPM, ['run', 'build'], fe, 'easel frontend npm run build');
}

const mc = path.join(ROOT, 'vendor', 'MediaCrawler');
if (!existsSync(venvPython(mc))) {
  run(PY, [...PY_PRE, '-m', 'venv', path.join(mc, '.venv')], mc, 'MediaCrawler venv');
}
run(venvPython(mc), ['-m', 'pip', 'install', '--upgrade', 'pip'], mc);
run(venvPython(mc), ['-m', 'pip', 'install', '-r', 'requirements.txt'], mc, 'MediaCrawler pip install');

console.log('\n[setup] 安装 Playwright Chromium（两份 venv 都需要）');
const pwArgs = ['-m', 'playwright', 'install'];
if (process.env.SS_PW_WITH_DEPS === '1') pwArgs.push('--with-deps');
pwArgs.push('chromium');
for (const dir of [easel, mc]) {
  run(venvPython(dir), pwArgs, dir, 'playwright chromium');
}

function copyIfMissing(target, example) {
  if (!existsSync(target) && existsSync(example)) {
    copyFileSync(example, target);
    console.log('[setup] created ' + path.relative(ROOT, target));
  }
}
copyIfMissing(path.join(ROOT, '.env'), path.join(ROOT, '.env.example'));
copyIfMissing(path.join(easel, '.env'), path.join(easel, '.env.example'));
copyIfMissing(path.join(mc, '.env'), path.join(mc, '.env.example'));
copyIfMissing(path.join(ROOT, 'apps', 'video-studio', '.env.local'), path.join(ROOT, 'apps', 'video-studio', '.env.example'));

mkdirSync(path.join(ROOT, 'runtime', 'logs'), { recursive: true });
console.log('\n[setup] 完成。');
console.log('下一步：');
console.log('  1. cp .env.example .env 并填写 OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL');
console.log('  2. npm run init:easel      # 初始化 OpenClaw easel profile（只需一次）');
console.log('  3. npm start               # 启动全部服务');
