import { test, expect } from '@playwright/test';

test.describe('App Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
  });

  test('should navigate to AI Agent page', async ({ page }) => {
    await page.getByText(/ai agent|ai 助手|agent/i).first().click();
    await expect(page.url()).toContain('/agent');
  });

  test('should navigate to Knowledge Base page', async ({ page }) => {
    await page.getByText(/knowledge|知识库/i).first().click();
    await expect(page.url()).toContain('/knowledge');
  });

  test('should navigate to Settings page', async ({ page }) => {
    await page.getByTitle(/settings|设置/i).first().click();
    await expect(page.url()).toContain('/settings');
  });

  test('should navigate to Profile page', async ({ page }) => {
    const avatar = page.locator('aside img').first();
    await avatar.click();
    await expect(page.url()).toContain('/profile');
  });

  test('should show global search modal on Ctrl+K', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const searchModal = page.getByPlaceholder(/search|搜索/i).first();
    await expect(searchModal).toBeVisible();
    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(searchModal).not.toBeVisible();
  });

  test('should toggle theme', async ({ page }) => {
    const themeBtn = page.locator('[title*="theme"i], [title*="模式"i]').first();
    if (await themeBtn.isVisible()) {
      const html = page.locator('html');
      const initialClass = await html.getAttribute('class');
      await themeBtn.click();
      // Theme should have changed
      await expect(html).not.toHaveClass(initialClass || '');
    }
  });
});
