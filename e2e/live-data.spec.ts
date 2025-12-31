import { test, expect } from '@playwright/test';

const mockBars = [
  {
    tsMillis: 1710000000000,
    open: 1.08,
    high: 1.1,
    low: 1.07,
    close: 1.09
  },
  {
    tsMillis: 1710000060000,
    open: 1.09,
    high: 1.11,
    low: 1.08,
    close: 1.1
  }
];

test('live-data starts and stops IBKR stream with chart display', async ({ page }) => {
  await page.route('**/ibkr/connect/wait', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ connected: true })
    });
  });

  await page.route('**/ibkr/live/bars/start**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reqId: 42 })
    });
  });

  await page.route('**/ibkr/live/bars/42', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockBars)
    });
  });

  await page.route('**/ibkr/live/bars/stop/42', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ stopped: true })
    });
  });

  await page.route('**/trades**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([])
    });
  });

  await page.route('**/portfolio', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([])
    });
  });

  await page.goto('/live-data');

  const connectButton = page.getByRole('button', { name: 'Connect & Wait' }).first();
  const startButton = page.getByRole('button', { name: 'Start Live Bars' }).first();
  const stopButton = page.getByRole('button', { name: 'Stop Live Bars' }).first();

  await expect(connectButton).toBeVisible();
  await expect(startButton).toBeDisabled();

  await connectButton.click();
  await expect(startButton).toBeEnabled();

  await startButton.click();

  await expect(page.locator('canvas').first()).toBeVisible();
  await expect(page.getByText('Current reqId: 42').first()).toBeVisible();
  await expect(stopButton).toBeEnabled();

  await stopButton.click();

  await expect(page.getByText('Current reqId: 42')).toHaveCount(0);
  await expect(stopButton).toBeDisabled();
});
