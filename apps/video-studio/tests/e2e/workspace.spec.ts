import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('Video Studio')).toBeVisible();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByText('Video Studio')).toBeVisible();
  (page as any).__consoleErrors = errors;
});

test.afterEach(async ({ page }) => {
  const errors = ((page as any).__consoleErrors || []) as string[];
  expect(errors.filter((text) => !text.includes('favicon') && !text.includes('404 (Not Found)')).join('\n')).toBe('');
});

test('desktop workspace renders and manual shot editing is usable', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width < 800, 'desktop only');

  await expect(page.getByText('连接设置')).toBeVisible();
  await expect(page.getByText('API Key 仅用于本次请求转发')).toBeVisible();
  await page.getByRole('button', { name: '+ 手动添加镜头' }).click();
  await expect(page.getByText('镜 1')).toBeVisible();
  await page.locator('textarea').first().fill('清晨，主角穿过空旷片场，远处灯光逐渐亮起。');
  await page.getByPlaceholder('主体').fill('主角');
  await page.getByPlaceholder('场景').fill('片场');
  await expect(page.getByRole('button', { name: /未完成/ })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('shot generation mode controls card reference areas', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width < 800, 'desktop only');

  await page.getByRole('button', { name: '+ 手动添加镜头' }).click();
  await expect(page.getByText('镜 1')).toBeVisible();
  await expect(page.getByText('上传组图')).toBeHidden();
  await expect(page.getByText('关键帧时间点')).toBeHidden();

  await page.getByLabel('创建方式：关键帧').click();
  await expect(page.getByText('上传组图')).toBeHidden();
  await expect(page.getByText('关键帧时间点')).toBeVisible();

  await page.getByLabel('创建方式：组图切割').click();
  await expect(page.getByText('上传组图')).toBeVisible();
  await expect(page.getByText('关键帧时间点')).toBeVisible();
});

test('mobile step navigation works without horizontal overflow', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 600, 'mobile only');

  await expect(page.getByRole('button', { name: '1 配置' })).toBeVisible();
  await page.getByRole('button', { name: '1 配置' }).click();
  await expect(page.getByText('连接设置')).toBeVisible();
  await page.getByRole('button', { name: '2 创作' }).click();
  await expect(page.getByText('输入剧本并拆解，或手动添加镜头')).toBeVisible();
  await page.getByRole('button', { name: '3 历史' }).click();
  await expect(page.getByText('生成记录')).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});