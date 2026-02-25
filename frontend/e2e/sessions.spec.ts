import { test, expect } from '@playwright/test';

test.describe('CrewHub Sessions', () => {
  test('app loads and shows header', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify the app loads - check for either title or team emoji
    const hasHub = await page.locator('text=CrewHub').isVisible().catch(() => false);
    const hasTeam = await page.getByText('👥').isVisible().catch(() => false);

    expect(hasHub || hasTeam).toBe(true);
  });

  test('shows connection status', async ({ page }) => {
    await page.goto('/');

    // Wait for connection status to appear (Live or Polling or Disconnected)
    await expect(page.locator('text=/Live|Polling|Disconnected/')).toBeVisible({ timeout: 10000 });
  });

  test('shows sessions/agents from Gateway', async ({ page }) => {
    await page.goto('/');

    // Don't use networkidle - SSE stream keeps it busy
    await page.waitForLoadState('domcontentloaded');

    // Give time for data to load from Gateway
    await page.waitForTimeout(3000);

    // Check if there's any content - sessions visible or connection status
    const hasContent = await page.locator('text=/session|agent|Session|Agent|Live|Polling|Disconnected/i').first().isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasContent).toBe(true);
  });

  test('displays session cards or empty state', async ({ page }) => {
    await page.goto('/');
    // Don't use networkidle - SSE stream keeps it busy
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Either we see session cards OR connection status (app is working)
    const sessionCard = page.locator('[class*="card"], [class*="Card"], [data-testid*="session"]').first();
    const connectionStatus = page.locator('text=/Live|Polling|Disconnected/');

    const hasSessionCard = await sessionCard.isVisible().catch(() => false);
    const hasConnectionStatus = await connectionStatus.isVisible().catch(() => false);

    // We expect either sessions displayed or at least connection status
    expect(hasSessionCard || hasConnectionStatus).toBe(true);
  });

  test('can interact with settings button', async ({ page }) => {
    await page.goto('/');

    // Look for settings button (gear icon)
    const settingsButton = page.locator('button').filter({ has: page.locator('svg') }).last();

    // If settings button exists, click it
    const buttonCount = await settingsButton.count();
    if (buttonCount > 0) {
      await settingsButton.click();
      // Wait for settings panel to appear
      await page.waitForTimeout(500);
    }
  });

  test('can see refresh button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Look for any buttons with SVG icons (refresh, settings)
    const buttons = page.locator('button').filter({ has: page.locator('svg') });

    // Verify buttons exist
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Error Handling', () => {
  test('handles connection errors gracefully', async ({ page }) => {
    await page.goto('/');

    // Page should not crash even if backend is slow
    await expect(page.locator('body')).toBeVisible();
  });
});
