import { test, expect } from '@playwright/test';

const mockSymbols = [
  { id: '1', symbol: 'EURUSD', name: 'EURUSD', market: 'FX' }
];

const mockCandles = [
  {
    date: '2024-02-08T12:00:00.000Z',
    open: 1.08,
    high: 1.1,
    low: 1.07,
    close: 1.09
  },
  {
    date: '2024-02-08T13:00:00.000Z',
    open: 1.09,
    high: 1.11,
    low: 1.08,
    close: 1.1
  }
];

const mockStrategies = [
  {
    runId: 'run-123',
    name: 'Momentum Alpha',
    winCount: 12,
    lossCount: 8,
    totalReturn: 1.23,
    maxDrawdown: 0.12,
    averageTrade: 0.05,
    averageSL: 0.02,
    averageTP: 0.08,
    symbol: 'EUR/USD',
    timeframe: 'M15',
    comparedSymbol: 'USD/JPY',
    startStrategy: '2024-01-01T00:00:00.000Z',
    endStrategy: '2024-02-01T00:00:00.000Z',
    rrMoyen: 1.5,
    totalNetReturn: 0.98,
    netWinCount: 9,
    netLossCount: 4,
    averageNetTrade: 0.03
  }
];

test('historical-data loads and renders the chart', async ({ page }) => {
  await page.route('**/api/finance/symbols', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockSymbols)
    });
  });

  await page.route('**/api/finance/charts/candles/date-time**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockCandles)
    });
  });

  await page.goto('/historical-data');

  await expect(page.getByRole('heading', { name: 'Graphique des Bougies' })).toBeVisible();
  await expect(page.locator('#candlestickChart')).toBeVisible();
});

test('screen-strategies lists strategies and navigates to details', async ({ page }) => {
  await page.route('**/all-strategies', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockStrategies)
    });
  });

  await page.goto('/screen-strategies');

  await page.getByLabel('Sélectionnez un symbole :').selectOption('EUR/USD');

  await expect(page.locator('table.strategy-table')).toBeVisible();

  await page.getByRole('button', { name: 'GO' }).first().click();

  await expect(page).toHaveURL(/\/strategy-detail\//);
});
