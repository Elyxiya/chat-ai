# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation.spec.ts >> App Navigation >> should show global search modal on Ctrl+K
- Location: e2e\navigation.spec.ts:29:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByPlaceholder(/search|搜索/i).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByPlaceholder(/search|搜索/i).first()

```

```yaml
- heading "AI-Native Chat" [level=1]
- paragraph: Welcome back
- text: Username or Email
- textbox "Enter username"
- text: Password
- textbox "Enter password"
- button "Log In"
- text: Or continue with
- button "Continue with WeChat":
  - img
  - text: Continue with WeChat
- button "Don't have an account?"
- paragraph: Powered by DeepSeek AI • AI-Native Architecture
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('App Navigation', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.goto('/chat');
  6  |   });
  7  | 
  8  |   test('should navigate to AI Agent page', async ({ page }) => {
  9  |     await page.getByText(/ai agent|ai 助手|agent/i).first().click();
  10 |     await expect(page.url()).toContain('/agent');
  11 |   });
  12 | 
  13 |   test('should navigate to Knowledge Base page', async ({ page }) => {
  14 |     await page.getByText(/knowledge|知识库/i).first().click();
  15 |     await expect(page.url()).toContain('/knowledge');
  16 |   });
  17 | 
  18 |   test('should navigate to Settings page', async ({ page }) => {
  19 |     await page.getByTitle(/settings|设置/i).first().click();
  20 |     await expect(page.url()).toContain('/settings');
  21 |   });
  22 | 
  23 |   test('should navigate to Profile page', async ({ page }) => {
  24 |     const avatar = page.locator('aside img').first();
  25 |     await avatar.click();
  26 |     await expect(page.url()).toContain('/profile');
  27 |   });
  28 | 
  29 |   test('should show global search modal on Ctrl+K', async ({ page }) => {
  30 |     await page.keyboard.press('Control+k');
  31 |     const searchModal = page.getByPlaceholder(/search|搜索/i).first();
> 32 |     await expect(searchModal).toBeVisible();
     |                               ^ Error: expect(locator).toBeVisible() failed
  33 |     // Close with Escape
  34 |     await page.keyboard.press('Escape');
  35 |     await expect(searchModal).not.toBeVisible();
  36 |   });
  37 | 
  38 |   test('should toggle theme', async ({ page }) => {
  39 |     const themeBtn = page.locator('[title*="theme"i], [title*="模式"i]').first();
  40 |     if (await themeBtn.isVisible()) {
  41 |       const html = page.locator('html');
  42 |       const initialClass = await html.getAttribute('class');
  43 |       await themeBtn.click();
  44 |       // Theme should have changed
  45 |       await expect(html).not.toHaveClass(initialClass || '');
  46 |     }
  47 |   });
  48 | });
  49 | 
```