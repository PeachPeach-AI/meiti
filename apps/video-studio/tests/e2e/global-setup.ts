import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const port = process.env.PLAYWRIGHT_PORT || '3100';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;
const pidFile = path.join(process.cwd(), 'test-results', 'e2e-server.pid');

async function canReachServer() {
  try {
    const response = await fetch(baseURL, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

export default async function globalSetup() {
  if (process.env.PLAYWRIGHT_BASE_URL) return;
  if (await canReachServer()) {
    throw new Error(`${baseURL} is already in use. Stop the existing server or set PLAYWRIGHT_BASE_URL explicitly.`);
  }

  await mkdir(path.dirname(pidFile), { recursive: true });
  const child = spawn(process.execPath, ['./node_modules/next/dist/bin/next', 'dev', '-p', port], {
    cwd: process.cwd(),
    env: { ...process.env, BROWSER: 'none' },
    stdio: 'ignore',
    detached: true,
  });
  if (!child.pid) throw new Error('Failed to start the Next.js test server.');
  await writeFile(pidFile, String(child.pid), 'utf8');
  child.unref();

  const startedAt = Date.now();
  while (Date.now() - startedAt < 120_000) {
    if (await canReachServer()) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${baseURL}.`);
}