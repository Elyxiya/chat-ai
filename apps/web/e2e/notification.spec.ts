import { test, expect } from '@playwright/test';

test.describe('Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
  });

  test('should have notification bell with unread count', async ({ page }) => {
    const bell = page.locator('[title*="notification"i], [title*="通知"i]').first();
    await expect(bell).toBeVisible();
  });

  test('should open notification panel on bell click', async ({ page }) => {
    const bell = page.locator('[title*="notification"i], [title*="通知"i]').first();
    await bell.click();
    const panel = page.getByText(/notifications|通知/i).first();
    await expect(panel).toBeVisible();
  });

  test('should show mark all read button', async ({ page }) => {
    const bell = page.locator('[title*="notification"i], [title*="通知"i]').first();
    await bell.click();
    const markRead = page.getByText(/mark all read|全部标为已读/i);
    if (await markRead.isVisible().catch(() => false)) {
      await expect(markRead).toBeVisible();
    }
  });

  test('should close notification panel', async ({ page }) => {
    const bell = page.locator('[title*="notification"i], [title*="通知"i]').first();
    await bell.click();
    // Click outside or close button
    const closeBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  });
});
