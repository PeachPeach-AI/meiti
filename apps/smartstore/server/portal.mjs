#!/usr/bin/env node
/* ============================================================
   自媒体工作站 · 浏览器版入口
   - 同一个端口提供静态 UI 和 /api/*
   - 默认监听 0.0.0.0，NAS/局域网可直接访问
   - 不再依赖 Electron；图像/视频/AI 工作台通过同主机的 7866/7867/7868 端口访问
   启动：node apps/smartstore/server/portal.mjs
   环境变量：HOST（默认 0.0.0.0）、PORT（默认 8080）
   ============================================================ */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiServer } from './api.mjs';

const SERVER_DIR = fileURLToPath(new URL('.', import.meta.url));
const WEB_ROOT = path.resolve(SERVER_DIR, '..', 'web');
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf'
};

function send(res, code, body, headers) {
  res.writeHead(code, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, headers || {}));
  res.end(body);
}

async function serveStatic(req, res) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { return send(res, 400, 'Bad Request'); }

  if (pathname === '/') pathname = '/smartstore-desktop.html';
  const file = path.resolve(WEB_ROOT, '.' + pathname);
  if (!file.toLowerCase().startsWith(WEB_ROOT.toLowerCase())) return send(res, 403, 'Forbidden');

  try {
    const st = await stat(file);
    if (st.isDirectory()) return send(res, 404, 'Not Found');
    const data = await readFile(file);
    const ext = path.extname(file).toLowerCase();
    const isHtml = ext === '.html';
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=3600'
    });
    res.end(data);
  } catch {
    send(res, 404, 'Not Found');
  }
}

const portal = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/healthz') {
    return send(res, 200, JSON.stringify({ ok: true, service: 'smartstore-portal', version: '1.0.0' }), { 'Content-Type': 'application/json; charset=utf-8' });
  }
  if (u.pathname.startsWith('/api/')) {
    /* 复用 api.mjs 的 request handler，不额外监听端口 */
    return apiServer.emit('request', req, res);
  }
  serveStatic(req, res);
});

portal.listen(PORT, HOST, () => {
  console.log('[portal] http://' + (HOST === '0.0.0.0' ? 'localhost' : HOST) + ':' + PORT + '/');
  console.log('[portal] UI root: ' + WEB_ROOT);
});
