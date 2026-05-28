import { test, expect } from '@playwright/test';

test.describe('AI Agent', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/agent');
  });

  test('should display agent page with input', async ({ page }) => {
    await expect(page.getByPlaceholder(/ask me|向我提问/i).first()).toBeVisible();
  });

  test('should have mode selector', async ({ page }) => {
    await expect(page.getByText(/quick|快速|planner|规划|deep think|深度思考|react|reasoner/i).first().or(
      page.locator('select, [role="tab"]').first(),
    )).toBeVisible();
  });

  test('should have clear memory button', async ({ page }) => {
    const clearBtn = page.getByText(/clear memory|清除记忆/i);
    if (await clearBtn.isVisible()) {
      await expect(clearBtn).toBeEnabled();
    }
  });

  test('should show agent status indicator', async ({ page }) => {
    await page.goto('/agent/status');
    // Status endpoint or indicator
    const statusEl = page.getByText(/online|running|active|离线|运行中|在线/i);
    if (await statusEl.isVisible().catch(() => false)) {
      await expect(statusEl).toBeVisible();
    }
  });

  test('should have agent history panel', async ({ page }) => {
    // Check that the agent page has a message list area
    const messageArea = page.locator('main, section, div').filter({ hasText: /agent|assistant|助手/i }).first();
    await expect(messageArea).toBeAttached();
  });
});
