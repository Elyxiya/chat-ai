import { test, expect } from '@playwright/test';

test.describe('Private Chat Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
  });

  test('should display chat layout with sidebar', async ({ page }) => {
    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();
    // Should show user info
    await expect(sidebar.getByRole('button').filter({ has: page.locator('img') }).first()).toBeVisible();
  });

  test('should have navigation items', async ({ page }) => {
    await expect(page.getByText(/chats|聊天/i).first()).toBeVisible();
    await expect(page.getByText(/ai agent|ai 助手|agent/i).first()).toBeVisible();
    await expect(page.getByText(/knowledge|知识库/i).first()).toBeVisible();
  });

  test('should have message input area', async ({ page }) => {
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible();
    await expect(textarea).toBeEnabled();
  });

  test('should have search message shortcut', async ({ page }) => {
    const searchBtn = page.getByText(/search messages|搜索消息/i);
    await expect(searchBtn).toBeVisible();

    // Ctrl+K shortcut
    await page.keyboard.press('Control+k');
    await expect(page.getByPlaceholder(/search|搜索/i).first()).toBeVisible();
  });

  test('should have search users button', async ({ page }) => {
    const searchUsers = page.getByText(/search users|搜索用户/i);
    await expect(searchUsers).toBeVisible();
  });

  test('should show channels section in sidebar', async ({ page }) => {
    const channels = page.getByText(/channels|频道/i);
    await expect(channels).toBeVisible();
  });

  test('should have settings and profile navigation', async ({ page }) => {
    await expect(page.getByTitle(/settings|设置/i).first()).toBeVisible();
  });
});
