import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test('should display login form', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /sign in|登录|login/i })).toBeVisible();
    await expect(page.getByPlaceholder(/username|email|用户名/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password|密码/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|登录|login/i })).toBeVisible();
  });

  test('should show validation error on empty submit', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /sign in|登录|login/i }).click();

    // Should show some validation feedback
    await expect(page.locator('text=required|请填写|必填|请输入')).toBeVisible();
  });

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/login');
    const registerLink = page.getByText(/register|注册|sign up/i);
    if (await registerLink.isVisible()) {
      await registerLink.click();
      await expect(page).toHaveURL(/register|signup|注册/i);
    }
  });
});
