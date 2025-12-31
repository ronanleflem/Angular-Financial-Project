import { test, expect } from '@playwright/test';

test('active robots filters update market and robot tables', async ({ page }) => {
  await page.addInitScript(() => {
    class MockEventSource {
      readonly url: string;
      readyState = 1;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      constructor(url: string) {
        this.url = url;
      }

      close(): void {
        this.readyState = 2;
      }
    }

    // @ts-expect-error - override EventSource for test stability
    window.EventSource = MockEventSource;
  });

  await page.goto('/active-robots');

  const marketsRows = page.locator('.markets-panel tbody tr');
  const robotsRows = page.locator('.robots-panel tbody tr');

  await expect(page.getByRole('heading', { name: 'Robots actifs' })).toBeVisible();
  await expect(page.locator('.markets-panel table')).toBeVisible();
  await expect(page.locator('.robots-panel table')).toBeVisible();

  await expect(marketsRows).toHaveCount(7);
  await expect(robotsRows).toHaveCount(7);

  await page.getByLabel('Broker').selectOption('IBKR');
  await page.getByLabel('Timeframe').selectOption('1h');

  await expect(marketsRows).toHaveCount(1);
  await expect(robotsRows).toHaveCount(1);
  await expect(marketsRows.first()).toContainText('GBPUSD');
  await expect(robotsRows.first()).toContainText('London Breakout');

  await page.getByLabel('Timeframe').selectOption('30m');

  await expect(page.locator('.markets-panel td.empty')).toHaveText('Aucun marché ne correspond à ces filtres.');
  await expect(page.locator('.robots-panel td.empty')).toHaveText('Aucun robot ne correspond à ces filtres.');
});
