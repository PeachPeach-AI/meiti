/* 原型静态预览服务器（零依赖，开发调试用）
 * 用法：node server/preview.mjs [--port 43999] [--root hot-update]
 * 默认打开 http://127.0.0.1:43999/smartstore-desktop.html
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', arg('--root', 'hot-update'));
const port = Number(arg('--port', '43999'));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon'
};

function fail(res, code) { res.writeHead(code); res.end(); }

http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://127.0.0.1');
    let p = path.resolve(root, '.' + decodeURIComponent(u.pathname));
    /* 防目录穿越：两侧统一 resolve + 忽略大小写（Windows） */
    if (!p.toLowerCase().startsWith(root.toLowerCase())) return fail(res, 403);
    if (u.pathname.endsWith('/')) p = path.join(p, 'smartstore-desktop.html');
    const data = await readFile(p);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  } catch { fail(res, 404); }
}).listen(port, '127.0.0.1', () => {
  console.log('[preview] http://127.0.0.1:' + port + '/smartstore-desktop.html');
});
