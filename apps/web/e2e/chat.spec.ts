import { test, expect } from '@playwright/test';

test.describe('Chat Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the chat page (assumes user is already authenticated via test setup)
    await page.goto('/chat');
  });

  test('should render chat layout', async ({ page }) => {
    await expect(page.getByText(/chat|会话|消息/i).first()).toBeVisible();
  });

  test('should have session list sidebar', async ({ page }) => {
    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();
  });

  test('should have message input area', async ({ page }) => {
    const inputArea = page.locator('input, textarea').first();
    await expect(inputArea).toBeVisible();
  });

  test('should show AI Agent page with mode selector', async ({ page }) => {
    await page.goto('/chat/agent');
    await expect(page.getByText(/ai agent|AI/i).first()).toBeVisible();
    await expect(page.getByText(/react|planner|reasoner|规划|推理/i).first()).toBeVisible();
  });

  test('should have knowledge base navigation', async ({ page }) => {
    await page.goto('/knowledge');
    await expect(page.getByText(/knowledge|知识库/i).first()).toBeVisible();
  });

  test('should show settings page', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText(/settings|设置/i).first()).toBeVisible();
  });
});
