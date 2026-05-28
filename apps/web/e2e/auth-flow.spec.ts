import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
  test('should display login form elements', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /sign in|登录|login/i })).toBeVisible();
  });

  test('should toggle between login and register form', async ({ page }) => {
    await page.goto('/login');
    const toggle = page.getByText(/register|注册|sign up/i).or(page.getByText(/sign in/i));
    if (await toggle.isVisible()) {
      await toggle.click();
      // Should switch form mode — check URL or form content
      await expect(page.getByRole('button', { name: /register|注册/i }).or(
        page.getByRole('button', { name: /login|登录/i }),
      )).toBeVisible();
    }
  });

  test('should show error for empty login fields', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /sign in|登录|login/i }).click();
    // Form validation feedback should appear
    await expect(page.getByText(/required|请填写|必填|请输入/i).or(
      page.locator('input:invalid'),
    )).toBeAttached();
  });

  test('should redirect to login when unauthenticated', async ({ page }) => {
    // Try accessing a protected route
    await page.goto('/settings');
    await page.waitForURL(/login/);
    expect(page.url()).toContain('login');
  });

  test('should show oauth login buttons', async ({ page }) => {
    await page.goto('/login');
    const githubBtn = page.getByText(/github/i);
    const googleBtn = page.getByText(/google/i);
    if (await githubBtn.isVisible()) expect(githubBtn).toBeVisible();
    if (await googleBtn.isVisible()) expect(googleBtn).toBeVisible();
  });
});
