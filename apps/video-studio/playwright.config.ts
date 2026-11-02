import { defineConfig, devices } from '@playwright/test';

const testPort = process.env.PLAYWRIGHT_PORT || '3100';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${testPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: [['list']],
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-edge',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'msedge',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile-edge',
      use: {
        ...devices['Pixel 5'],
        channel: 'msedge',
      },
    },
  ],
});