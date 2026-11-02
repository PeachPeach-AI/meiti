import { execFile } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const pidFile = path.join(process.cwd(), 'test-results', 'e2e-server.pid');

export default async function globalTeardown() {
  if (process.env.PLAYWRIGHT_BASE_URL) return;
  let pidText = '';
  try {
    pidText = await readFile(pidFile, 'utf8');
  } catch {
    return;
  }

  const pid = Number(pidText.trim());
  if (Number.isFinite(pid) && pid > 0) {
    try {
      if (process.platform === 'win32') {
        await execFileAsync('taskkill', ['/pid', String(pid), '/T', '/F']);
      } else {
        process.kill(-pid, 'SIGKILL');
      }
    } catch {
      // The server may already be gone.
    }
  }

  try {
    await unlink(pidFile);
  } catch {
    // Ignore cleanup races.
  }
}